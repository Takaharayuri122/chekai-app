import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

interface ApiResponse<T> {
  data: T;
  timestamp: string;
  success: boolean;
}

function caminhoSemQuery(valor: string): string {
  const caminho = valor.split('?')[0];
  return caminho.startsWith('/') ? caminho : `/${caminho}`;
}

/** Discovery e token OAuth precisam do JSON na raiz; o envelope `{ data, success }` quebra o protocolo. */
function respostaOauthSemEnvelope(req: Request | undefined): boolean {
  const candidatos = [req?.path, req?.originalUrl, req?.url].filter(
    (valor): valor is string => typeof valor === 'string' && valor.length > 0,
  );
  return candidatos.some((valor) => {
    const caminho = caminhoSemQuery(valor);
    return caminho === '/oauth'
      || caminho.startsWith('/oauth/')
      || caminho.startsWith('/.well-known/oauth-');
  });
}

/**
 * Interceptor para padronizar respostas da API.
 * Envolve todas as respostas em um formato consistente.
 * Não envolve quando a resposta já foi enviada manualmente (@Res()) ou é binária (StreamableFile).
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data: T) => {
        const res = context.switchToHttp().getResponse<Response>();
        if (res.headersSent) {
          return data as ApiResponse<T> | T;
        }
        if (data instanceof StreamableFile) {
          return data;
        }
        const req = context.switchToHttp().getRequest<Request>();
        if (respostaOauthSemEnvelope(req)) {
          return data;
        }
        return {
          data,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }),
    );
  }
}

