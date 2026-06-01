import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  findAll(workspaceId: string, page = 1, limit = 20) {
    return this.prisma.transaction.findMany({
      where: { workspaceId },
      skip: (page - 1) * limit, take: limit,
      include: { invoice: { include: { client: { select: { companyName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
