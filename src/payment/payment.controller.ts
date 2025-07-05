import {
  Controller,
  Post,
  Param,
  UseGuards,
  Req,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AuthGuard } from '@nestjs/passport';
import { IRequestWithUser } from 'src/interfaces';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('order/:id/pay')
  createPayment(@Param('id') id: string, @Req() req: IRequestWithUser) {
    const userId = req.user.userId;
    return this.paymentService.createPayment(Number(id), userId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() body: { data: { id: string } }) {
    if (body.data && body.data.id) {
      return this.paymentService.handleWebhook(body.data.id);
    }
  }
}
