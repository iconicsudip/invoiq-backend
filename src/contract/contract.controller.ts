import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Contracts') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('contracts')
export class ContractController {
  constructor(private svc: ContractService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: any) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string, @Query('status') status?: string) { return this.svc.findAll(wid, status); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Put(':id') update(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: any) { return this.svc.update(id, wid, dto); }
  @Delete(':id') remove(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.remove(id, wid); }
}
