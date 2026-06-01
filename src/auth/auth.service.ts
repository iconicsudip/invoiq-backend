import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import dayjs from "dayjs";
import { PrismaService } from "../prisma/prisma.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Registration ───────────────────────────────────────────────

  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>("bcrypt.rounds", 12),
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        isEmailVerified: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        ipAddress,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ─── Email / Password Login ──────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is disabled");
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        ipAddress,
        userAgent,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(
      user.id,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ─── OTP ─────────────────────────────────────────────────────────

  async requestOtp(dto: OtpRequestDto) {
    const expiry = this.config.get<number>("otp.expiryMinutes", 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Find or create user by phone
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    // Invalidate existing OTPs
    await this.prisma.otpCode.updateMany({
      where: { phone: dto.phone, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new OTP
    await this.prisma.otpCode.create({
      data: {
        userId: user?.id,
        phone: dto.phone,
        code: await bcrypt.hash(code, 10),
        expiresAt: dayjs().add(expiry, "minute").toDate(),
      },
    });

    // In production: send via Twilio/SMS
    // await this.smsService.send(dto.phone, `Your OTP is ${code}`);
    this.logger.log(`OTP for ${dto.phone}: ${code}`); // Remove in production

    return { message: `OTP sent to ${dto.phone}`, expiresIn: expiry * 60 };
  }

  async verifyOtp(dto: OtpVerifyDto, ipAddress?: string) {
    const maxAttempts = this.config.get<number>("otp.maxAttempts", 5);

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        "OTP expired or not found. Please request a new one.",
      );
    }

    if (otpRecord.attempts >= maxAttempts) {
      throw new BadRequestException(
        "Too many failed attempts. Please request a new OTP.",
      );
    }

    const isValid = await bcrypt.compare(dto.code, otpRecord.code);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email || `${dto.phone.replace("+", "")}@otp.temp`,
          firstName: dto.firstName || "User",
          lastName: dto.lastName || "",
          phone: dto.phone,
          isPhoneVerified: true,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true, lastLoginAt: new Date() },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Refresh Token ───────────────────────────────────────────────

  async refreshTokens(dto: RefreshTokenDto, ipAddress?: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.config.get("jwt.refreshSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException("Refresh token revoked or expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or disabled");
    }

    // Rotate refresh token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Logout ──────────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: { userId, action: "LOGOUT", entity: "User", entityId: userId },
    });

    return { message: "Logged out successfully" };
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: "Logged out from all devices" };
  }

  // ─── Password Reset ──────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user)
      return { message: "If that email exists, a reset link has been sent." };

    const token = randomBytes(32).toString("hex");

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: dayjs().add(1, "hour").toDate(),
      },
    });

    // In production: send email with reset link
    // await this.emailService.sendPasswordReset(user.email, token);
    this.logger.log(`Password reset token for ${user.email}: ${token}`);

    return { message: "If that email exists, a reset link has been sent." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.config.get<number>("bcrypt.rounds", 12),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: "Password reset successful. Please log in." };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.passwordHash) {
      throw new BadRequestException("No password set on this account");
    }

    const isValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.config.get<number>("bcrypt.rounds", 12),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: "Password changed successfully. Please log in again." };
  }

  // ─── Profile ─────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          where: { isActive: true },
          include: {
            workspace: {
              select: {
                id: true,
                companyName: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");

    return this.sanitizeUser(user);
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { message: "FCM token updated" };
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>("jwt.secret"),
        expiresIn: this.config.get<string>("jwt.expiresIn", "15m"),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>("jwt.refreshSecret"),
        expiresIn: this.config.get<string>("jwt.refreshExpiresIn", "30d"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const expiresAt = dayjs().add(30, "day").toDate();

    await this.prisma.refreshToken.create({
      data: { userId, token, ipAddress, deviceInfo: userAgent, expiresAt },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
