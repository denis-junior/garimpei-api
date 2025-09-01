import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { Transaction } from '../transactions/transaction.entity';
import { Seller } from '../seller/seller.entity';
import axios from 'axios';

@Injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private payment: Payment;
  private preference: Preference;

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Seller)
    private sellerRepository: Repository<Seller>,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN_PROD,
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

  // Buscar vendedor por ID (corrigido o tipo)
  async buscarVendedorPorId(vendedorId: string) {
    const vendedor = await this.sellerRepository.findOne({
      where: { id: Number(vendedorId) }, // Se id for string, está correto
    });

    if (!vendedor) {
      throw new Error('Vendedor não encontrado');
    }

    return vendedor;
  }

  // SPLIT AUTOMÁTICO CORRIGIDO
  async processarPagamentoComSplit(dadosPagamento: any) {
    try {
      // Buscar vendedor no banco
      const vendedor = await this.buscarVendedorPorId(
        dadosPagamento.vendedor_id,
      );

      if (!vendedor.mp_access_token) {
        throw new Error(
          'Vendedor precisa conectar conta do Mercado Pago primeiro',
        );
      }

      // Gerar ID único para correlacionar com seu sistema
      const externalReference = `${Date.now()}-${dadosPagamento.vendedor_id}-${Math.random().toString(36).substr(2, 9)}`;

      // Criar cliente com token do vendedor
      const clienteVendedor = new MercadoPagoConfig({
        accessToken: vendedor.mp_access_token,
      });
      const paymentVendedor = new Payment(clienteVendedor);

      const paymentData = {
        transaction_amount: dadosPagamento.valor,
        token: dadosPagamento.token,
        description: dadosPagamento.descricao,
        external_reference: externalReference, // ✅ ID único para correlação
        payer: {
          email: dadosPagamento.email_comprador,
        },
        installments: dadosPagamento.installments || 1,
        // SUA COMISSÃO (vai para sua conta)
        application_fee: dadosPagamento.comissao,
        notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id,
          tipo_pagamento: 'split_automatico',
          external_reference: externalReference,
          produto_id: dadosPagamento.produto_id, // Se houver
          auction_id: dadosPagamento.auction_id, // Se for leilão
        },
      };

      console.log('🔄 Processando split automático:', {
        external_reference: externalReference,
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: dadosPagamento.valor,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: dadosPagamento.valor - dadosPagamento.comissao,
      });

      // Processar pagamento na conta do vendedor
      const response = await paymentVendedor.create({ body: paymentData });

      // Salvar transação com external_reference
      const transaction = this.transactionRepository.create({
        payment_id: response.id.toString(),
        external_reference: externalReference, // ✅ Salvar referência única
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: response.transaction_amount,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: response.transaction_amount - dadosPagamento.comissao,
        status: response.status,
        descricao: dadosPagamento.descricao,
        email_comprador: dadosPagamento.email_comprador,
        tipo_pagamento: 'split_automatico',
        metadata_pagamento: response,
      });

      await this.transactionRepository.save(transaction);

      console.log('✅ Split automático processado:', {
        external_reference: externalReference,
        payment_id: response.id,
        status: response.status,
        vendedor_recebe: response.transaction_amount - dadosPagamento.comissao,
        plataforma_recebe: dadosPagamento.comissao,
      });

      return {
        success: true,
        payment_id: response.id,
        external_reference: externalReference, // ✅ Retornar para o frontend
        status: response.status,
        valor_total: response.transaction_amount,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: response.transaction_amount - dadosPagamento.comissao,
        response,
      };
    } catch (error) {
      console.error('❌ Erro no split automático:', error);
      throw new Error(`Erro no split: ${error.message}`);
    }
  }

  // Métodos que faltavam no controller
  async buscarTransacoesVendedor(vendedorId: string) {
    try {
      const transacoes = await this.transactionRepository.find({
        where: { vendedor_id: vendedorId },
        order: { created_at: 'DESC' },
      });

      return transacoes;
    } catch (error) {
      throw new Error(`Erro ao buscar transações: ${error.message}`);
    }
  }

  async buscarSaldoVendedor(vendedorId: string) {
    try {
      const transacoes = await this.transactionRepository.find({
        where: { vendedor_id: vendedorId },
        order: { created_at: 'DESC' },
      });

      const saldo = transacoes.reduce((acc, transacao) => {
        return acc + (Number(transacao.valor_vendedor) || 0);
      }, 0);

      return { vendedor_id: vendedorId, saldo };
    } catch (error) {
      throw new Error(`Erro ao buscar saldo: ${error.message}`);
    }
  }

  async buscarTodasTransacoes() {
    try {
      const transacoes = await this.transactionRepository.find({
        order: { created_at: 'DESC' },
      });

      return transacoes;
    } catch (error) {
      throw new Error(`Erro ao buscar todas as transações: ${error.message}`);
    }
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
    const redirectUri = process.env.MP_REDIRECT_URI;
    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${process.env.MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${vendedorId}&redirect_uri=${redirectUri}`;
    return authUrl;
  }

  async processarConexaoVendedor(code: string, vendedorId: string) {
    try {
      const response = await axios.post(
        'https://api.mercadopago.com/oauth/token',
        {
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.MP_REDIRECT_URI,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const result = response.data;

      if (result.access_token) {
        // Salvar tokens no banco
        await this.salvarTokenVendedor(
          vendedorId,
          result.access_token,
          result.refresh_token,
        );

        console.log(`✅ Vendedor ${vendedorId} conectado com sucesso`);
        return {
          success: true,
          message: 'Conta do Mercado Pago conectada com sucesso!',
        };
      } else {
        throw new Error('Falha na autenticação');
      }
    } catch (error) {
      console.error('❌ Erro ao conectar vendedor:', error);
      throw new Error(`Erro ao conectar vendedor: ${error.message}`);
    }
  }

  // Salvar access_token do vendedor após OAuth
  async salvarTokenVendedor(
    vendedorId: string,
    accessToken: string,
    refreshToken: string,
  ) {
    try {
      await this.sellerRepository.update(vendedorId, {
        mp_access_token: accessToken,
        mp_refresh_token: refreshToken,
        mp_conectado: true,
        mp_conectado_em: new Date(),
      });

      console.log(`✅ Token salvo para vendedor ${vendedorId}`);
      return true;
    } catch (error) {
      throw new Error(`Erro ao salvar token: ${error.message}`);
    }
  }

  // Verificar se vendedor tem conta conectada
  async verificarConexaoVendedor(vendedorId: string) {
    const vendedor = await this.buscarVendedorPorId(vendedorId);
    return {
      conectado: !!vendedor.mp_access_token,
      link_conexao: vendedor.mp_access_token
        ? null
        : this.gerarLinkConexaoVendedor(vendedorId),
    };
  }

  // Adicionar método público para buscar pagamento
  async buscarPagamento(paymentId: string) {
    try {
      const payment = await this.payment.get({ id: paymentId });
      return {
        success: true,
        payment,
      };
    } catch (error) {
      throw new Error(`Erro ao buscar pagamento: ${error.message}`);
    }
  }

  // Buscar transação por external_reference
  async buscarTransacaoPorExternalReference(externalReference: string) {
    try {
      const transacao = await this.transactionRepository.findOne({
        where: { external_reference: externalReference },
      });

      if (!transacao) {
        throw new Error('Transação não encontrada');
      }

      return transacao;
    } catch (error) {
      throw new Error(`Erro ao buscar transação: ${error.message}`);
    }
  }

  // Correlacionar payment_id do MP com ID interno
  async correlacionarPagamento(paymentId: string) {
    try {
      const transacao = await this.transactionRepository.findOne({
        where: { payment_id: paymentId.toString() },
      });

      if (!transacao) {
        throw new Error('Transação não encontrada para este payment_id');
      }

      return {
        payment_id: paymentId,
        external_reference: transacao.external_reference,
        internal_id: transacao.id,
        vendedor_id: transacao.vendedor_id,
        status: transacao.status,
        valor_total: transacao.valor_total,
      };
    } catch (error) {
      throw new Error(`Erro na correlação: ${error.message}`);
    }
  }
}
