import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OauthAuthorizationCodeEntity } from '../entities/oauth-authorization-code.entity';
import { AuthorizationCodeOauth, OauthCodeRepositorio } from '../oauth.types';

@Injectable()
export class OauthCodeTypeorm extends OauthCodeRepositorio {
  constructor(
    @InjectRepository(OauthAuthorizationCodeEntity)
    private readonly repositorio: Repository<OauthAuthorizationCodeEntity>,
  ) {
    super();
  }

  async salvar(code: AuthorizationCodeOauth): Promise<void> {
    await this.repositorio.insert({
      id: code.id,
      codeHash: code.codeHash,
      clienteId: code.clienteId,
      usuarioId: code.usuarioId,
      redirectUri: code.redirectUri,
      codeChallenge: code.codeChallenge,
      codeChallengeMethod: code.codeChallengeMethod,
      resource: code.resource,
      scopes: code.scopes,
      expiraEm: code.expiraEm,
      usadoEm: code.usadoEm,
    });
  }

  async buscarPorHash(codeHash: string): Promise<AuthorizationCodeOauth | null> {
    const linha = await this.repositorio.findOne({
      where: { codeHash },
      relations: { cliente: true },
    });
    if (!linha) return null;
    return {
      id: linha.id,
      codeHash: linha.codeHash,
      clienteId: linha.clienteId,
      clientId: linha.cliente?.clientId,
      usuarioId: linha.usuarioId,
      redirectUri: linha.redirectUri,
      codeChallenge: linha.codeChallenge,
      codeChallengeMethod: linha.codeChallengeMethod,
      resource: linha.resource,
      scopes: linha.scopes,
      expiraEm: linha.expiraEm,
      usadoEm: linha.usadoEm,
    };
  }

  async marcarUsado(id: string, quando: Date): Promise<boolean> {
    const resultado = await this.repositorio.update({ id, usadoEm: IsNull() }, { usadoEm: quando });
    return resultado.affected === 1;
  }
}
