import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Transactions') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('transactions')
export class TransactionController {
  constructor(private svc: TransactionService) {}
  @Get() findAll(@WorkspaceId() wid: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20) { return this.svc.findAll(wid, page, limit); }
}
