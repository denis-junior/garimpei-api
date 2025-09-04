import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('mercadopago')
  @HttpCode(200)
  async receberWebhookMercadoPago(
    @Body() notification: { resource: string; topic: string },
  ) {
    try {
      console.log('🔔 Webhook MercadoPago recebido:', notification);

      // ✅ VERIFICAR SE É NOTIFICAÇÃO DE PAGAMENTO
      if (notification.topic === 'payment' && notification.resource) {
        const paymentId = notification.resource;
        console.log(`💳 Processando pagamento: ${paymentId}`);

        // ✅ USAR SEU SERVICE EXISTENTE
        await this.webhooksService.processarNotificacaoPagamento(paymentId);

        return {
          received: true,
          payment_id: paymentId,
          message: 'Webhook processado com sucesso',
        };
      } else {
        console.log('⚠️ Webhook não é de pagamento, ignorando');
        return {
          received: true,
          message: 'Tipo de notificação não processado',
        };
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      return {
        received: false,
        error: error.message,
      };
    }
  }

  // ✅ ENDPOINT ADICIONAL PARA TESTE
  @Post('test')
  @HttpCode(200)
  async testarWebhook(@Body() data: any) {
    console.log('🧪 Teste de webhook:', data);
    return { message: 'Webhook de teste recebido', data };
  }
}
