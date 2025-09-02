import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { Transaction } from '../transactions/transaction.entity';
import { Seller } from '../seller/seller.entity';
// ✅ IMPORTAR O AUTH SERVICE
import { MercadoPagoOAuthService } from './mercadoPago.authService';

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
    // ✅ INJETAR O AUTH SERVICE
    private readonly oauthService: MercadoPagoOAuthService,
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
      // ✅ GERAR external_reference para o método antigo também
      const externalReference = `${Date.now()}-${dadosPagamento.vendedor_id}-${Math.random().toString(36).substr(2, 9)}`;

      const paymentData = {
        transaction_amount: dadosPagamento.valor,
        token: dadosPagamento.token,
        description: dadosPagamento.descricao,
        external_reference: externalReference, // ✅ ADICIONAR
        payer: {
          email: dadosPagamento.email_comprador,
        },
        installments: dadosPagamento.installments || 1,
        notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id,
          comissao_plataforma: dadosPagamento.comissao,
        },
      };

      console.log('🔄 Processando pagamento:', paymentData);

      const response = await this.payment.create({ body: paymentData });

      // Calcular valores
      const taxaMercadoPago = response.fee_details?.[0]?.amount || 0;
      const valorLiquido = response.transaction_amount - taxaMercadoPago;
      const comissaoPlataforma = dadosPagamento.comissao || 0;
      const valorVendedor = valorLiquido - comissaoPlataforma;

      // ✅ SALVAR COM external_reference
      const transaction = this.transactionRepository.create({
        payment_id: response.id.toString(),
        external_reference: externalReference, // ✅ ADICIONAR
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: response.transaction_amount,
        taxa_mercadopago: taxaMercadoPago,
        valor_liquido: valorLiquido,
        comissao_plataforma: comissaoPlataforma,
        valor_vendedor: valorVendedor,
        status: response.status,
        descricao: dadosPagamento.descricao,
        email_comprador: dadosPagamento.email_comprador,
        tipo_pagamento: 'pagamento_normal',
        metadata_pagamento: response,
      });

      await this.transactionRepository.save(transaction);

      console.log('✅ Pagamento processado:', {
        payment_id: response.id,
        external_reference: externalReference, // ✅ LOG
        status: response.status,
      });

      return response;
    } catch (error) {
      console.error('❌ Erro ao processar pagamento:', error);
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
      const vendedor = await this.buscarVendedorPorId(
        dadosPagamento.vendedor_id,
      );

      // ✅ VERIFICAR E RENOVAR TOKEN SE NECESSÁRIO
      const tokenValido = await this.verificarEValidarToken(
        dadosPagamento.vendedor_id,
      );

      // Gerar ID único para correlacionar
      const externalReference = `${Date.now()}-${dadosPagamento.vendedor_id}-${Math.random().toString(36).substr(2, 9)}`;

      // Usar token válido/renovado
      const clienteVendedor = new MercadoPagoConfig({
        accessToken: tokenValido,
      });
      const paymentVendedor = new Payment(clienteVendedor);

      const paymentData = {
        transaction_amount: dadosPagamento.valor,
        token: dadosPagamento.token,
        description: dadosPagamento.descricao,
        external_reference: externalReference,
        payer: {
          email: dadosPagamento.email_comprador,
        },
        installments: dadosPagamento.installments || 1,
        application_fee: dadosPagamento.comissao,
        notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id,
          tipo_pagamento: 'split_automatico',
          external_reference: externalReference,
        },
      };

      console.log('🔄 Processando split automático com token válido:', {
        external_reference: externalReference,
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: dadosPagamento.valor,
        comissao_plataforma: dadosPagamento.comissao,
      });

      const response = await paymentVendedor.create({ body: paymentData });

      // Salvar transação
      const transaction = this.transactionRepository.create({
        payment_id: response.id.toString(),
        external_reference: externalReference,
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

      return {
        success: true,
        payment_id: response.id,
        external_reference: externalReference,
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

  // ✅ USAR O AUTH SERVICE EM VEZ DO CÓDIGO DUPLICADO
  gerarLinkConexaoVendedor(vendedorId: string) {
    const baseUrl = this.oauthService.generateAuthUrl();
    return `${baseUrl}&state=${vendedorId}`;
  }

  // ✅ USAR O AUTH SERVICE PARA TROCAR CODE POR TOKEN
  async processarConexaoVendedor(code: string, vendedorId: string) {
    try {
      console.log('🔄 Processando conexão OAuth:', { code, vendedorId });

      // ✅ USAR O MÉTODO DO AUTH SERVICE
      const result = await this.oauthService.exchangeCodeForToken(code);

      if (result.access_token) {
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
        throw new Error(`Falha na autenticação: ${JSON.stringify(result)}`);
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
      // ✅ CALCULAR DATA DE EXPIRAÇÃO (6 meses)
      const dataExpiracao = new Date();
      dataExpiracao.setMonth(dataExpiracao.getMonth() + 6);

      const result = await this.sellerRepository.update(
        { id: Number(vendedorId) },
        {
          mp_access_token: accessToken,
          mp_refresh_token: refreshToken,
          mp_conectado: true,
          mp_conectado_em: new Date(),
          mp_token_expira_em: dataExpiracao, // ✅ SALVAR EXPIRAÇÃO
          mp_ultimo_uso: new Date(),
        },
      );

      if (result.affected === 0) {
        throw new Error('Vendedor não encontrado');
      }

      console.log(
        `✅ Token salvo para vendedor ${vendedorId} (expira em: ${dataExpiracao.toISOString()})`,
      );
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar token:', error);
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

  // Verificar se token está válido antes de usar
  async verificarEValidarToken(vendedorId: string) {
    try {
      const vendedor = await this.buscarVendedorPorId(vendedorId);

      if (!vendedor.mp_access_token) {
        throw new Error('Vendedor não tem token');
      }

      // Testar se token ainda é válido fazendo uma chamada simples
      const cliente = new MercadoPagoConfig({
        accessToken: vendedor.mp_access_token,
      });

      try {
        // Fazer uma chamada de teste para verificar validade
        const payment = new Payment(cliente);
        await payment.search({
          options: {
            limit: 1,
          },
        });

        console.log(`✅ Token do vendedor ${vendedorId} ainda válido`);
        return vendedor.mp_access_token;
      } catch (tokenError) {
        console.log(
          `⚠️ Token expirado para vendedor ${vendedorId}, renovando...`,
        );

        if (vendedor.mp_refresh_token) {
          // Renovar token automaticamente
          const novoToken = await this.oauthService.refreshToken(
            vendedor.mp_refresh_token,
          );

          await this.salvarTokenVendedor(
            vendedorId,
            novoToken.access_token,
            novoToken.refresh_token,
          );

          console.log(`✅ Token renovado para vendedor ${vendedorId}`);
          return novoToken.access_token;
        } else {
          throw new Error(
            'Token expirado e sem refresh token. Vendedor precisa reconectar.',
          );
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar token:`, error);
      throw new Error(`Erro ao verificar token: ${error.message}`);
    }
  }
}
