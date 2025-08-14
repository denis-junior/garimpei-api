import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: TUser): TUser | null {
    if (err) return null;
    // Retorna o user se existir; senão, segue como não autenticado
    return user || null;
  }
}
