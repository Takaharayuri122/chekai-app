'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadcn/card';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import {
  DURACAO_OTP_MS,
  ROTAS_OAUTH_DA_TELA,
  EstadoFluxo,
  aposOtpSolicitado,
  aposOtpValidado,
  cabecalhosOauth,
  corpoConsentir,
  estadoInicial,
  interpretarErroConsentimento,
  interpretarErroSolicitarOtp,
  interpretarErroValidarOtp,
  lerParametrosOAuth,
  prepararSolicitarOtp,
  prepararValidarOtp,
  redirectFinalSeguro,
  redirectRecusaSeguro,
  scopesParaConsentimento,
  urlOauth,
  voltarParaEmail,
} from './oauth-autorizar';

const ORIGEM_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function nomeDoAplicativo(clientId: string): string {
  try {
    return new URL(clientId).hostname;
  } catch {
    return 'Este aplicativo';
  }
}

function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${segundos.toString().padStart(2, '0')}`;
}

function mensagemHttp(json: unknown): string {
  if (!json || typeof json !== 'object' || !('message' in json)) return '';
  const message = (json as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return '';
}

function dadosResposta(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== 'object') return {};
  if ('data' in json && json.data && typeof json.data === 'object') {
    return json.data as Record<string, unknown>;
  }
  return json as Record<string, unknown>;
}

async function postOauth(
  rota: string,
  corpo: Record<string, string>,
): Promise<{ ok: true; dados: Record<string, unknown> } | { ok: false; status: number; message: string }> {
  try {
    const resposta = await fetch(urlOauth(ORIGEM_API, rota), {
      method: 'POST',
      headers: cabecalhosOauth(),
      body: JSON.stringify(corpo),
      cache: 'no-store',
      credentials: 'omit',
    });
    let json: unknown = null;
    try {
      json = await resposta.json();
    } catch {
      json = null;
    }
    if (!resposta.ok) {
      return { ok: false, status: resposta.status, message: mensagemHttp(json) };
    }
    return { ok: true, dados: dadosResposta(json) };
  } catch {
    return { ok: false, status: 0, message: '' };
  }
}

function navegar(url: string) {
  window.location.assign(url);
}

function AutorizarConteudo() {
  const searchParams = useSearchParams();
  const leitura = lerParametrosOAuth(searchParams);
  const [estado, setEstado] = useState<EstadoFluxo | null>(
    leitura.ok ? estadoInicial(leitura.parametros) : null,
  );
  const [pedidoInvalido] = useState(leitura.ok ? null : leitura.mensagem);
  const [emailDigitado, setEmailDigitado] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [restanteMs, setRestanteMs] = useState<number | null>(null);

  useEffect(() => {
    if (estado?.etapa !== 'otp') return;
    const id = window.setInterval(() => {
      setRestanteMs((atual) => (atual === null || atual <= 1000 ? 0 : atual - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [estado?.etapa]);

  async function solicitarCodigo(email: string) {
    const pedido = prepararSolicitarOtp(email);
    if (!estado) return;
    if (!pedido.ok) {
      setEstado({ ...estado, mensagem: pedido.mensagem });
      return;
    }
    setCarregando(true);
    const resposta = await postOauth(ROTAS_OAUTH_DA_TELA.solicitarOtp, pedido.corpo);
    setCarregando(false);
    if (!resposta.ok) {
      const erro = interpretarErroSolicitarOtp(resposta);
      setEstado({
        ...estado,
        etapa: erro.etapa,
        mensagem: erro.mensagem,
        sessaoConsentimento: null,
      });
      return;
    }
    setEstado(aposOtpSolicitado(estado, pedido.corpo.email));
    setEmailDigitado(pedido.corpo.email);
    setCodigoDigitado('');
    setRestanteMs(DURACAO_OTP_MS);
  }

  async function aoEnviarEmail(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await solicitarCodigo(emailDigitado);
  }

  async function aoEnviarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!estado) return;
    const pedido = prepararValidarOtp(estado.email, codigoDigitado);
    if (!pedido.ok) {
      setEstado({ ...estado, mensagem: pedido.mensagem });
      return;
    }
    setCarregando(true);
    const resposta = await postOauth(ROTAS_OAUTH_DA_TELA.validarOtp, pedido.corpo);
    setCarregando(false);
    if (!resposta.ok) {
      const erro = interpretarErroValidarOtp(resposta);
      setEstado({
        ...estado,
        etapa: erro.etapa,
        mensagem: erro.mensagem,
        sessaoConsentimento: erro.sessaoConsentimento,
      });
      return;
    }
    const sessao = typeof resposta.dados.sessaoConsentimento === 'string'
      ? resposta.dados.sessaoConsentimento
      : '';
    try {
      setEstado(aposOtpValidado(estado, sessao));
      setCodigoDigitado('');
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Sessão de consentimento inválida';
      setEstado({ ...estado, mensagem, sessaoConsentimento: null });
    }
  }

  async function autorizar() {
    if (!estado) return;
    let corpo: Record<string, string>;
    try {
      corpo = corpoConsentir(estado);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Sessão de consentimento inválida';
      setEstado({ ...estado, mensagem });
      return;
    }
    setCarregando(true);
    const resposta = await postOauth(ROTAS_OAUTH_DA_TELA.consentir, corpo);
    if (!resposta.ok) {
      const erro = interpretarErroConsentimento(resposta);
      setEstado({ ...estado, mensagem: erro.mensagem });
      setCarregando(false);
      return;
    }
    const redirectPara = typeof resposta.dados.redirectPara === 'string' ? resposta.dados.redirectPara : '';
    const destino = redirectFinalSeguro(redirectPara, estado.parametros);
    if (!destino.ok) {
      setEstado({ ...estado, mensagem: destino.mensagem });
      setCarregando(false);
      return;
    }
    navegar(destino.url);
  }

  function recusar() {
    if (!estado) return;
    const destino = redirectRecusaSeguro(estado.parametros);
    if (!destino.ok) {
      setEstado({ ...estado, mensagem: destino.mensagem });
      return;
    }
    setCarregando(true);
    navegar(destino.url);
  }

  function voltar() {
    if (!estado) return;
    setEstado(voltarParaEmail(estado));
    setCodigoDigitado('');
    setRestanteMs(null);
    setEmailDigitado(estado.email);
  }

  const etapa = estado?.etapa ?? 'email';
  const titulo = pedidoInvalido
    ? 'Não foi possível continuar'
    : etapa === 'email'
      ? 'Confirme seu e-mail'
      : etapa === 'otp'
        ? 'Digite o código'
        : 'Autorizar acesso';

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Image
          src="/images/logo-large.png"
          alt="ChekAI"
          width={280}
          height={74}
          priority
          className="mx-auto h-auto w-full max-w-[200px]"
        />
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-3 px-4 pt-6 sm:px-6">
            <Passos etapa={etapa} bloqueado={Boolean(pedidoInvalido)} />
            <CardTitle className="text-xl font-display">{titulo}</CardTitle>
            <CardDescription>
              {pedidoInvalido
                ? 'O pedido de acesso chegou incompleto ou não pode ser aceito.'
                : etapa === 'email'
                  ? 'Informe o e-mail da sua conta para receber um código de 6 dígitos.'
                  : etapa === 'otp'
                    ? `Enviamos um código para ${estado?.email}. Ele vale por 10 minutos.`
                    : `${nomeDoAplicativo(estado?.parametros.clientId ?? '')} pede permissão para agir na sua conta.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-6 sm:px-6">
            {pedidoInvalido ? (
              <Alerta>{pedidoInvalido}</Alerta>
            ) : estado && etapa === 'email' ? (
              <form className="space-y-4" onSubmit={aoEnviarEmail} noValidate>
                {estado.mensagem ? <Alerta>{estado.mensagem}</Alerta> : null}
                <div className="space-y-2">
                  <Label htmlFor="oauth-email">E-mail</Label>
                  <Input
                    id="oauth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={emailDigitado}
                    disabled={carregando}
                    onChange={(evento) => setEmailDigitado(evento.target.value)}
                    className="h-11 text-base"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={carregando}>
                  {carregando ? 'Enviando...' : 'Enviar código'}
                </Button>
              </form>
            ) : estado && etapa === 'otp' ? (
              <form className="space-y-4" onSubmit={aoEnviarCodigo} noValidate>
                {estado.mensagem ? <Alerta>{estado.mensagem}</Alerta> : null}
                <div className="space-y-2">
                  <Label htmlFor="oauth-codigo">Código de 6 dígitos</Label>
                  <Input
                    id="oauth-codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={codigoDigitado}
                    disabled={carregando}
                    onChange={(evento) => setCodigoDigitado(evento.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-11 text-center text-lg tracking-[0.4em]"
                  />
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {restanteMs === 0
                    ? 'O tempo deste código acabou. Você pode enviá-lo mesmo assim ou pedir outro.'
                    : `Tempo restante: ${formatarTempo(restanteMs ?? DURACAO_OTP_MS)}`}
                </p>
                <Button type="submit" size="lg" className="w-full" disabled={carregando}>
                  {carregando ? 'Validando...' : 'Continuar'}
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={carregando}
                    onClick={() => { void solicitarCodigo(estado.email); }}
                  >
                    Pedir outro código
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" disabled={carregando} onClick={voltar}>
                    Trocar e-mail
                  </Button>
                </div>
              </form>
            ) : estado ? (
              <Consentimento
                scope={estado.parametros.scope}
                mensagem={estado.mensagem}
                carregando={carregando}
                onAutorizar={() => { void autorizar(); }}
                onRecusar={recusar}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Passos({ etapa, bloqueado }: { etapa: EstadoFluxo['etapa']; bloqueado: boolean }) {
  const passos = [
    { id: 'email', rotulo: 'E-mail' },
    { id: 'otp', rotulo: 'Código' },
    { id: 'consentimento', rotulo: 'Acesso' },
  ] as const;
  const atual = passos.findIndex((passo) => passo.id === etapa);

  return (
    <ol className="grid grid-cols-3 gap-2">
      {passos.map((passo, indice) => {
        const ativo = !bloqueado && indice === atual;
        const feito = !bloqueado && indice < atual;
        return (
          <li
            key={passo.id}
            aria-current={ativo ? 'step' : undefined}
            className={`rounded-md border px-2 py-2 text-center text-xs font-medium ${
              ativo
                ? 'border-primary bg-primary/10 text-primary'
                : feito
                  ? 'border-border bg-muted text-foreground'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {indice + 1}. {passo.rotulo}
          </li>
        );
      })}
    </ol>
  );
}

function Alerta({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function Consentimento({
  scope,
  mensagem,
  carregando,
  onAutorizar,
  onRecusar,
}: {
  scope: string;
  mensagem: string | null;
  carregando: boolean;
  onAutorizar: () => void;
  onRecusar: () => void;
}) {
  const scopes = scopesParaConsentimento(scope);
  if (!scopes.ok) return <Alerta>{scopes.mensagem}</Alerta>;

  return (
    <div className="space-y-4">
      {mensagem ? <Alerta>{mensagem}</Alerta> : null}
      <p className="text-sm text-muted-foreground">Se você autorizar, o aplicativo poderá:</p>
      <ul className="space-y-2">
        {scopes.itens.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-border bg-muted/50 px-3 py-3 text-sm text-foreground"
          >
            {item.rotulo}
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
        <Button type="button" size="lg" className="w-full" disabled={carregando} onClick={onAutorizar}>
          {carregando ? 'Autorizando...' : 'Autorizar'}
        </Button>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled={carregando} onClick={onRecusar}>
          Recusar
        </Button>
      </div>
    </div>
  );
}

export default function PaginaAutorizarOAuth() {
  return (
    <Suspense
      fallback={(
        <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-sm text-muted-foreground">
          Carregando autorização...
        </main>
      )}
    >
      <AutorizarConteudo />
    </Suspense>
  );
}
