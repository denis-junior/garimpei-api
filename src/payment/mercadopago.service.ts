import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PaymentCreateRequest } from 'mercadopago/dist/clients/payment/create/types';

@Injectable()
export class MercadoPagoService {
  private client: Payment;

  constructor() {
    // A configuração é feita ao instanciar o cliente, conforme a nova documentação.
    const config = new MercadoPagoConfig({
      accessToken:
        process.env.MERCADOPAGO_ACCESS_TOKEN ||
        'dev_24c65fb163bf11ea96500242ac130004',
      options: { timeout: 5000 },
    });

    // O objeto 'Payment' é inicializado com a configuração do cliente.
    this.client = new Payment(config);
  }

  /**
   * Cria um pagamento PIX com split (taxa para o marketplace).
   * @param orderId ID do pedido interno para referência externa.
   * @param data Dados do pagamento.
   */
  async createPayment(
    orderId: number,
    data: {
      amount: number;
      description: string;
      payerEmail: string;
      platformFee: number;
      sellerMpAccountId: string; // ID da conta do vendedor (collector_id)
    },
  ) {
    const paymentPayload: PaymentCreateRequest = {
      transaction_amount: Number(Number(data.amount).toFixed(2)),
      description: data.description,
      payment_method_id: 'pix', // ou 'credit_card'
      payer: {
        email: data.payerEmail,
      },
      // A taxa da aplicação (split) é o valor que sua plataforma retém.
      // O restante do valor é automaticamente direcionado para a conta principal
      // associada ao Access Token (a conta do seu marketplace).
      // A transferência para o vendedor será feita via Payouts posteriormente.
      application_fee: Number(Number(data.platformFee).toFixed(2)),
      // URL para receber notificações de pagamento (webhook).
      notification_url: `${process.env.API_URL}/payment/webhook`,
      // Referência externa para associar o pagamento ao seu pedido.
      external_reference: String(orderId),
      collector_id: Number(data.sellerMpAccountId),
    };

    const payment = await this.client.create({ body: paymentPayload });
    return payment;
  }

  /**
   * Busca os detalhes de um pagamento pelo ID.
   * @param paymentId ID do pagamento no Mercado Pago.
   */
  async getPayment(paymentId: number) {
    return this.client.get({ id: String(paymentId) });
  }
}
