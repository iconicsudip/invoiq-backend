import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto';
import slugify from 'slugify';
import { nanoid } from 'nanoid';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const baseSlug = slugify(dto.companyName, { lower: true, strict: true });
    const slug = `${baseSlug}-${nanoid(6)}`;

    const workspace = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: { ...dto, slug },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId, role: 'OWNER' },
      });
      return ws;
    });

    return workspace;
  }

  async findAllForUser(userId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { userId, isActive: true },
      include: {
        workspace: {
          include: {
            invoices: {
              where: {
                status: { in: ['SENT', 'OVERDUE'] },
                deletedAt: null,
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => {
      const pendingInvoicesCount = m.workspace.invoices.length;
      const { invoices, ...wsData } = m.workspace as any;
      return { ...wsData, role: m.role, pendingInvoicesCount };
    });
  }

  async findOne(id: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId, isActive: true },
      include: { workspace: true },
    });
    if (!member) throw new NotFoundException('Workspace not found');
    return { ...member.workspace, role: member.role };
  }

  async update(id: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.assertOwnerOrAdmin(id, userId);
    return this.prisma.workspace.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    return this.prisma.workspace.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  }

  private async assertOwnerOrAdmin(workspaceId: string, userId: string) {
    const m = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId, isActive: true } });
    if (!m || !['OWNER', 'ADMIN'].includes(m.role)) throw new ForbiddenException('Insufficient permissions');
    return m;
  }

  private async assertOwner(workspaceId: string, userId: string) {
    const m = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId, isActive: true } });
    if (!m || m.role !== 'OWNER') throw new ForbiddenException('Only workspace owner can do this');
    return m;
  }
}
