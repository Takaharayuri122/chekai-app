import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OauthClienteEntity } from '../entities/oauth-cliente.entity';
import { ClienteOauth, OauthClienteRepositorio } from '../oauth.types';

@Injectable()
export class OauthClienteTypeorm extends OauthClienteRepositorio {
  constructor(
    @InjectRepository(OauthClienteEntity)
    private readonly repositorio: Repository<OauthClienteEntity>,
  ) {
    super();
  }

  async buscarPorClientId(clientId: string): Promise<ClienteOauth | null> {
    const linha = await this.repositorio.findOne({ where: { clientId } });
    if (!linha) return null;
    return {
      id: linha.id,
      clientId: linha.clientId,
      nome: linha.nome,
      redirectUris: [...linha.redirectUris],
      origem: linha.origem,
      documento: linha.documento ? { ...linha.documento } : null,
      atualizadoEm: linha.atualizadoEm,
    };
  }

  async salvar(cliente: ClienteOauth): Promise<void> {
    await this.repositorio.upsert({
      id: cliente.id,
      clientId: cliente.clientId,
      nome: cliente.nome,
      redirectUris: [...cliente.redirectUris],
      origem: cliente.origem,
      documento: cliente.documento,
    }, ['clientId']);
  }
}
