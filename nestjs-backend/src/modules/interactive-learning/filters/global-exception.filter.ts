import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiErrorResponse } from '../dto/interactive-learning.dto';

@Catch()
export class GlobalInteractiveLearningExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    GlobalInteractiveLearningExceptionFilter.name,
  );

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = undefined;

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Validation Error';
      message = 'Input validation failed';
      const zodError = exception as any;
      details = (zodError.issues || zodError.errors || []).map((err: any) => ({
        field: err.path?.join('.') || err.path,
        code: err.code,
        message: err.message,
        expected: err.expected,
        received: err.received,
      }));

      this.logger.warn(`Zod validation failed: ${JSON.stringify(details)}`);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        error = (exceptionResponse as any).error || exception.name;
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details;
      } else {
        error = exception.name;
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      error = exception.name;
      message = exception.message;

      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: ApiErrorResponse = new ApiErrorResponse(
      status,
      error,
      message,
      request.url,
      details,
    );

    response.status(status).json(errorResponse);
  }
}
