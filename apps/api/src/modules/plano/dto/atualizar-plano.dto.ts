import { PartialType } from '@nestjs/swagger';
import { CriarPlanoDto } from './criar-plano.dto';

/**
 * DTO para atualização de um plano.
 */
export class AtualizarPlanoDto extends PartialType(CriarPlanoDto) {}

