import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  create(workspaceId: string, dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: { ...dto, workspaceId } });
  }

  findAll(workspaceId: string) {
    return this.prisma.plan.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { amount: 'asc' } });
  }

  async findOne(id: string, workspaceId: string) {
    const p = await this.prisma.plan.findFirst({ where: { id, workspaceId } });
    if (!p) throw new NotFoundException('Plan not found');
    return p;
  }

  async update(id: string, workspaceId: string, dto: Partial<CreatePlanDto>) {
    await this.findOne(id, workspaceId);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.plan.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
