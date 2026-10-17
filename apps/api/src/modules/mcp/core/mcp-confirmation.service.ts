import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface Confirmacao {
  usuarioId: string;
  acao: string;
  recursoId: string;
  expiraEm: Date;
  usada: boolean;
}

@Injectable()
export class McpConfirmationService {
  private readonly confirmacoes = new Map<string, Confirmacao>();

  constructor(
    private readonly relogio: { agora(): Date } = { agora: () => new Date() },
    private readonly segredos: { opaco(): string } = {
      opaco: () => randomBytes(32).toString('base64url'),
    },
  ) {}

  preparar(input: {
    usuarioId: string;
    acao: string;
    recursoId: string;
    resumo: unknown;
  }): { token: string; expiraEm: string; resumo: unknown } {
    const token = this.segredos.opaco();
    const expiraEm = new Date(this.relogio.agora().getTime() + 10 * 60 * 1000);
    this.confirmacoes.set(token, {
      usuarioId: input.usuarioId,
      acao: input.acao,
      recursoId: input.recursoId,
      expiraEm,
      usada: false,
    });
    return { token, expiraEm: expiraEm.toISOString(), resumo: input.resumo };
  }

  consumir(
    token: string,
    esperado: { usuarioId: string; acao: string; recursoId: string },
  ): void {
    const confirmacao = this.confirmacoes.get(token);
    if (
      !confirmacao ||
      confirmacao.usada ||
      confirmacao.expiraEm.getTime() <= this.relogio.agora().getTime() ||
      confirmacao.usuarioId !== esperado.usuarioId ||
      confirmacao.acao !== esperado.acao ||
      confirmacao.recursoId !== esperado.recursoId
    ) {
      throw new UnauthorizedException('Confirmação inválida ou expirada');
    }
    confirmacao.usada = true;
  }
}
