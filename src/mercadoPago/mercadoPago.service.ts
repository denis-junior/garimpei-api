import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { Transaction } from '../transactions/transaction.entity';
import { Seller } from '../seller/seller.entity';
// ✅ IMPORTAR O AUTH SERVICE
import { MercadoPagoOAuthService } from './mercadoPago.authService';
import { IPaymentData } from './interfaces';
import { calcularFeesJustos } from './utils';

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
  async processarPagamentoComSplit(dadosPagamento: IPaymentData) {
    try {
      // ✅ VALIDAÇÕES
      if (!dadosPagamento.token) {
        throw new Error('Token de pagamento é obrigatório');
      }

      console.log('🔍 Debug dados recebidos:', {
        token: dadosPagamento.token,
        payment_method_id: dadosPagamento.payment_method_id,
        valor: dadosPagamento.valor,
        vendedor_id: dadosPagamento.vendedor_id,
      });

      const vendedor = await this.buscarVendedorPorId(
        dadosPagamento.vendedor_id,
      );

      if (!vendedor.mp_access_token) {
        throw new Error(
          'Vendedor precisa conectar conta do Mercado Pago primeiro',
        );
      }

      // Gerar ID único para correlacionar
      const externalReference = `${Date.now()}-${dadosPagamento.vendedor_id}-${Math.random().toString(36).substr(2, 9)}`;

      // Criar cliente com token do vendedor
      const clienteVendedor = new MercadoPagoConfig({
        accessToken: vendedor.mp_access_token,
      });
      const paymentVendedor = new Payment(clienteVendedor);

      const paymentData = {
        transaction_amount: dadosPagamento.valor, //total amount clothing
        token: dadosPagamento.token, // card token
        description: dadosPagamento.descricao, //name of clothing
        external_reference: externalReference,
        payer: {
          email: dadosPagamento.email_comprador,
          identification: {
            type: 'CPF',
            number: '02040104208',
          },
          first_name: 'Comprador',
          last_name: 'Sobrenome',
        },
        installments: dadosPagamento.installments || 1,
        // ✅ ADICIONAR payment_method_id se disponível
        ...(dadosPagamento.payment_method_id && {
          payment_method_id: dadosPagamento.payment_method_id,
        }),
        // SUA COMISSÃO (vai para sua conta)
        application_fee: calcularFeesJustos(dadosPagamento.valor, 4),
        notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id,
          tipo_pagamento: 'split_automatico',
          external_reference: externalReference,
          produto_id: dadosPagamento.produto_id,
        },
      };

      console.log('🔄 Processando split automático:', {
        external_reference: externalReference,
        vendedor_id: dadosPagamento.vendedor_id,
        valor_total: dadosPagamento.valor,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: dadosPagamento.valor - dadosPagamento.comissao,
        payment_data: paymentData,
      });

      // Processar pagamento na conta do vendedor
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
        external_reference: externalReference,
        status: response.status,
        valor_total: response.transaction_amount,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: response.transaction_amount - dadosPagamento.comissao,
        response,
      };
    } catch (error) {
      console.error('❌ Erro no split automático:', error);

      // ✅ LOG MAIS DETALHADO DO ERRO
      if (error.cause) {
        console.error('❌ Causa do erro:', error.cause);
      }
      if (error.api_response) {
        console.error('❌ Resposta da API:', error.api_response);
      }

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
      console.log('payment Id ', paymentId);
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

  // PIX sem split automático - usar sua conta principal
  async criarPixSemSplit(dadosPagamento: any) {
    try {
      console.log('🔄 Criando PIX sem split (conta principal)');

      const externalReference = `${Date.now()}-${dadosPagamento.vendedor_id}-${Math.random().toString(36).substr(2, 9)}`;

      // ✅ USAR SUA CONTA PRINCIPAL (não do vendedor)
      const paymentData = {
        transaction_amount: dadosPagamento.valor,
        payment_method_id: 'pix',
        description: dadosPagamento.descricao,
        external_reference: externalReference,
        payer: {
          email: dadosPagamento.email_comprador,
          first_name: 'Comprador',
          last_name: 'PIX',
          identification: {
            type: 'CPF',
            number: '02040104208',
          },
        },
        // ✅ SEM application_fee - PIX não suporta
        notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago`,
        metadata: {
          vendedor_id: dadosPagamento.vendedor_id,
          tipo_pagamento: 'pix_manual_split',
          external_reference: externalReference,
          comissao_plataforma: dadosPagamento.comissao,
        },
      };

      console.log('🔄 Criando PIX na conta principal:', paymentData);

      // ✅ USAR this.payment (sua conta principal)
      const response = await this.payment.create({ body: paymentData });

      // ✅ CAPTURAR QR CODE
      const qrCode = response.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 =
        response.point_of_interaction?.transaction_data?.qr_code_base64;

      // Salvar transação com flag para split manual
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
        tipo_pagamento: 'pix_manual_split', // ✅ MARCAR PARA SPLIT MANUAL
        metadata_pagamento: response,
      });

      await this.transactionRepository.save(transaction);

      console.log('✅ PIX criado (split manual):', {
        payment_id: response.id,
        status: response.status,
        tem_qr_code: !!qrCode,
      });

      return {
        success: true,
        payment_id: response.id,
        external_reference: externalReference,
        status: response.status,
        valor_total: response.transaction_amount,
        comissao_plataforma: dadosPagamento.comissao,
        valor_vendedor: response.transaction_amount - dadosPagamento.comissao,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        tipo_split: 'manual', // ✅ INDICAR QUE É SPLIT MANUAL
        response,
      };
    } catch (error) {
      console.error('❌ Erro ao criar PIX manual:', error);
      throw new Error(`Erro no PIX manual: ${error.message}`);
    }
  }

  // ✅ MÉTODO MELHORADO PARA VERIFICAR CAPACIDADES
  async verificarCapacidadesVendedor(vendedorId: string) {
    try {
      const vendedor = await this.buscarVendedorPorId(vendedorId);

      if (!vendedor.mp_access_token) {
        return {
          conectado: false,
          conta_ativa: false,
          pix_habilitado: false,
          erro: 'Vendedor não conectado',
        };
      }

      const clienteVendedor = new MercadoPagoConfig({
        accessToken: vendedor.mp_access_token,
      });

      const payment = new Payment(clienteVendedor);

      try {
        // ✅ TESTE 1: Verificar se conta está ativa
        console.log(`🔍 Testando conta do vendedor ${vendedorId}...`);

        await payment.search({
          options: { limit: 1 },
        });

        console.log(`✅ Conta do vendedor ${vendedorId} ativa`);

        // ✅ TESTE 2: Tentar criar um pagamento PIX de teste (sem processar)
        let pixHabilitado = false;
        let erroPixDetalhado = null;

        try {
          // Teste específico para PIX
          const testPixData = {
            transaction_amount: 0.01, // Valor mínimo para teste
            payment_method_id: 'pix',
            description: 'Teste PIX - Verificação de capacidades',
            external_reference: `test-pix-${Date.now()}`,
            payer: {
              email: 'teste@garimpei.com',
              first_name: 'Teste',
              last_name: 'PIX',
              identification: {
                type: 'CPF',
                number: '02040104208',
              },
            },
            // ✅ SEM application_fee no teste
            notification_url: `${process.env.WEBHOOK_URL}/webhooks/mercadopago-teste`,
            metadata: {
              tipo: 'teste_capacidades',
              vendedor_id: vendedorId,
            },
          };

          console.log(`🔍 Testando PIX para vendedor ${vendedorId}...`);

          // ✅ NÃO EXECUTAR - APENAS VALIDAR
          // Aqui usaremos uma abordagem diferente: verificar métodos disponíveis
          const { PaymentMethod } = await import('mercadopago');
          const paymentMethod = new PaymentMethod(clienteVendedor);
          const methods = await paymentMethod.get();

          pixHabilitado = methods.some((method) => method.id === 'pix');

          console.log(
            `✅ Métodos disponíveis:`,
            methods.map((m) => m.id),
          );
        } catch (pixError) {
          console.error(`❌ Erro no teste PIX:`, pixError);
          erroPixDetalhado = pixError.message;

          // ✅ VERIFICAR TIPO ESPECÍFICO DO ERRO
          if (pixError.message?.includes('without key enabled')) {
            pixHabilitado = false;
            erroPixDetalhado = 'Conta não habilitada para PIX';
          } else if (pixError.message?.includes('Financial Identity')) {
            pixHabilitado = false;
            erroPixDetalhado = 'Verificação de identidade pendente';
          } else {
            // Outros erros podem não ser relacionados ao PIX
            pixHabilitado = false;
          }
        }

        // ✅ TESTE 3: Verificar se pode receber application_fee
        let splitHabilitado = false;
        try {
          // Verificar se é uma conta de marketplace
          const accountInfo = await payment.search({
            options: { limit: 1 },
          });

          // Se chegou até aqui, provavelmente pode fazer split
          splitHabilitado = true;
        } catch (splitError) {
          console.error('❌ Erro no teste de split:', splitError);
          splitHabilitado = false;
        }

        return {
          conectado: true,
          conta_ativa: true,
          pix_habilitado: pixHabilitado,
          split_habilitado: splitHabilitado,
          metodos_disponiveis:
            await this.getMetodosDisponiveis(clienteVendedor),
          detalhes: {
            vendedor_id: vendedorId,
            token_valido: true,
            erro_pix: erroPixDetalhado,
            testado_em: new Date().toISOString(),
          },
        };
      } catch (contaError) {
        console.error(`❌ Conta inativa:`, contaError);
        return {
          conectado: true,
          conta_ativa: false,
          pix_habilitado: false,
          split_habilitado: false,
          erro: `Conta inativa: ${contaError.message}`,
        };
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar capacidades:`, error);
      return {
        conectado: false,
        conta_ativa: false,
        pix_habilitado: false,
        split_habilitado: false,
        erro: error.message,
      };
    }
  }

  // ✅ MÉTODO AUXILIAR PARA BUSCAR MÉTODOS DISPONÍVEIS
  private async getMetodosDisponiveis(cliente: MercadoPagoConfig) {
    try {
      const { PaymentMethod } = await import('mercadopago');
      const paymentMethod = new PaymentMethod(cliente);
      const methods = await paymentMethod.get();
      return methods.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar métodos:', error);
      return [];
    }
  }

  // Buscar transação por payment_id (ADICIONAR ESTE MÉTODO)
  async buscarTransacaoPorPaymentId(paymentId: string) {
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { payment_id: paymentId.toString() },
      });

      if (!transaction) {
        console.log(
          `⚠️ Transação não encontrada para payment_id: ${paymentId}`,
        );
        return null;
      }

      return transaction;
    } catch (error) {
      console.error('❌ Erro ao buscar transação:', error);
      throw new Error(`Erro ao buscar transação: ${error.message}`);
    }
  }
}
