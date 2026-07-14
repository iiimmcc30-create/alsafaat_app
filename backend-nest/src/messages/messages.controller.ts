import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RateLimit } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { successResponse } from '../common/utils/response.util';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import {
  ListThreadsQueryDto,
  SendMessageDto,
  ThreadMessagesQueryDto,
} from './dto/messages.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @RateLimit('api')
  @Get()
  @HttpCode(HttpStatus.OK)
  async getThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListThreadsQueryDto,
  ) {
    return successResponse(await this.messages.getThreads(user, query));
  }

  @RateLimit('api')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async send(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return successResponse(await this.messages.sendMessage(user, dto));
  }

  @RateLimit('api')
  @Get(':threadId')
  @HttpCode(HttpStatus.OK)
  async getThreadMessages(
    @CurrentUser() user: JwtPayload,
    @Param('threadId') threadId: string,
    @Query() query: ThreadMessagesQueryDto,
  ) {
    return successResponse(
      await this.messages.getThreadMessages(user, threadId, query),
    );
  }
}
