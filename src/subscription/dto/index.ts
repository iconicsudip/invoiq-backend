import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionInterval } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() @Min(1) amount: number;
  @ApiProperty({ enum: SubscriptionInterval }) @IsEnum(SubscriptionInterval) interval: SubscriptionInterval;
}

export class CreateSubscriptionDto {
  @ApiProperty() @IsString() clientId: string;
  @ApiProperty() @IsString() planId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
