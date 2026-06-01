import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';

@ApiTags('Workspaces') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('workspaces')
export class WorkspaceController {
  constructor(private svc: WorkspaceService) {}
  @Post() @ApiOperation({ summary: 'Create workspace' }) create(@CurrentUser('id') uid: string, @Body() dto: CreateWorkspaceDto) { return this.svc.create(uid, dto); }
  @Get() @ApiOperation({ summary: 'List my workspaces' }) findAll(@CurrentUser('id') uid: string) { return this.svc.findAllForUser(uid); }
  @Get(':id') @ApiOperation({ summary: 'Get workspace' }) findOne(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.findOne(id, uid); }
  @Put(':id') @ApiOperation({ summary: 'Update workspace' }) update(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: UpdateWorkspaceDto) { return this.svc.update(id, uid, dto); }
  @Delete(':id') @ApiOperation({ summary: 'Delete workspace' }) remove(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.remove(id, uid); }
}
