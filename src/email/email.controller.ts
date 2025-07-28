import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { Buyer } from '../buyer/buyer.entity';
import { Clothing } from '../clothing/clothing.entity';

interface AuctionWinnerTestData {
  winner?: {
    name?: string;
    email?: string;
  };
  clothing?: {
    name?: string;
    description?: string;
    size?: string;
  };
  winningBid?: number;
  auctionEndDate?: string;
  auctionEndTime?: string;
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test-auction-winner')
  async testAuctionWinnerEmail(@Body() testData?: AuctionWinnerTestData) {
    // Criar mock do Buyer com todas as propriedades necessárias
    const mockBuyer: Buyer = {
      id: 1,
      name: testData?.winner?.name || 'João Silva',
      email: testData?.winner?.email || 'deni.charl.dj@gmail.com',
      password: 'mockPassword',
      contact: '11999999999',
      instagram: '@joaosilva',
      cpf: '123.456.789-00',
      bids: [], // Array vazio para satisfazer o tipo
    };

    // Criar mock do Clothing com todas as propriedades necessárias
    const mockClothing: Clothing = {
      id: 1,
      name: testData?.clothing?.name || 'Camiseta Vintage',
      description:
        testData?.clothing?.description || 'Uma camiseta retrô incrível',
      size: testData?.clothing?.size || 'M',
      initial_bid: 50.0,
      initial_date: '2025-07-20',
      initial_time: '10:00:00',
      end_date: testData?.auctionEndDate || '2025-07-25',
      end_time: testData?.auctionEndTime || '14:30:00',
      status: 'ended',
      store: null, // Para simplificar o teste
      bids: [],
      images: [],
      auctioned_at: null,
      payment_warning_sent_at: null,
      current_winner_bid_id: null,
      auction_attempt: 1,
    };

    const mockData = {
      winner: mockBuyer,
      clothing: mockClothing,
      winningBid: testData?.winningBid || 150.0,
      auctionEndDate: testData?.auctionEndDate || '2025-07-25',
      auctionEndTime: testData?.auctionEndTime || '14:30:00',
    };

    try {
      await this.emailService.sendAuctionWinnerEmail(mockData);
      return {
        success: true,
        message: `Email de teste enviado para ${mockData.winner.email}`,
        data: {
          winner: { name: mockData.winner.name, email: mockData.winner.email },
          clothing: {
            name: mockData.clothing.name,
            description: mockData.clothing.description,
          },
          winningBid: mockData.winningBid,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao enviar email de teste',
        error: error.message,
      };
    }
  }

  @Post('test-connection')
  async testConnection() {
    try {
      // Criar um transporter temporário para teste
      const testResult = await this.emailService['transporter'].verify();
      return {
        success: true,
        message: 'Conexão com servidor de email OK',
        result: testResult,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro na conexão com servidor de email',
        error: error.message,
      };
    }
  }
}
