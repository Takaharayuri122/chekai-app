import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

interface ApiResponse<T> {
  data: T;
  timestamp: string;
  success: boolean;
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
        return {
          data,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }),
    );
  }
}

