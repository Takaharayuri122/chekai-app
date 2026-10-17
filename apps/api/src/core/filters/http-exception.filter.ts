import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  error_description?: string;
}

/**
 * Filtro global para tratamento de exceções HTTP.
 * Padroniza o formato de resposta de erros.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Erro interno do servidor' };

    const corpo = typeof exceptionResponse === 'object' && exceptionResponse
      ? exceptionResponse as { message?: string | string[]; error?: unknown; error_description?: unknown }
      : undefined;
    const erroOauth = typeof corpo?.error === 'string' && typeof corpo.error_description === 'string'
      ? { error: corpo.error, error_description: corpo.error_description }
      : undefined;
    const message = erroOauth
      ? erroOauth.error_description
      : corpo && 'message' in corpo && corpo.message !== undefined
        ? corpo.message
        : 'Erro desconhecido';

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(erroOauth ?? {}),
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : 'Unknown error',
      );
    }

    response.status(status).json(errorResponse);
  }
}

