import { HttpExceptionFilter } from "./http-exception.filter";
import { HttpException, HttpStatus } from "@nestjs/common";

function createHostMock() {
  const jsonFn = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
  const response = { status: statusFn };
  const request = { method: "PATCH", url: "/api/auth/me" };

  return {
    response,
    request,
    jsonFn,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as import("@nestjs/common").ArgumentsHost,
  };
}

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it("should return 413 for PayloadTooLargeError (entity.too.large)", () => {
    const { host, response, jsonFn } = createHostMock();
    const error = new Error("request entity too large");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).type = "entity.too.large";

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("excede o limite"),
      }),
    );
  });

  it("should return 413 for error with statusCode 413", () => {
    const { host, response, jsonFn } = createHostMock();
    const error = new Error("payload too large");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).statusCode = 413;

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("excede o limite"),
      }),
    );
  });

  it("should return 500 for generic non-HttpException errors", () => {
    const { host, response, jsonFn } = createHostMock();
    const error = new Error("something broke");

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Erro interno do servidor.",
      }),
    );
  });

  it("should return the correct status for HttpException (400)", () => {
    const { host, response, jsonFn } = createHostMock();
    const error = new HttpException("Bad Request", 400);

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Bad Request",
      }),
    );
  });
});
