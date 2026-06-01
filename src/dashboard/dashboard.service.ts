import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as dayjs from 'dayjs';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(workspaceId: string) {
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const monthStart = now.startOf('month').toDate();
    const yearStart = now.startOf('year').toDate();

    const [todayTx, monthTx, yearTx, pendingInvoices, paidInvoices, overdueInvoices, activeSubs, recentTx] = await Promise.all([
      this.prisma.transaction.aggregate({ where: { workspaceId, status: 'SUCCESS', paidAt: { gte: todayStart } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { workspaceId, status: 'SUCCESS', paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { workspaceId, status: 'SUCCESS', paidAt: { gte: yearStart } }, _sum: { amount: true } }),
      this.prisma.invoice.aggregate({ where: { workspaceId, status: { in: ['SENT', 'OVERDUE'] } }, _count: true, _sum: { amountDue: true } }),
      this.prisma.invoice.count({ where: { workspaceId, status: 'PAID' } }),
      this.prisma.invoice.count({ where: { workspaceId, status: 'OVERDUE' } }),
      this.prisma.subscription.count({ where: { workspaceId, status: 'ACTIVE' } }),
      this.prisma.transaction.findMany({
        where: { workspaceId }, take: 10, orderBy: { createdAt: 'desc' },
        include: { invoice: { include: { client: { select: { companyName: true } } } } },
      }),
    ]);

    return {
      revenue: {
        today: Number(todayTx._sum.amount ?? 0),
        thisMonth: Number(monthTx._sum.amount ?? 0),
        thisYear: Number(yearTx._sum.amount ?? 0),
      },
      invoices: {
        pending: pendingInvoices._count,
        paid: paidInvoices,
        overdue: overdueInvoices,
        pendingAmount: Number(pendingInvoices._sum.amountDue ?? 0),
        overdueAmount: 0,
      },
      subscriptions: { active: activeSubs, failedPayments: 0, upcomingRenewals: 0 },
      recentTransactions: recentTx.map(t => ({
        id: t.id, amount: Number(t.amount), status: t.status,
        clientName: (t.invoice as any)?.client?.companyName ?? 'Unknown',
        date: dayjs(t.createdAt).format('DD MMM'),
      })),
    };
  }
}
