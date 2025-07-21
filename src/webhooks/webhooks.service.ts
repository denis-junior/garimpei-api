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
      accessToken: process.env.MP_ACCESS_TOKEN,
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
        payer_email: mpPayment.payer?.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: mpPayment.metadata,
      });

      // Buscar transação no banco pelo payment_id
      const transaction = await this.transactionRepository.findOne({
        where: { payment_id: paymentId },
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

          await this.transactionRepository.save(transaction);

          console.log(`✅ Status da transação atualizado:`, {
            transaction_id: transaction.id,
            payment_id: paymentId,
            status_anterior: statusAnterior,
            status_novo: statusNovo,
            vendedor_id: transaction.vendedor_id,
            valor_total: transaction.valor_total,
          });

          // Aqui você pode adicionar lógica adicional baseada no status:
          if (statusNovo === 'approved') {
            console.log(
              `💰 Pagamento aprovado! Pode liberar o produto/serviço.`,
            );
            // TODO: Enviar email para vendedor, atualizar estoque, etc.
          } else if (statusNovo === 'rejected') {
            console.log(`❌ Pagamento rejeitado! Cancelar pedido.`);
            // TODO: Notificar vendedor, liberar estoque, etc.
          } else if (statusNovo === 'pending') {
            console.log(`⏳ Pagamento pendente. Aguardando processamento.`);
            // TODO: Notificar sobre pendência
          }
        } else {
          console.log(
            `ℹ️ Status não mudou (${statusNovo}). Nenhuma ação necessária.`,
          );
        }
      } else {
        console.log(
          `⚠️ Transação não encontrada no banco para payment_id: ${paymentId}`,
        );
        console.log(
          `💡 Isso pode acontecer se o webhook chegar antes do processamento inicial.`,
        );
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
}
