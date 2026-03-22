import { Module } from '@nestjs/common';
import { PdfPreparacaoService } from './pdf-preparacao.service';

@Module({
  providers: [PdfPreparacaoService],
  exports: [PdfPreparacaoService],
})
export class PdfModule {}
