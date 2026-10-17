import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OauthAccessTokenEntity } from '../entities/oauth-access-token.entity';
import { AccessOauth, OauthAccessRepositorio } from '../oauth.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OauthAccessTypeorm extends OauthAccessRepositorio {
  constructor(
    @InjectRepository(OauthAccessTokenEntity)
    private readonly repositorio: Repository<OauthAccessTokenEntity>,
  ) {
    super();
  }

  async salvar(access: AccessOauth): Promise<void> {
    await this.repositorio.insert({
      id: access.id,
      jti: access.jti,
      tokenHash: access.tokenHash,
      concessaoId: access.concessaoId,
      expiraEm: access.expiraEm,
      revogadoEm: access.revogadoEm,
    });
  }

  async buscarPorHash(tokenHash: string): Promise<AccessOauth | null> {
    return this.paraDominio(await this.repositorio.findOne({ where: { tokenHash } }));
  }

  async buscarPorJti(jti: string): Promise<AccessOauth | null> {
    if (!UUID_REGEX.test(jti)) return null;
    return this.paraDominio(await this.repositorio.findOne({ where: { jti } }));
  }

  async revogarPorConcessao(concessaoId: string, quando: Date): Promise<void> {
    await this.repositorio.update({ concessaoId, revogadoEm: IsNull() }, { revogadoEm: quando });
  }

  private paraDominio(linha: OauthAccessTokenEntity | null): AccessOauth | null {
    if (!linha) return null;
    return {
      id: linha.id,
      jti: linha.jti,
      tokenHash: linha.tokenHash,
      concessaoId: linha.concessaoId,
      expiraEm: linha.expiraEm,
      revogadoEm: linha.revogadoEm,
    };
  }
}
