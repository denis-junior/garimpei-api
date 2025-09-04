import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { MercadoPagoService } from './mercadoPago.service';
import { MercadoPagoOAuthService } from './mercadoPago.authService';
import { IPaymentData } from './interfaces';
import { WebhooksService } from '../webhooks/webhooks.service'; // ✅ IMPORTAR

@Controller('mercadopago')
export class MercadoPagoController {
  constructor(
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly oauthService: MercadoPagoOAuthService,
    private readonly webhooksService: WebhooksService, // ✅ INJETAR
  ) {}

  // Endpoint existente - pagamento sem split
  @Post('processar-pagamento')
  async processarPagamento(@Body() dadosPagamento: any) {
    return await this.mercadoPagoService.processarPagamento(dadosPagamento);
  }

  // NOVO - Endpoint para pagamento com split automático
  @Post('processar-pagamento-split')
  async processarPagamentoComSplit(@Body() dadosPagamento: IPaymentData) {
    return await this.mercadoPagoService.processarPagamentoComSplit(
      dadosPagamento,
    );
  }

  // Atualizar o endpoint existente para ir direto ao PIX manual
  @Post('criar-pix-split')
  async criarPixComSplit(@Body() dadosPagamento: any) {
    try {
      console.log('🔄 Criando PIX (sempre manual para PIX)');

      // ✅ PIX SEMPRE MANUAL (application_fee não funciona com PIX)
      const resultado =
        await this.mercadoPagoService.criarPixSemSplit(dadosPagamento);

      return {
        ...resultado,
        aviso:
          'PIX criado com split manual - application_fee não suportado no PIX',
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro no PIX: ${error.message}`,
      };
    }
  }

  // Buscar transações de um vendedor específico
  @Get('transacoes/vendedor/:vendedorId')
  async buscarTransacoesVendedor(@Param('vendedorId') vendedorId: string) {
    return await this.mercadoPagoService.buscarTransacoesVendedor(vendedorId);
  }

  // Buscar saldo de um vendedor específico
  @Get('transacoes/vendedor/saldo/:vendedorId')
  async buscarSaldoVendedor(@Param('vendedorId') vendedorId: string) {
    return await this.mercadoPagoService.buscarSaldoVendedor(vendedorId);
  }

  // Buscar todas as transações (admin)
  @Get('transacoes')
  async buscarTodasTransacoes() {
    return await this.mercadoPagoService.buscarTodasTransacoes();
  }

  // --- ENDPOINTS PARA OAUTH (CONEXÃO DO VENDEDOR) ---

  // Gerar link para vendedor conectar conta do Mercado Pago
  @Get('conectar/:vendedorId')
  conectarVendedor(@Param('vendedorId') vendedorId: string) {
    const linkConexao =
      this.mercadoPagoService.gerarLinkConexaoVendedor(vendedorId);

    return {
      success: true,
      link_conexao: linkConexao,
      message:
        'Redirecione o vendedor para este link para conectar a conta do Mercado Pago',
    };
  }

  // Callback após vendedor autorizar no Mercado Pago
  @Get('callback')
  async callbackOAuth(
    @Query('code') code: string,
    @Query('state') vendedorId: string,
  ) {
    try {
      console.log('FUI CHAMADO PORRA');
      console.log('DADOS', { code, vendedorId });
      if (!code || !vendedorId) {
        return {
          success: false,
          message: 'Código de autorização ou ID do vendedor não fornecido',
        };
      }

      const resultado = await this.mercadoPagoService.processarConexaoVendedor(
        code,
        vendedorId,
      );

      // Redirecionar para o frontend com sucesso
      return `
        <html>
          <body>
            <script>
              window.opener.postMessage({ success: true, message: 'Conta conectada com sucesso!' }, '*');
              window.close();
            </script>
            <h2>✅ Conta do Mercado Pago conectada com sucesso!</h2>
            <p>Você pode fechar esta janela.</p>
          </body>
        </html>
      `;
    } catch (error) {
      // Redirecionar para o frontend com erro
      return `
        <html>
          <body>
            <script>
              window.opener.postMessage({ success: false, message: '${error.message}' }, '*');
              window.close();
            </script>
            <h2>❌ Erro ao conectar conta</h2>
            <p>${error.message}</p>
          </body>
        </html>
      `;
    }
  }

  // Verificar status da conexão do vendedor
  @Get('status/:vendedorId')
  async verificarStatusVendedor(@Param('vendedorId') vendedorId: string) {
    try {
      const vendedor =
        await this.mercadoPagoService.buscarVendedorPorId(vendedorId);

      if (!vendedor.mp_access_token) {
        const linkConexao =
          this.mercadoPagoService.gerarLinkConexaoVendedor(vendedorId);
        return {
          success: true,
          conectado: false,
          link_conexao: linkConexao,
          message: 'Vendedor precisa conectar conta do Mercado Pago',
        };
      }

      // ✅ VERIFICAR CAPACIDADES TAMBÉM
      const capacidades =
        await this.mercadoPagoService.verificarCapacidadesVendedor(vendedorId);

      return {
        success: true,
        conectado: true,
        conectado_em: vendedor.mp_conectado_em,
        token_expira_em: vendedor.mp_token_expira_em,
        ultimo_uso: vendedor.mp_ultimo_uso,
        // ✅ INCLUIR CAPACIDADES
        ...capacidades,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Endpoint para renovar token (caso expire)
  @Post('renovar-token/:vendedorId')
  async renovarTokenVendedor(@Param('vendedorId') vendedorId: string) {
    try {
      const vendedor =
        await this.mercadoPagoService.buscarVendedorPorId(vendedorId);

      if (!vendedor.mp_refresh_token) {
        throw new Error('Token de renovação não encontrado');
      }

      // ✅ USAR O AUTH SERVICE PARA RENOVAR TOKEN
      const novoToken = await this.oauthService.refreshToken(
        vendedor.mp_refresh_token,
      );

      await this.mercadoPagoService.salvarTokenVendedor(
        vendedorId,
        novoToken.access_token,
        novoToken.refresh_token,
      );

      return {
        success: true,
        message: 'Token renovado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro ao renovar token: ${error.message}`,
      };
    }
  }

