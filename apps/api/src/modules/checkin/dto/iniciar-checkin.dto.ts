import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class IniciarCheckinDto {
  @ApiProperty({ description: 'ID do cliente do checkin' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @ApiProperty({ description: 'ID da unidade do checkin' })
  @IsUUID()
  @IsNotEmpty()
  unidadeId: string;

  @ApiPropertyOptional({ description: 'Latitude atual do auditor (ausente quando o GPS não responde)' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude atual do auditor (ausente quando o GPS não responde)' })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ description: 'ID gerado no celular (idempotência do envio offline)' })
  @IsOptional()
  @IsUUID()
  localId?: string;

  @ApiPropertyOptional({ description: 'Horário do check-in no relógio do celular (ISO 8601); só vale com offline=true' })
  @IsOptional()
  @IsISO8601()
  dataCheckin?: string;

  @ApiPropertyOptional({ description: 'Marcação feita sem internet e enviada depois' })
  @IsOptional()
  @IsBoolean()
  offline?: boolean;
}
