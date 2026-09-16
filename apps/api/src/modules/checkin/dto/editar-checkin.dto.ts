import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class EditarCheckinDto {
  @ApiPropertyOptional({ description: 'Nova data/hora do checkin (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  dataCheckin?: string;

  @ApiPropertyOptional({
    description: 'Nova data/hora do checkout (ISO 8601). Null não é permitido em checkin fechado.',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  @IsOptional()
  dataCheckout?: string | null;

  @ApiPropertyOptional({ description: 'Comentário do checkin', nullable: true })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  comentario?: string | null;
}
