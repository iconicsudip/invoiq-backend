import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({ data: { ...dto, workspaceId } });
  }

  async findAll(workspaceId: string, clientId?: string, status?: string) {
    const where: any = { workspaceId };
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    return this.prisma.project.findMany({ where, include: { client: { select: { id: true, companyName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, workspaceId: string) {
    const p = await this.prisma.project.findFirst({ where: { id, workspaceId }, include: { client: true, invoices: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  async update(id: string, workspaceId: string, dto: UpdateProjectDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
