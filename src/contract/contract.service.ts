import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContractService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: any) {
    return this.prisma.contract.create({ data: { ...dto, workspaceId } });
  }

  async findAll(workspaceId: string, status?: string) {
    const where: any = { workspaceId, deletedAt: null };
    if (status) where.status = status;
    return this.prisma.contract.findMany({ where, include: { client: { select: { id: true, companyName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, workspaceId: string) {
    const c = await this.prisma.contract.findFirst({ where: { id, workspaceId }, include: { client: true } });
    if (!c) throw new NotFoundException('Contract not found');
    return c;
  }

  async update(id: string, workspaceId: string, dto: any) {
    await this.findOne(id, workspaceId);
    return this.prisma.contract.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.contract.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
