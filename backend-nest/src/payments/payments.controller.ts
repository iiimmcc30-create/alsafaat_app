import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  Public,
  RateLimit,
  RawBody,
} from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { successResponse } from '../common/utils/response.util';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import { InitiatePaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

type RequestWithRawBody = Request & { rawBody?: string };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RateLimit('payment')
  @Post('initiate')
  @HttpCode(200)
  async initiate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    return successResponse(await this.payments.initiate(user, dto));
  }

  @RateLimit('payment')
  @Post(':id/dev-complete')
  @HttpCode(200)
  async devComplete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return successResponse(await this.payments.simulateDevPayment(user, id));
  }

  @RawBody()
  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: RequestWithRawBody,
    @Res() res: Response,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-ni-signature') xNiSignature?: string,
  ) {
    const rawBody = req.rawBody ?? '';
    const signature = xSignature ?? xNiSignature;

    const verified = this.payments.verifyWebhookSignature(rawBody, signature);
    if (!verified.ok) {
      return res.status(verified.status).json({ error: verified.error });
    }

    const result = await this.payments.processWebhook(rawBody);
    return res.status(result.status).json(result.body);
  }
}
