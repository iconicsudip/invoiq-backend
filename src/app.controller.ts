import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  health() {
    return { status: 'ok', service: 'invoiq-api', timestamp: new Date().toISOString() };
  }
}
