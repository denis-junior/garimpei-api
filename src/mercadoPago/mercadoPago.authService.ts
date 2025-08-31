import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MercadoPagoOAuthService {
  private readonly clientId = process.env.MP_CLIENT_ID;
  private readonly clientSecret = process.env.MP_CLIENT_SECRET;
  private readonly redirectUri = process.env.MP_REDIRECT_URI;

  // Gerar URL de autorização para vendedores
  generateAuthUrl(): string {
    const baseUrl = 'https://auth.mercadopago.com.br/authorization';
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: this.redirectUri,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Trocar código por access token
  async exchangeCodeForToken(code: string) {
    try {
      const response = await axios.post(
        'https://api.mercadopago.com/oauth/token',
        {
          client_secret: this.clientSecret,
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter access token: ${error.message}`);
    }
  }

  // Renovar access token
  async refreshToken(refreshToken: string) {
    try {
      const response = await axios.post(
        'https://api.mercadopago.com/oauth/token',
        {
          client_secret: this.clientSecret,
          client_id: this.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`Erro ao renovar token: ${error.message}`);
    }
  }
}
