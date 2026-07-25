export class ApiResponse<D = unknown> {
  statusCode: number;
  message: string;
  data: D;
  success: boolean;

  constructor(
    statusCode: number,
    data: D,
    message: string = "Success"
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success = statusCode < 400;
  }
}