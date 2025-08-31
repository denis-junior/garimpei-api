import { Controller, Post, Body, Headers, Req, Get } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // Endpoint para testar se o webhook está funcionando
  @Get('test')
  test() {
    return {
      message: 'Webhook endpoint funcionando!',
      timestamp: new Date().toISOString(),
      url: 'https://2abcb9272302.ngrok-free.app/webhooks/mercadopago',
    };
  }

  @Post('mercadopago')
  async mercadopagoWebhook(
    @Body() body: any,
    @Headers() headers: any,
    @Req() req: any,
  ) {
    try {
      console.log('🔔 Webhook MercadoPago recebido:', {
        //   timestamp: new Date().toISOString(),
        //   type: body.type,
        //   action: body.action,
        //   data_id: body.data?.id,
        //   headers: {
        //     'user-agent': headers['user-agent'],
        //     'content-type': headers['content-type'],
        //   },
        //   body: body,
        //   query: req.query,
      });

      // Verificar se é notificação de pagamento
      if (body.type === 'payment') {
        console.log(`💳 Processando notificação de pagamento: ${body.data.id}`);
        await this.webhooksService.processarNotificacaoPagamento(body.data.id);
      } else {
        console.log(`ℹ️ Tipo de notificação ignorado: ${body.type}`);
      }

      return { status: 'received', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('❌ Erro no webhook:', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
