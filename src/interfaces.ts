export interface IAuthRequest extends Request {
  user: { userId: number; email: string; seller: boolean };
}

export interface IRequestWithUser extends Request {
  user: { userId: number; email: string; seller: boolean; sub: string };
}