  // --- ENDPOINTS UTILITÁRIOS ---

  // Gerar token de cartão para testes
  @Post('gerar-token-cartao')
  async gerarTokenCartao(@Body() dadosCartao: any) {
    return await this.mercadoPagoService.gerarTokenTeste(dadosCartao);
  }

  // Criar preferência (Checkout Pro)
  @Post('criar-preferencia')
  async criarPreferencia(@Body() dadosVenda: any) {
    return await this.mercadoPagoService.criarPreferencia(dadosVenda);
  }

  // Buscar detalhes de um pagamento específico
  @Get('pagamento/:paymentId')
  async buscarPagamento(@Param('paymentId') paymentId: string) {
    try {
      return await this.mercadoPagoService.buscarPagamento(paymentId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Buscar transação por external_reference
  @Get('transacao/referencia/:externalReference')
  async buscarPorExternalReference(
    @Param('externalReference') externalReference: string,
  ) {
    try {
      return await this.mercadoPagoService.buscarTransacaoPorExternalReference(
        externalReference,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Correlacionar payment_id com sistema interno
  @Get('correlacao/:paymentId')
  async correlacionarPagamento(@Param('paymentId') paymentId: string) {
    try {
      return await this.mercadoPagoService.correlacionarPagamento(paymentId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ENDPOINT PARA VERIFICAR CAPACIDADES
  @Get('capacidades/:vendedorId')
  async verificarCapacidades(@Param('vendedorId') vendedorId: string) {
    try {
      const capacidades =
        await this.mercadoPagoService.verificarCapacidadesVendedor(vendedorId);
      return {
        success: true,
        ...capacidades,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ENDPOINT PARA VERIFICAR STATUS USANDO WEBHOOK SERVICE
  @Get('pagamento/status/:paymentId')
  async verificarStatusPagamento(@Param('paymentId') paymentId: string) {
    try {
      // ✅ USAR WEBHOOKS SERVICE
      const transaction =
        await this.webhooksService.buscarTransacaoPorPaymentId(paymentId);

      if (!transaction) {
        return {
          success: false,
          message: 'Transação não encontrada',
        };
      }

      // Buscar status atual no MP
      const statusAtual =
        await this.webhooksService.verificarStatusPagamento(paymentId);

      return {
        success: true,
        payment_id: paymentId,
        status_banco: transaction.status,
        status_mp: statusAtual.status,
        transaction,
        detalhes_mp: statusAtual,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
