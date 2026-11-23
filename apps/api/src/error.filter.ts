import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

/** The part of the Express response the filter uses. */
interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

const BY_STATUS: Record<number, string> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

/**
 * Every error from our routes is `{ code, params }`, never human-readable text: clients
 * translate the code. Better Auth's own routes (/api/auth/*) answer before Nest and keep
 * their `{ code, message }`.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { code?: unknown }).code === 'string'
      ) {
        const { code, params } = body as { code: string; params?: Record<string, unknown> };
        response.status(status).json({ code, params: params ?? {} });
        return;
      }
      response.status(status).json({ code: BY_STATUS[status] ?? `HTTP_${status}`, params: {} });
      return;
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    response.status(500).json({ code: 'INTERNAL', params: {} });
  }
}
