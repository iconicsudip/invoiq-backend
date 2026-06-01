import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateClientDto) {
    return this.prisma.client.create({ data: { ...dto, workspaceId } });
  }

  async findAll(workspaceId: string, search?: string, page = 1, limit = 20) {
    const where: any = { workspaceId, deletedAt: null };
    if (search) where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { companyName: 'asc' } }),
      this.prisma.client.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, workspaceId: string) {
    const c = await this.prisma.client.findFirst({ where: { id, workspaceId }, include: { projects: true, _count: { select: { invoices: true, subscriptions: true, contracts: true } } } });
    if (!c) throw new NotFoundException('Client not found');
    return c;
  }

  async update(id: string, workspaceId: string, dto: UpdateClientDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
