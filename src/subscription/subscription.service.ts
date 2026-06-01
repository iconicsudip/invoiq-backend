import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, workspaceId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.subscription.create({
      data: { ...dto, workspaceId, status: 'CREATED' },
      include: { plan: true, client: true },
    });
  }

  findAll(workspaceId: string, status?: string) {
    const where: any = { workspaceId };
    if (status) where.status = status;
    return this.prisma.subscription.findMany({ where, include: { plan: true, client: { select: { id: true, companyName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, workspaceId: string) {
    const s = await this.prisma.subscription.findFirst({ where: { id, workspaceId }, include: { plan: true, client: true, invoices: { take: 5, orderBy: { createdAt: 'desc' } } } });
    if (!s) throw new NotFoundException('Subscription not found');
    return s;
  }

  async cancel(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  }

  async pause(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.subscription.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  async resume(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.subscription.update({ where: { id }, data: { status: 'ACTIVE' } });
  }
}
