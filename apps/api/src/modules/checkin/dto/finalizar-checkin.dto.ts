import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
} from 'class-validator';

export class FinalizarCheckinDto {
  @ApiPropertyOptional({ description: 'Latitude atual no checkout (ausente quando o GPS não responde)' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude atual no checkout (ausente quando o GPS não responde)' })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Horário do checkout no relógio do celular (ISO 8601); só vale com offline=true' })
  @IsOptional()
  @IsISO8601()
  dataCheckout?: string;

  @ApiPropertyOptional({ description: 'Marcação feita sem internet e enviada depois' })
  @IsOptional()
  @IsBoolean()
  offline?: boolean;
}
