import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId, CurrentUser } from '../common/decorators';

@ApiTags('Notifications') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('notifications')
export class NotificationController {
  constructor(private svc: NotificationService) {}
  @Get() findAll(@WorkspaceId() wid: string, @CurrentUser('id') uid: string) { return this.svc.findAll(wid, uid); }
  @Get('unread-count') unreadCount(@WorkspaceId() wid: string, @CurrentUser('id') uid: string) { return this.svc.getUnreadCount(wid, uid); }
  @Patch(':id/read') markRead(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.markRead(id, uid); }
  @Patch('mark-all-read') markAllRead(@WorkspaceId() wid: string, @CurrentUser('id') uid: string) { return this.svc.markAllRead(wid, uid); }
}
