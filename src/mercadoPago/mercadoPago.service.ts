import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { Transaction } from '../transactions/transaction.entity';

@Injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private payment: Payment;
  private preference: Preference;

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
    });
    this.payment = new Payment(this.client);
    this.preference = new Preference(this.client);
  }

  // Criar preferência de pagamento (para Checkout Pro)
  async criarPreferencia(dadosVenda: any) {
    try {
      const preferenceData = {
        items: [
          {
            id: dadosVenda.produto_id || 'default-id',
            title: dadosVenda.produto,
            unit_price: dadosVenda.preco,
            quantity: 1,
          },
        ],
        marketplace_fee: dadosVenda.taxaPlataforma || 0,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso`,
          failure: `${process.env.FRONTEND_URL}/pagamento-erro`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },
        auto_return: 'approved',
        // CONFIGURAR WEBHOOK COM NGROK
        notification_url: `https://2abcb9272302.ngrok-free.app/webhooks/mercadopago`,
      };

      const response = await this.preference.create({ body: preferenceData });
      return response;
    } catch (error) {
      throw new Error(`Erro ao criar preferência: ${error.message}`);
    }
  }

  // ETAPA 5: Processar pagamento E salvar no banco (método principal)
  async processarPagamento(dadosPagamento: any) {
    try {
      const paymentData = {
        transaction_amount: dadosPagamento.valor,
        token: dadosPagamento.token,
        description: dadosPagamento.descricao,
        payer: {
          email: dadosPagamento.email_comprador,
        },
        installments: dadosPagamento.installments || 1,
        // ADICIONAR WEBHOOK URL
        notification_url: `https://2abcb9272302.ngrok-free.app/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id || 'vendedor-teste',
          comissao_plataforma: dadosPagamento.comissao || 5,
        },
      };

      // console.log('📤 Enviando pagamento para MercadoPago com webhook:', {
      //   notification_url: paymentData.notification_url,
      //   valor: dadosPagamento.valor,
      //   vendedor: dadosPagamento.vendedor_id,
      // });

      console.log('payment Data:', paymentData);

      // Processar pagamento no MercadoPago
      const response = await this.payment.create({ body: paymentData });

      console.log('✅ Resposta do MercadoPago:', response);

      // CÁLCULO CORRETO - Baseado nos dados reais do MercadoPago
      const valorBruto = response.transaction_amount; // R$ 100.00
      const taxaMercadoPago =
        response.fee_details?.reduce((total, fee) => {
          return total + (fee.amount || 0);
        }, 0) || 0; // Taxa real cobrada pelo MP

      const valorLiquido =
        response.transaction_details?.net_received_amount ||
        valorBruto - taxaMercadoPago; // R$ 94.52

      const comissaoPercentual = dadosPagamento.comissao_percentual || 5; // 5%
      const comissaoPlataforma = (valorLiquido * comissaoPercentual) / 100; // 5% de R$ 94.52 = R$ 14.18
      const valorVendedor = valorLiquido - comissaoPlataforma;

      // Salvar transação no banco
      const transaction = this.transactionRepository.create({
        payment_id: response.id.toString(),
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: valorBruto, // Valor original
        taxa_mercadopago: taxaMercadoPago, // Taxa do MP
        valor_liquido: valorLiquido, // Valor após taxa MP
        comissao_plataforma: comissaoPlataforma, // Sua comissão sobre o líquido
        valor_vendedor: valorVendedor, // O que o vendedor recebe
        status: response.status,
        descricao: dadosPagamento.descricao,
        email_comprador: dadosPagamento.email_comprador,
        metadata_pagamento: response,
      });

      await this.transactionRepository.save(transaction);

      console.log('✅ Cálculo de comissões:', {
        payment_id: response.id,
        vendedor: dadosPagamento.vendedor_id,
        valor_bruto: valorBruto,
        taxa_mercadopago: taxaMercadoPago,
        valor_liquido: valorLiquido,
        comissao_percentual: `${comissaoPercentual}%`,
        comissao_plataforma: comissaoPlataforma,
        valor_vendedor: valorVendedor,
        status: response.status,
      });

      return response;
    } catch (error) {
      console.error('❌ Erro detalhado:', error);
      throw new Error(`Erro ao processar pagamento: ${error.message}`);
    }
  }

  // ETAPA 5: Buscar transações de um vendedor
  async buscarTransacoesVendedor(vendedorId: string) {
    return await this.transactionRepository.find({
      where: { vendedor_id: vendedorId },
      order: { created_at: 'DESC' },
    });
  }

  // ETAPA 5: Buscar todas as transações (para admin)
  async buscarTodasTransacoes() {
    return await this.transactionRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  // Gerar token de cartão para testes (mantemos este)
  async gerarTokenTeste(dadosCartao: any) {
    try {
      const { CardToken } = await import('mercadopago');
      const cardToken = new CardToken(this.client);

      const tokenData = {
        card_number: dadosCartao.numero || '5031433215406351',
        expiration_month: dadosCartao.mes || '11',
        expiration_year: dadosCartao.ano || '2025',
        security_code: dadosCartao.cvv || '123',
        cardholder: {
          name: dadosCartao.nome || 'APRO',
          identification: {
            type: dadosCartao.tipo_doc || 'CPF',
            number: dadosCartao.numero_doc || '12345678909',
          },
        },
      };

      const response = await cardToken.create({ body: tokenData });
      return response;
    } catch (error) {
      throw new Error(`Erro ao gerar token: ${error.message}`);
    }
  }

  // Manter o OAuth para quando for para produção
  gerarLinkConexaoVendedor(vendedorId: string) {
    const redirectUri = `${process.env.API_URL}/mercadopago/callback`;
    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${vendedorId}&redirect_uri=${redirectUri}`;
    return authUrl;
  }

  async processarConexaoVendedor(code: string, vendedorId: string) {
    try {
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.MP_APP_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.API_URL}/mercadopago/callback`,
        }),
      });

      const result = await response.json();
      console.log(`Vendedor ${vendedorId} conectado:`, result);
      return result;
    } catch (error) {
      throw new Error(`Erro ao conectar vendedor: ${error.message}`);
    }
  }
}
