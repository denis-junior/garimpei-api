import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Transaction } from '../transactions/transaction.entity';

@Injectable()
export class WebhooksService {
  private client: MercadoPagoConfig;
  private payment: Payment;

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN_PROD,
    });
    this.payment = new Payment(this.client);
  }

  async processarNotificacaoPagamento(paymentId: string) {
    try {
      console.log(
        `🔍 Buscando detalhes do pagamento ${paymentId} no MercadoPago...`,
      );

      // Buscar detalhes do pagamento no MercadoPago
      const mpPayment = await this.payment.get({ id: paymentId });

      console.log(`📦 Dados do pagamento:`, {
        id: mpPayment.id,
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        transaction_amount: mpPayment.transaction_amount,
        currency_id: mpPayment.currency_id,
        payment_method_id: mpPayment.payment_method_id, // ✅ PIX ou card
        payer_email: mpPayment.payer?.email,
        external_reference: mpPayment.external_reference, // ✅ IMPORTANTE
        metadata: mpPayment.metadata,
      });

      // Buscar transação no banco pelo payment_id
      const transaction = await this.transactionRepository.findOne({
        where: { payment_id: paymentId.toString() }, // ✅ GARANTIR STRING
      });

      if (transaction) {
        console.log(`📝 Transação encontrada no banco (ID: ${transaction.id})`);

        // Verificar se o status mudou
        const statusAnterior = transaction.status;
        const statusNovo = mpPayment.status;

        if (statusAnterior !== statusNovo) {
          // Atualizar status da transação
          transaction.status = statusNovo;
          transaction.metadata_pagamento = mpPayment;
          transaction.updated_at = new Date();

          await this.transactionRepository.save(transaction);

          console.log(`✅ Status da transação atualizado:`, {
            transaction_id: transaction.id,
            payment_id: paymentId,
            status_anterior: statusAnterior,
            status_novo: statusNovo,
            vendedor_id: transaction.vendedor_id,
            valor_total: transaction.valor_total,
            tipo_pagamento: transaction.tipo_pagamento, // ✅ PIX ou CARD
          });

          // ✅ PROCESSAR AÇÕES BASEADAS NO STATUS E TIPO
          await this.processarAcoesPorStatus(transaction, mpPayment);
        } else {
          console.log(
            `ℹ️ Status não mudou (${statusNovo}). Nenhuma ação necessária.`,
          );
        }
      } else {
        console.log(
          `⚠️ Transação não encontrada no banco para payment_id: ${paymentId}`,
        );

        // ✅ TENTAR BUSCAR POR EXTERNAL_REFERENCE
        if (mpPayment.external_reference) {
          const transactionByRef = await this.transactionRepository.findOne({
            where: { external_reference: mpPayment.external_reference },
          });

          if (transactionByRef) {
            console.log(`📝 Transação encontrada por external_reference`);
            // Atualizar payment_id que pode ter mudado
            transactionByRef.payment_id = paymentId.toString();
            transactionByRef.status = mpPayment.status;
            transactionByRef.metadata_pagamento = mpPayment;
            await this.transactionRepository.save(transactionByRef);
          } else {
            console.log(
              `💡 Isso pode acontecer se o webhook chegar antes do processamento inicial.`,
            );
          }
        }
      }

      return mpPayment;
    } catch (error) {
      console.error(
        `❌ Erro ao processar webhook para pagamento ${paymentId}:`,
        error,
      );
      throw error;
    }
  }

  // ✅ NOVO MÉTODO PARA PROCESSAR AÇÕES ESPECÍFICAS
  private async processarAcoesPorStatus(transaction: any, mpPayment: any) {
    const isPix = mpPayment.payment_method_id === 'pix';
    const isManualSplit = transaction.tipo_pagamento === 'pix_manual_split';

    switch (mpPayment.status) {
      case 'approved':
        console.log('✅ Pagamento aprovado - processando...');

        if (isPix && isManualSplit) {
          console.log(`💰 PIX Manual Split - Agendar transferência:`);
          console.log(
            `   🏪 Vendedor ${transaction.vendedor_id}: R$ ${transaction.valor_vendedor}`,
          );
          console.log(
            `   🏢 Plataforma: R$ ${transaction.comissao_plataforma}`,
          );

          // ✅ MARCAR PARA TRANSFERÊNCIA MANUAL
          await this.agendarTransferenciaManual(transaction);
        } else if (!isPix) {
          console.log(`💳 Cartão - Split automático já processado pelo MP`);
        }

        // ✅ NOTIFICAÇÕES (IMPLEMENTAR DEPOIS)
        // await this.enviarNotificacoes(transaction, 'approved');

        break;

      case 'pending':
        console.log('⏳ Pagamento pendente');
        if (isPix) {
          console.log('   📱 PIX gerado, aguardando pagamento do usuário');
        }
        break;

      case 'rejected':
        console.log('❌ Pagamento rejeitado');
        // ✅ CANCELAR PEDIDO, LIBERAR ESTOQUE
        break;

      case 'cancelled':
        console.log('🚫 Pagamento cancelado');
        // ✅ CANCELAR PEDIDO
        break;

      default:
        console.log(`ℹ️ Status não processado: ${mpPayment.status}`);
    }
  }

  // ✅ MÉTODO CORRIGIDO PARA AGENDAR TRANSFERÊNCIA MANUAL
  private async agendarTransferenciaManual(transaction: Transaction) {
    try {
      transaction.updated_at = new Date();

      // ✅ MARCAR NO METADATA PARA CONTROLE
      const metadata = transaction.metadata_pagamento || {};
      metadata.transfer_status = 'pending_manual';
      metadata.transfer_scheduled_at = new Date().toISOString();
      metadata.requires_manual_transfer = true;

      transaction.metadata_pagamento = metadata;

      await this.transactionRepository.save(transaction);

      console.log(
        `📅 Transferência manual agendada para transação ${transaction.id}`,
      );
      console.log(`💰 Valores:`);
      console.log(
        `   🏪 Para vendedor ${transaction.vendedor_id}: R$ ${transaction.valor_vendedor}`,
      );
      console.log(
        `   🏢 Comissão plataforma: R$ ${transaction.comissao_plataforma}`,
      );
    } catch (error) {
      console.error('❌ Erro ao agendar transferência manual:', error);
    }
  }

  // ✅ MÉTODO PARA BUSCAR STATUS ATUAL
  async verificarStatusPagamento(paymentId: string) {
    try {
      const mpPayment = await this.payment.get({ id: paymentId });
      return {
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        transaction_amount: mpPayment.transaction_amount,
        payment_method_id: mpPayment.payment_method_id,
        date_approved: mpPayment.date_approved,
        payment: mpPayment,
      };
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
      throw new Error(`Erro ao verificar status: ${error.message}`);
    }
  }

  // ✅ ADICIONAR MÉTODO PARA BUSCAR TRANSAÇÃO
  async buscarTransacaoPorPaymentId(paymentId: string) {
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { payment_id: paymentId.toString() },
      });
      return transaction;
    } catch (error) {
      console.error('❌ Erro ao buscar transação:', error);
      throw new Error(`Erro ao buscar transação: ${error.message}`);
    }
  }

  // ✅ MÉTODO AUXILIAR: AGRUPAR TRANSAÇÕES POR VENDEDOR
  private agruparTransferenciasPorVendedor(
    transacoes: Transaction[],
  ): Record<string, Transaction[]> {
    return transacoes.reduce(
      (grupos, transacao) => {
        const vendedorId = transacao.vendedor_id;
        if (!grupos[vendedorId]) {
          grupos[vendedorId] = [];
        }
        grupos[vendedorId].push(transacao);
        return grupos;
      },
      {} as Record<string, Transaction[]>,
    );
  }

  // ✅ CORRIGIR TIPO DO PARÂMETRO
  private async marcarTransacoesComoProcessadas(
    transacoes: Transaction[],
    resultado: {
      success: boolean;
      transactionId?: string;
      status?: string;
      external_reference?: string;
    },
  ) {
    for (const transacao of transacoes) {
      const metadata = transacao.metadata_pagamento || {};
      metadata.transfer_completed = true;
      metadata.transfer_completed_at = new Date().toISOString();
      metadata.transfer_transaction_id = resultado.transactionId;
      metadata.transfer_external_reference = resultado.external_reference;
      metadata.transfer_status = resultado.status || 'completed';
      metadata.transfer_method = 'mercadopago_api';

      transacao.metadata_pagamento = metadata;
      await this.transactionRepository.save(transacao);
    }

    console.log(`✅ ${transacoes.length} transações marcadas como processadas`);
  }
}
