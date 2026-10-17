import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OauthRefreshTokenEntity } from '../entities/oauth-refresh-token.entity';
import { OauthRefreshRepositorio, RefreshOauth } from '../oauth.types';

@Injectable()
export class OauthRefreshTypeorm extends OauthRefreshRepositorio {
  constructor(
    @InjectRepository(OauthRefreshTokenEntity)
    private readonly repositorio: Repository<OauthRefreshTokenEntity>,
  ) {
    super();
  }

  async salvar(refresh: RefreshOauth): Promise<void> {
    await this.repositorio.insert({
      id: refresh.id,
      tokenHash: refresh.tokenHash,
      concessaoId: refresh.concessaoId,
      expiraEm: refresh.expiraEm,
      usadoEm: refresh.usadoEm,
      revogadoEm: refresh.revogadoEm,
    });
  }

  async buscarPorHash(tokenHash: string): Promise<RefreshOauth | null> {
    const linha = await this.repositorio.findOne({ where: { tokenHash } });
    if (!linha) return null;
    return {
      id: linha.id,
      tokenHash: linha.tokenHash,
      concessaoId: linha.concessaoId,
      expiraEm: linha.expiraEm,
      usadoEm: linha.usadoEm,
      revogadoEm: linha.revogadoEm,
    };
  }

  async marcarUsado(id: string, quando: Date): Promise<boolean> {
    const resultado = await this.repositorio.update(
      { id, usadoEm: IsNull(), revogadoEm: IsNull() },
      { usadoEm: quando },
    );
    return resultado.affected === 1;
  }

  async revogarPorConcessao(concessaoId: string, quando: Date): Promise<void> {
    await this.repositorio.update({ concessaoId, revogadoEm: IsNull() }, { revogadoEm: quando });
  }
}
