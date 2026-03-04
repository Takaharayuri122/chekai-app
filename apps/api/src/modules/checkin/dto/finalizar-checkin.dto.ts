import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class FinalizarCheckinDto {
  @ApiProperty({ description: 'Latitude atual no checkout' })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ description: 'Longitude atual no checkout' })
  @IsLongitude()
  longitude: number;
}
