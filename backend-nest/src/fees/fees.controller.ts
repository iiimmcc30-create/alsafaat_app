import { Controller, Get, HttpCode } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import { successResponse } from '../common/utils/response.util';
import { FeesService } from './fees.service';

@Controller('fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get()
  @HttpCode(200)
  async listMine(@CurrentUser() user: JwtPayload) {
    const data = await this.fees.listForUser(user.userId);
    return successResponse(data);
  }

  @Public()
  @Get('rules')
  @HttpCode(200)
  getRules() {
    return successResponse(this.fees.getRules());
  }
}
