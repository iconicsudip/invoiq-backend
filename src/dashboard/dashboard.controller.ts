import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators';

@ApiTags('Dashboard') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}
  @Get() getStats(@WorkspaceId() wid: string) { return this.svc.getStats(wid); }
}
