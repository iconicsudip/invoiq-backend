import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto, MarkPaidDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import * as dayjs from 'dayjs';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateInvoiceDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    // Auto-generate invoice number
    const invoiceNumber = `${workspace.invoicePrefix}-${String(workspace.invoiceCounter).padStart(4, '0')}`;

    // Calculate totals
    const { subtotal, totalGst, cgst, sgst, igst, total, items } = this.calculateTotals(dto.items, dto.discountPercent ?? 0);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          workspaceId, clientId: dto.clientId, projectId: dto.projectId,
          invoiceNumber, invoiceDate: new Date(dto.invoiceDate), dueDate: new Date(dto.dueDate),
          notes: dto.notes, status: 'DRAFT',
          discountPercent: dto.discountPercent ?? 0,
          subtotal, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, totalGst, total,
          amountDue: total,
          items: { create: items },
        },
        include: { items: true, client: true },
      });
      await tx.workspace.update({ where: { id: workspaceId }, data: { invoiceCounter: { increment: 1 } } });
      return inv;
    });

    return invoice;
  }

  async findAll(workspaceId: string, status?: string, clientId?: string, page = 1, limit = 20) {
    const where: any = { workspaceId };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, skip: (page - 1) * limit, take: limit, include: { client: { select: { id: true, companyName: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, workspaceId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, workspaceId }, include: { items: true, client: true, project: true } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async update(id: string, workspaceId: string, dto: UpdateInvoiceDto) {
    const inv = await this.findOne(id, workspaceId);
    if (inv.status === 'PAID') throw new BadRequestException('Cannot edit a paid invoice');

    if (dto.items) {
      const { subtotal, totalGst, cgst, sgst, igst, total, items } = this.calculateTotals(dto.items, dto.discountPercent ?? 0);
      await this.prisma.$transaction([
        this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
        this.prisma.invoice.update({ where: { id }, data: { ...dto, items: undefined, subtotal, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, totalGst, total, amountDue: total - (inv.amountPaid as any) } }),
        ...items.map(item => this.prisma.invoiceItem.create({ data: { ...item, invoiceId: id } })),
      ]);
      return this.findOne(id, workspaceId);
    }

    return this.prisma.invoice.update({ where: { id }, data: { ...dto, items: undefined } as any });
  }

  async send(id: string, workspaceId: string) {
    const inv = await this.findOne(id, workspaceId);
    if (inv.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be sent');
    return this.prisma.invoice.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
  }

  async markPaid(id: string, workspaceId: string, dto: MarkPaidDto) {
    const inv = await this.findOne(id, workspaceId);
    if (inv.status === 'PAID') throw new BadRequestException('Invoice already paid');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date(), amountPaid: inv.total, amountDue: 0, razorpayPaymentId: dto.razorpayPaymentId },
      });
      if (inv.projectId) {
        await tx.project.update({ where: { id: inv.projectId }, data: { totalRevenue: { increment: inv.total as any } } });
      }
      await tx.transaction.create({
        data: { workspaceId, invoiceId: id, amount: inv.total, currency: 'INR', status: 'SUCCESS', paidAt: new Date(), razorpayPaymentId: dto.razorpayPaymentId },
      });
      return updated;
    });
  }

  async cancel(id: string, workspaceId: string) {
    const inv = await this.findOne(id, workspaceId);
    if (inv.status === 'PAID') throw new BadRequestException('Cannot cancel a paid invoice');
    return this.prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  }

  async duplicate(id: string, workspaceId: string) {
    const original = await this.findOne(id, workspaceId);
    const dto: CreateInvoiceDto = {
      clientId: original.clientId,
      projectId: original.projectId ?? undefined,
      invoiceDate: dayjs().format('YYYY-MM-DD'),
      dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      notes: original.notes ?? undefined,
      discountPercent: Number(original.discountPercent),
      items: (original.items as any[]).map(i => ({ itemName: i.itemName, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), gstPercent: Number(i.gstPercent) })),
    };
    return this.create(workspaceId, dto);
  }

  // Mark overdue via cron
  async markOverdue() {
    const result = await this.prisma.invoice.updateMany({
      where: { status: 'SENT', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    return result;
  }

  private calculateTotals(items: any[], discountPercent: number) {
    const processed = items.map((item, i) => {
      const amount = item.quantity * item.unitPrice;
      return { itemName: item.itemName, description: item.description ?? null, quantity: item.quantity, unitPrice: item.unitPrice, gstPercent: item.gstPercent ?? 18, amount, sortOrder: i };
    });
    const rawSubtotal = processed.reduce((s, i) => s + i.amount, 0);
    const discount = (rawSubtotal * discountPercent) / 100;
    const subtotal = rawSubtotal - discount;
    const totalGst = processed.reduce((s, i) => s + (i.amount * i.gstPercent / 100), 0);
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;
    const igst = 0;
    const total = subtotal + totalGst;
    return { subtotal, totalGst, cgst, sgst, igst, total, items: processed };
  }
}
