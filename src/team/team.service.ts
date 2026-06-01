import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { nanoid } from 'nanoid';
import * as dayjs from 'dayjs';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async getMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId, isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, lastLoginAt: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async invite(workspaceId: string, invitedById: string, email: string, role: UserRole) {
    const token = nanoid(32);
    return this.prisma.workspaceInvitation.create({
      data: { workspaceId, email, role, token, invitedById, expiresAt: dayjs().add(7, 'day').toDate() },
    });
  }

  async acceptInvite(token: string, userId: string) {
    const inv = await this.prisma.workspaceInvitation.findUnique({ where: { token } });
    if (!inv || inv.status !== 'PENDING' || inv.expiresAt < new Date()) throw new ForbiddenException('Invalid or expired invitation');
    await this.prisma.$transaction([
      this.prisma.workspaceMember.create({ data: { workspaceId: inv.workspaceId, userId, role: inv.role } }),
      this.prisma.workspaceInvitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } }),
    ]);
    return { message: 'Joined workspace successfully' };
  }

  async removeMember(workspaceId: string, memberId: string, requesterId: string) {
    const requester = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: requesterId } });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) throw new ForbiddenException('Insufficient permissions');
    return this.prisma.workspaceMember.updateMany({ where: { workspaceId, userId: memberId }, data: { isActive: false } });
  }

  async updateRole(workspaceId: string, memberId: string, role: UserRole, requesterId: string) {
    const requester = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: requesterId } });
    if (!requester || requester.role !== 'OWNER') throw new ForbiddenException('Only owner can change roles');
    return this.prisma.workspaceMember.updateMany({ where: { workspaceId, userId: memberId }, data: { role } });
  }
}
