import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === "production";

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url: string; method: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : this.isPayloadTooLarge(exception)
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : this.isPayloadTooLarge(exception)
        ? "O payload enviado excede o limite permitido (10 MB). Comprima a imagem ou envie uma URL."
        : "Erro interno do servidor.";

    let message = "Erro inesperado.";
    let errors: string[] | undefined;

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };

      if (Array.isArray(responseObj.message)) {
        errors = responseObj.message;
        message = "Falha de validação nos dados enviados.";
      } else if (typeof responseObj.message === "string") {
        message = responseObj.message;
      } else if (responseObj.error) {
        message = responseObj.error;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} | ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} | ${message}`,
      );
    }

    const responseBody: Record<string, unknown> = {
      success: false,
      message:
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? exceptionResponse
          : status >= 500
            ? "Erro interno do servidor."
            : message,
      errors,
      timestamp: new Date().toISOString(),
    };

    if (!this.isProduction) {
      responseBody.path = request.url;
    }

    response.status(status).json(responseBody);
  }

  private isPayloadTooLarge(exception: unknown): boolean {
    if (typeof exception !== "object" || exception === null) return false;
    const err = exception as Record<string, unknown>;
    return (
      err.type === "entity.too.large" ||
      err.statusCode === HttpStatus.PAYLOAD_TOO_LARGE
    );
  }
}
