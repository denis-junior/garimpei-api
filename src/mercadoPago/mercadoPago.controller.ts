import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { MercadoPagoService } from './mercadoPago.service';

@Controller('mercadopago')
export class MercadoPagoController {
  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  // ETAPA 5: Processar pagamento (agora salva no banco)
  @Post('processar-pagamento')
  async processarPagamento(@Body() dados: any) {
    return await this.mercadoPagoService.processarPagamento(dados);
  }

  // ETAPA 5: Buscar transações de um vendedor
  @Get('transacoes/:vendedorId')
  async buscarTransacoesVendedor(@Param('vendedorId') vendedorId: string) {
    return await this.mercadoPagoService.buscarTransacoesVendedor(vendedorId);
  }

  // ETAPA 5: Buscar todas as transações (admin)
  @Get('admin/transacoes')
  async buscarTodasTransacoes() {
    return await this.mercadoPagoService.buscarTodasTransacoes();
  }

  // Manter endpoints existentes
  @Post('gerar-token-teste')
  async gerarTokenTeste(@Body() dadosCartao: any) {
    return await this.mercadoPagoService.gerarTokenTeste(dadosCartao);
  }
}
