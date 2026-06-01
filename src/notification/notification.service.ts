import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  findAll(workspaceId: string, userId: string) {
    return this.prisma.notification.findMany({ where: { workspaceId, userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllRead(workspaceId: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { workspaceId, userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  }

  async getUnreadCount(workspaceId: string, userId: string) {
    const count = await this.prisma.notification.count({ where: { workspaceId, userId, isRead: false } });
    return { count };
  }
}
