import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Plans') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('plans')
export class PlanController {
  constructor(private svc: PlanService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: CreatePlanDto) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string) { return this.svc.findAll(wid); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Put(':id') update(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: CreatePlanDto) { return this.svc.update(id, wid, dto); }
  @Delete(':id') remove(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.remove(id, wid); }
}
