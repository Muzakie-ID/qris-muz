import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { QrisError } from './core';

/** Mengubah QrisError menjadi respons 422 dengan kode yang stabil. */
@Catch(QrisError)
export class QrisErrorFilter implements ExceptionFilter {
  catch(error: QrisError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: error.code,
      message: error.message,
    });
  }
}
