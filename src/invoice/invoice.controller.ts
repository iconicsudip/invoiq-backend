import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, MarkPaidDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Invoices') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('invoices')
export class InvoiceController {
  constructor(private svc: InvoiceService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: CreateInvoiceDto) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string, @Query('status') status?: string, @Query('clientId') clientId?: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20) { return this.svc.findAll(wid, status, clientId, page, limit); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Put(':id') update(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: UpdateInvoiceDto) { return this.svc.update(id, wid, dto); }
  @Patch(':id/send') send(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.send(id, wid); }
  @Patch(':id/mark-paid') markPaid(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: MarkPaidDto) { return this.svc.markPaid(id, wid, dto); }
  @Patch(':id/cancel') cancel(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.cancel(id, wid); }
  @Post(':id/duplicate') duplicate(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.duplicate(id, wid); }
  @Delete(':id') remove(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.cancel(id, wid); }
}
