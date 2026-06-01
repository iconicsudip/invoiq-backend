import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Clients') @ApiBearerAuth('JWT-auth') @ApiHeader({ name: 'x-workspace-id', required: true }) @UseGuards(JwtAuthGuard) @Controller('clients')
export class ClientController {
  constructor(private svc: ClientService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: CreateClientDto) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string, @Query('search') search?: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20) { return this.svc.findAll(wid, search, page, limit); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Put(':id') update(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: UpdateClientDto) { return this.svc.update(id, wid, dto); }
  @Delete(':id') remove(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.remove(id, wid); }
}
