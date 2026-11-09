export class AppError extends Error {
  constructor(statusCode, message, code = 'REQUEST_FAILED') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
