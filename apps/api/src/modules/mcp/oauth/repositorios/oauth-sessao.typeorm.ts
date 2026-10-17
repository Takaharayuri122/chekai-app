import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OauthSessaoConsentimentoEntity } from '../entities/oauth-sessao-consentimento.entity';
import { OauthSessaoRepositorio, SessaoConsentimento } from '../oauth.types';

@Injectable()
export class OauthSessaoTypeorm extends OauthSessaoRepositorio {
  constructor(
    @InjectRepository(OauthSessaoConsentimentoEntity)
    private readonly repositorio: Repository<OauthSessaoConsentimentoEntity>,
  ) {
    super();
  }

  async salvar(sessao: SessaoConsentimento): Promise<void> {
    await this.repositorio.insert({
      id: sessao.id,
      sessaoHash: sessao.sessaoHash,
      usuarioId: sessao.usuarioId,
      expiraEm: sessao.expiraEm,
      usadoEm: sessao.usadoEm,
    });
  }

  async buscarPorHash(sessaoHash: string): Promise<SessaoConsentimento | null> {
    const linha = await this.repositorio.findOne({ where: { sessaoHash } });
    if (!linha) return null;
    return {
      id: linha.id,
      sessaoHash: linha.sessaoHash,
      usuarioId: linha.usuarioId,
      expiraEm: linha.expiraEm,
      usadoEm: linha.usadoEm,
    };
  }

  async marcarUsado(id: string, quando: Date): Promise<boolean> {
    const resultado = await this.repositorio.update({ id, usadoEm: IsNull() }, { usadoEm: quando });
    return resultado.affected === 1;
  }
}
