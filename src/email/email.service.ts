import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Clothing } from '../clothing/clothing.entity';
import { Buyer } from '../buyer/buyer.entity';
import { formatPhoneNumber } from 'src/utils';

export interface AuctionWinnerEmailData {
  winner: Buyer;
  clothing: Clothing;
  winningBid: number;
  auctionEndDate: string;
  auctionEndTime: string;
}

export interface PaymentWarningEmailData {
  seller: {
    name: string;
    email: string;
  };
  clothing: Clothing;
  winner: Buyer;
  winningBid: number;
  daysWaiting: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter(): void {
    const emailConfig = {
      host: this.configService.get<string>('EMAIL_HOST') ?? '',
      port: this.configService.get<number>('EMAIL_PORT') ?? 587,
      secure: this.configService.get<string>('EMAIL_PORT') === '465', // true para porta 465, false para outras portas
      requireTLS: true, // Força STARTTLS para porta 587
      auth: {
        user: this.configService.get<string>('EMAIL_USER') ?? '',
        pass: this.configService.get<string>('EMAIL_PASS') ?? '',
      },
      tls: {
        rejectUnauthorized: false, // Para desenvolvimento
        ciphers: 'SSLv3',
      },
    };

    // Validar se as configurações existem
    if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
      this.logger.error('❌ Configurações de email não encontradas no .env');
      throw new Error('Email configuration missing');
    }

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verificar conexão
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('✅ Conexão com servidor de email estabelecida');
    } catch (error) {
      this.logger.error('❌ Erro na conexão com servidor de email:', error);
    }
  }

  async sendAuctionWinnerEmail(data: AuctionWinnerEmailData): Promise<void> {
    try {
      // Validar dados de entrada
      if (!data.winner?.email) {
        throw new Error('Email do vencedor não encontrado');
      }

      const htmlContent = this.generateAuctionWinnerTemplate(data);

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: data.winner.email,
        subject: `🎉 Parabéns! Você ganhou o leilão: ${data.clothing.name}`,
        html: htmlContent,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `✅ Email enviado para o vencedor ${data.winner.email} do leilão ${data.clothing.id}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.debug(`📧 Message ID: ${result.messageId}`);
    } catch (error) {
      this.logger.error(
        `❌ Erro ao enviar email para ${data.winner?.email}:`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message,
      );

      // Não fazer throw para não quebrar o fluxo principal
      // throw error;
    }
  }

  async sendPaymentWarningToSeller(
    data: PaymentWarningEmailData,
  ): Promise<void> {
    try {
      const htmlContent = this.generatePaymentWarningTemplate(data);

      const mailOptions = {
        from:
          this.configService.get<string>('EMAIL_FROM') ||
          'noreply@garimpei.com',
        to: data.seller.email,
        subject: `⚠️ Pagamento Pendente - Leilão: ${data.clothing.name}`,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `📧 Email de aviso de pagamento enviado para seller ${data.seller.email} - Clothing ${data.clothing.id}`,
      );

      if (process.env.NODE_ENV !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) {
          this.logger.log(`🔗 Preview do email: ${previewUrl}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Erro ao enviar email de aviso para seller ${data.seller?.email}:`,
        error.message,
      );
      throw error;
    }
  }

  async sendSecondChanceEmail(
    data: AuctionWinnerEmailData & { attemptNumber: number },
  ): Promise<void> {
    try {
      const htmlContent = this.generateSecondChanceTemplate(data);

      const mailOptions = {
        from:
          this.configService.get<string>('EMAIL_FROM') ||
          'noreply@garimpei.com',
        to: data.winner.email,
        subject: `🎉 Segunda Chance! Você ganhou o leilão: ${data.clothing.name}`,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `📧 Email de segunda chance (tentativa ${data.attemptNumber}) enviado para ${data.winner.email} - Clothing ${data.clothing.id}`,
      );

      if (process.env.NODE_ENV !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) {
          this.logger.log(`🔗 Preview do email: ${previewUrl}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Erro ao enviar email de segunda chance para ${data.winner?.email}:`,
        error.message,
      );
      throw error;
    }
  }

  private generateAuctionWinnerTemplate(data: AuctionWinnerEmailData): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Você ganhou o leilão!</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f5f6fa;
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        color: #2f3640;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .header {
        background-color: #4cd137;
        color: #fff;
        text-align: center;
        padding: 30px 20px 20px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .header h2 {
        margin: 10px 0 0;
        font-size: 18px;
        font-weight: normal;
      }
      .content {
        padding: 30px 25px;
      }
      .info-box {
        background-color: #f1f2f6;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .info-box h3 {
        margin-top: 0;
        color: #2f3640;
      }
      .info-box p {
        margin: 6px 0;
        font-size: 14px;
      }
      .bid-amount {
        text-align: center;
        font-size: 22px;
        color: #27ae60;
        font-weight: bold;
        margin: 30px 0;
      }
      .button {
        display: inline-block;
        background-color: #44bd32;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        margin: 0 auto;
        display: block;
        width: fit-content;
      }
      .observation {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeeba;
        padding: 15px 20px;
        border-radius: 8px;
        margin: 30px 0 20px;
        font-size: 14px;
      }
      .footer {
        font-size: 12px;
        color: #7f8c8d;
        text-align: center;
        padding: 20px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Parabéns, ${data.winner.name}!</h1>
        <h2>Você ganhou o leilão!</h2>
      </div>
      <div class="content">
        <div class="info-box">
          <h3>${data.clothing.name}</h3>
          <p><strong>Descrição:</strong> ${data.clothing.description}</p>
          <p><strong>Tamanho:</strong> ${data.clothing.size}</p>
          <p><strong>Encerrado em:</strong> ${data.auctionEndDate} às ${data.auctionEndTime}</p>
        </div>

        <div class="bid-amount">
          Lance vencedor: R$ ${data.winningBid.toFixed(2).toString().replace('.', ',')}
        </div>

        <a href="https://www.instagram.com/${data.clothing?.store?.instagram}" class="button">Entrar em contato com a loja via Instagram</a>

        <div class="observation">
          ⚠️ Atenção: você tem o prazo de <strong>2 dias úteis</strong> para entrar em contato com a loja e concluir o pagamento com o vendedor. Após esse período, o item poderá ser repassado para outro interessado.
        </div>
      </div>

      <div class="footer">
        <p>Obrigado por usar o Garimpei App!</p>
        <p>Este é um e-mail automático. Por favor, não responda.</p>
      </div>
    </div>
  </body>
</html>
    `;
  }

  private generatePaymentWarningTemplate(
    data: PaymentWarningEmailData,
  ): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Pagamento Pendente - Garimpei App</title>
    <style>
      body {
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f6fa;
        color: #2f3640;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .warning-banner {
        background-color: #f39c12;
        color: white;
        text-align: center;
        padding: 18px 20px;
        font-size: 16px;
        font-weight: bold;
      }
      .header {
        text-align: center;
        padding: 30px 20px 10px;
      }
      .header h1 {
        margin: 0;
        font-size: 22px;
        color: #c0392b;
      }
      .header h2 {
        margin: 10px 0 0;
        font-size: 17px;
        font-weight: normal;
        color: #7f8c8d;
      }
      .content {
        padding: 25px;
        font-size: 15px;
        line-height: 1.6;
      }
      .clothing-info {
        background-color: #f1f2f6;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .clothing-info h3 {
        margin-top: 0;
      }
      .bid-amount {
        text-align: center;
        font-size: 20px;
        color: #e74c3c;
        font-weight: bold;
        margin: 20px 0;
      }
      .steps {
        margin-top: 20px;
        padding-left: 20px;
      }
      .steps li {
        margin-bottom: 8px;
      }
      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #7f8c8d;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="warning-banner">
        ⚠️ PAGAMENTO PENDENTE HÁ ${data.daysWaiting} DIA(S)
      </div>

      <div class="header">
        <h1>Olá, ${data.seller.name}!</h1>
        <h2>Pagamento ainda não foi concluído pelo vencedor do leilão</h2>
      </div>

      <div class="content">
        <p>O comprador ainda não realizou o pagamento referente ao item abaixo:</p>

        <div class="clothing-info">
          <h3>Produto: ${data.clothing.name}</h3>
          <p><strong>Descrição:</strong> ${data.clothing.description}</p>
          <p><strong>Vencedor:</strong> ${data.winner.name}</p>
          <p><strong>Email:</strong> ${data.winner.email}</p>
          <p><strong>Contato:</strong> ${formatPhoneNumber(data.winner.contact) || 'Não informado'}</p>
        </div>

        <div class="bid-amount">
          Valor do lance vencedor: R$ ${data.winningBid.toFixed(2)}
        </div>

        <p>🔔 Recomendamos que você entre em contato com o vencedor para confirmar se houve algum problema ou atraso.</p>

        <p><strong>Próximos passos:</strong></p>
        <ul class="steps">
          <li>Entre em contato com o comprador imediatamente</li>
          <li>Caso não haja resposta, o próximo lance será acionado automaticamente em <strong>${2 - data.daysWaiting} dia(s)</strong></li>
        </ul>
      </div>

      <div class="footer">
        <p>Garimpei App</p>
        <p>Este é um e-mail automático, por favor, não responda.</p>
      </div>
    </div>
  </body>
</html>
  `;
  }

  private generateSecondChanceTemplate(
    data: AuctionWinnerEmailData & { attemptNumber: number },
  ): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Segunda Chance - Você ganhou!</title>
    <style>
      body {
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f6fa;
        color: #2f3640;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .second-chance-banner {
        background-color: #3498db;
        color: white;
        text-align: center;
        padding: 18px 20px;
        font-size: 16px;
        font-weight: bold;
      }
      .header {
        text-align: center;
        padding: 30px 20px 10px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        color: #2d3436;
      }
      .header h2 {
        margin: 10px 0 0;
        font-size: 18px;
        font-weight: normal;
        color: #636e72;
      }
      .content {
        padding: 25px;
        font-size: 15px;
        line-height: 1.5;
      }
      .clothing-info {
        background-color: #f1f2f6;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .clothing-info h3 {
        margin-top: 0;
      }
      .bid-amount {
        text-align: center;
        font-size: 22px;
        color: #27ae60;
        font-weight: bold;
        margin: 30px 0 10px;
      }
      .alert {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeeba;
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 20px;
        font-size: 14px;
      }
      .button {
        display: block;
        width: fit-content;
        margin: 20px auto;
        padding: 12px 24px;
        background-color: #44bd32;
        color: #fff;
        text-decoration: none;
        font-weight: bold;
        border-radius: 6px;
        text-align: center;
      }
      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #7f8c8d;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="second-chance-banner">
        🎯 SEGUNDA CHANCE - Tentativa #${data.attemptNumber}
      </div>

      <div class="header">
        <h1>🎉 Boa notícia, ${data.winner.name}!</h1>
        <h2>Você tem uma nova oportunidade de levar este item!</h2>
      </div>

      <div class="content">
        <p>O vencedor anterior não completou o pagamento, então agora você tem a chance de adquirir esta peça exclusiva!</p>

        <div class="clothing-info">
          <h3>Produto: ${data.clothing.name}</h3>
          <p><strong>Descrição:</strong> ${data.clothing.description}</p>
          <p><strong>Tamanho:</strong> ${data.clothing.size}</p>
        </div>

        <div class="bid-amount">
          Seu lance: R$ ${data.winningBid.toFixed(2)}
        </div>

        <div class="alert">
          ⏰ Você tem <strong>48 horas</strong> para realizar o pagamento. Após esse prazo, o item poderá ser oferecido a outro interessado.
        </div>

        <a href="${data.clothing?.store?.instagram}" class="button">Finalizar compra com a loja</a>
      </div>

      <div class="footer">
        <p>Obrigado por usar o Garimpei App!</p>
        <p>Este é um e-mail automático, por favor, não responda.</p>
      </div>
    </div>
  </body>
</html>

  `;
  }
}
