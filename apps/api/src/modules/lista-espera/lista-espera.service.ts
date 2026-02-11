import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListaEspera } from './entities/lista-espera.entity';
import { InscreverListaEsperaDto } from './dto/inscrever-lista-espera.dto';
import { EmailService } from '../email/email.service';
import {
  createPaginatedResult,
  PaginatedResult,
  PaginationParams,
} from '../../shared/types/pagination.interface';

/**
 * Serviço responsável pela lista de espera (inscrições beta e listagem para administradores).
 */
@Injectable()
export class ListaEsperaService {
  constructor(
    @InjectRepository(ListaEspera)
    private readonly listaEsperaRepository: Repository<ListaEspera>,
    private readonly emailService: EmailService,
  ) {}

  async inscrever(dto: InscreverListaEsperaDto): Promise<{ message: string }> {
    const existente = await this.listaEsperaRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existente) {
      throw new ConflictException('Você já está na lista de espera. Em breve entraremos em contato.');
    }
    const entidade = this.listaEsperaRepository.create({
      email: dto.email.toLowerCase().trim(),
      telefone: dto.telefone?.trim() || null,
    });
    await this.listaEsperaRepository.save(entidade);
    await this.emailService.enviarEmailListaEspera(entidade.email);
    return { message: 'Inscrição realizada com sucesso.' };
  }

  async listar(
    params: PaginationParams,
  ): Promise<PaginatedResult<ListaEspera>> {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const [items, total] = await this.listaEsperaRepository.findAndCount({
      order: { criadoEm: 'DESC' },
      skip,
      take: limit,
    });
    return createPaginatedResult(items, total, page, limit);
  }
}
