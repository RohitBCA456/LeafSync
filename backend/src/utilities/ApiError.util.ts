export class ApiError<E = unknown, D = unknown> extends Error {
  statusCode: number;
  success: boolean;
  errors: E[];
  data: D | null;

  constructor(
    statusCode: number,
    message: string = "Internal server error",
    errors: E[] = [],
    stack: string = ""
  ) {
    super(message);

    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.data = null;

    if (stack) {
      this.stack = stack;
    } else {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}