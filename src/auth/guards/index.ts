import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// ─── JWT Auth Guard ───────────────────────────────────────────────

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}

// ─── Roles Guard ─────────────────────────────────────────────────

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly roleHierarchy: Record<UserRole, number> = {
    OWNER: 4,
    ADMIN: 3,
    ACCOUNTANT: 2,
    STAFF: 1,
  };

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.headers['x-workspace-id'] || request.params?.workspaceId;

    if (!user) throw new UnauthorizedException('Authentication required');

    const membership = user.workspaceMembers?.find(
      (m: any) => m.workspaceId === workspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const userLevel = this.roleHierarchy[membership.role as UserRole] || 0;
    const requiredLevel = Math.min(
      ...requiredRoles.map((r) => this.roleHierarchy[r] || 0),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Attach workspace role to request for downstream use
    request.workspaceRole = membership.role;
    return true;
  }
}

// ─── Workspace Guard ─────────────────────────────────────────────

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId =
      request.headers['x-workspace-id'] ||
      request.params?.workspaceId ||
      request.body?.workspaceId;

    if (!workspaceId) return true; // Not all routes need workspace context

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
        isActive: true,
      },
      include: {
        workspace: {
          select: { id: true, companyName: true, isActive: true },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    if (!membership.workspace.isActive) {
      throw new ForbiddenException('This workspace is suspended');
    }

    request.workspace = membership.workspace;
    request.workspaceRole = membership.role;

    return true;
  }
}
