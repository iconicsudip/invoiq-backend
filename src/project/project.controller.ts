import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Projects') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('projects')
export class ProjectController {
  constructor(private svc: ProjectService) {}
  @Post() create(@WorkspaceId() wid: string, @Body() dto: CreateProjectDto) { return this.svc.create(wid, dto); }
  @Get() findAll(@WorkspaceId() wid: string, @Query('clientId') clientId?: string, @Query('status') status?: string) { return this.svc.findAll(wid, clientId, status); }
  @Get(':id') findOne(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.findOne(id, wid); }
  @Put(':id') update(@Param('id') id: string, @WorkspaceId() wid: string, @Body() dto: UpdateProjectDto) { return this.svc.update(id, wid, dto); }
  @Delete(':id') remove(@Param('id') id: string, @WorkspaceId() wid: string) { return this.svc.remove(id, wid); }
}
