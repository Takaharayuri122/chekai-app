import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsUUID } from 'class-validator';

export class IniciarCheckinDto {
  @ApiProperty({ description: 'ID do cliente do checkin' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @ApiProperty({ description: 'ID da unidade do checkin' })
  @IsUUID()
  @IsNotEmpty()
  unidadeId: string;

  @ApiProperty({ description: 'Latitude atual do auditor' })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ description: 'Longitude atual do auditor' })
  @IsLongitude()
  longitude: number;
}
