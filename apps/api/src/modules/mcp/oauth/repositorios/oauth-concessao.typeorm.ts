import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OauthConcessaoEntity } from '../entities/oauth-concessao.entity';
import { ConcessaoOauth, OauthConcessaoRepositorio } from '../oauth.types';

@Injectable()
export class OauthConcessaoTypeorm extends OauthConcessaoRepositorio {
  constructor(
    @InjectRepository(OauthConcessaoEntity)
    private readonly repositorio: Repository<OauthConcessaoEntity>,
  ) {
    super();
  }

  async salvar(concessao: ConcessaoOauth): Promise<void> {
    await this.repositorio.insert({
      id: concessao.id,
      clienteId: concessao.clienteId,
      usuarioId: concessao.usuarioId,
      resource: concessao.resource,
      scopes: concessao.scopes,
      revogadaEm: concessao.revogadaEm,
    });
  }

  async buscarPorId(id: string): Promise<ConcessaoOauth | null> {
    const linha = await this.repositorio.findOne({ where: { id } });
    if (!linha) return null;
    return {
      id: linha.id,
      clienteId: linha.clienteId,
      usuarioId: linha.usuarioId,
      resource: linha.resource,
      scopes: linha.scopes,
      revogadaEm: linha.revogadaEm,
    };
  }

  async revogar(id: string, quando: Date): Promise<void> {
    await this.repositorio.update({ id, revogadaEm: IsNull() }, { revogadaEm: quando });
  }
}
