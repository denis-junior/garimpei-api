import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface AuctionWinnerData {
  winnerName: string;
  winnerPhone: string;
  clothingTitle: string;
  winningBid: number;
  auctionEndDate: string;
  auctionEndTime: string;
  storeAccount: string;
}

interface SecondChanceData {
  winnerName: string;
  winnerPhone: string;
  clothingTitle: string;
  winningBid: number;
  attemptNumber: number;
  storeAccount: string;
}

interface PaymentWarningData {
  sellerName: string;
  sellerPhone: string;
  clothingTitle: string;
  winnerName: string;
  winningBid: number;
  hoursWaiting: number;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baseUrl: string;
  private readonly instanceId: string;
  private readonly token: string;
  private readonly clientToken: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ZAPI_BASE_URL');
    this.instanceId = this.configService.get<string>('ZAPI_INSTANCE_ID');
    this.token = this.configService.get<string>('ZAPI_TOKEN');
    this.clientToken = this.configService.get<string>('ZAPI_CLIENT_TOKEN');
  }

  async sendMessage(phone: string, message: string) {
    try {
      // Validar e formatar número brasileiro
      const formattedPhone = this.formatBrazilianPhone(phone);

      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`;

      const response = await axios.post(
        url,
        {
          phone: formattedPhone,
          message,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'client-token': this.clientToken,
          },
        },
      );

      this.logger.log(`WhatsApp message sent to ${formattedPhone}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message:`, error);
      throw error;
    }
  }

  /**
   * Envia notificação para vencedor do leilão
   */
  async sendAuctionWinnerNotification(data: AuctionWinnerData): Promise<void> {
    const message = `🎉 *Parabéns ${data.winnerName}!*

Você ganhou o leilão! 🏆

📦 *Produto:* ${data.clothingTitle}
💰 *Seu lance vencedor:* R$ ${data.winningBid.toFixed(2)}
📅 *Fim do leilão:* ${data.auctionEndDate} às ${data.auctionEndTime}

⏰ *Próximos passos:*
Você tem 1 hora para confirmar sua compra entrando em contato com a loja!

Instagram da loja: https://www.instagram.com/${data.storeAccount}/

Acesse: https://garimpei-dev.vercel.app/

_Garimpei - Seu lance, sua cena!_`;

    await this.sendMessage(data.winnerPhone, message);
  }

  /**
   * Envia notificação de segunda chance
   */
  async sendSecondChanceNotification(data: SecondChanceData): Promise<void> {
    const message = `🔔 *Segunda Chance - ${data.winnerName}!*

O vencedor anterior não confirmou a compra. Agora é sua vez! 🎯

📦 *Produto:* ${data.clothingTitle}
💰 *Seu lance:* R$ ${data.winningBid.toFixed(2)}
🏆 *Posição:* ${data.attemptNumber}º lugar

⏰ *Você tem 1 hora para confirmar sua compra!*

Instagram da loja: https://www.instagram.com/${data.storeAccount}/

Acesse: https://garimpei-dev.vercel.app/

_Garimpei - Seu lance, sua cena!_`;

    await this.sendMessage(data.winnerPhone, message);
  }

  /**
   * Envia aviso de pagamento pendente para vendedor
   */
  async sendPaymentWarningToSeller(data: PaymentWarningData): Promise<void> {
    const message = `⚠️ *Atenção ${data.sellerName}!*

Pagamento pendente há ${data.hoursWaiting} hora(s).

📦 *Produto:* ${data.clothingTitle}
🏆 *Vencedor:* ${data.winnerName}
💰 *Valor:* R$ ${data.winningBid.toFixed(2)}

Se o pagamento não for confirmado em breve, o produto será oferecido ao próximo colocado.

Acompanhe em: https://garimpei-dev.vercel.app/

_Garimpei - Seu lance, sua cena!_`;

    await this.sendMessage(data.sellerPhone, message);
  }

  /**
   * Formata número brasileiro para WhatsApp (55 + DDD + número)
   */
  private formatBrazilianPhone(phone: string): string {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');

    // Se já tem código do país, retorna
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return cleaned;
    }

    // Se tem 11 dígitos (DDD + número), adiciona 55
    if (cleaned.length === 11) {
      return `55${cleaned}`;
    }

    // Se tem 10 dígitos, adiciona 55 e o 9 no celular
    if (cleaned.length === 10) {
      const ddd = cleaned.substring(0, 2);
      const number = cleaned.substring(2);
      return `55${ddd}9${number}`;
    }

    this.logger.warn(`Invalid phone format: ${phone}`);
    return cleaned;
  }

  /**
   * Verifica se o serviço está conectado
   */
  async checkConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/status`;
      const response = await axios.get(url, {
        headers: { 'client-token': this.clientToken },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return response.data?.connected === true;
    } catch (error) {
      this.logger.error('Error checking WhatsApp connection:', error);
      return false;
    }
  }
}
