import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId, CurrentUser } from '../common/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Team') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('team')
export class TeamController {
  constructor(private svc: TeamService) {}
  @Get() getMembers(@WorkspaceId() wid: string) { return this.svc.getMembers(wid); }
  @Post('invite') invite(@WorkspaceId() wid: string, @CurrentUser('id') uid: string, @Body() body: { email: string; role: UserRole }) { return this.svc.invite(wid, uid, body.email, body.role); }
  @Post('accept/:token') accept(@Param('token') token: string, @CurrentUser('id') uid: string) { return this.svc.acceptInvite(token, uid); }
  @Delete(':memberId') remove(@WorkspaceId() wid: string, @Param('memberId') mid: string, @CurrentUser('id') uid: string) { return this.svc.removeMember(wid, mid, uid); }
  @Patch(':memberId/role') updateRole(@WorkspaceId() wid: string, @Param('memberId') mid: string, @CurrentUser('id') uid: string, @Body() body: { role: UserRole }) { return this.svc.updateRole(wid, mid, body.role, uid); }
}
