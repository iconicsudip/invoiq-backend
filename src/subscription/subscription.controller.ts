import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Subscriptions') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('subscriptions')
export class SubscriptionController {
  constructor(private svc: SubscriptionService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: CreateSubscriptionDto) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string, @Query('status') status?: string) { return this.svc.findAll(wid, status); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Patch(':id/cancel') cancel(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.cancel(id, wid); }
  @Patch(':id/pause') pause(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.pause(id, wid); }
  @Patch(':id/resume') resume(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.resume(id, wid); }
}
