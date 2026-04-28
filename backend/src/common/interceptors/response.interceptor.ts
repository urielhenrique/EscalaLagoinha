import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, Observable } from "rxjs";
import { RESPONSE_MESSAGE_KEY } from "../decorators/response-message.decorator";

type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<{ method: string }>();

    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const defaultMessages: Record<string, string> = {
      GET: "Consulta realizada com sucesso.",
      POST: "Recurso criado com sucesso.",
      PATCH: "Recurso atualizado com sucesso.",
      PUT: "Recurso atualizado com sucesso.",
      DELETE: "Recurso removido com sucesso.",
    };

    const message =
      customMessage ??
      defaultMessages[request.method] ??
      "Operação realizada com sucesso.";

    return next.handle().pipe(
      map((data) => {
        if (
          typeof data === "object" &&
          data !== null &&
          "success" in (data as object)
        ) {
          return data as unknown as ApiSuccessResponse<T>;
        }

        return {
          success: true,
          message,
          data,
        };
      }),
    );
  }
}
