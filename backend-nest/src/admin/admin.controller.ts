import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { Public, RateLimit, Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { successResponse } from '../common/utils/response.util';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import type {
  AdminLoginDto,
  ApproveApplicationBodyDto,
  CommentApplicationBodyDto,
  RejectApplicationBodyDto,
} from './dto/admin.dto';

const STAFF = ['ADMIN', 'MODERATOR'] as const;

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ─── Auth ───────────────────────────────────────────────────────────────────

  @Public()
  @RateLimit('auth')
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: AdminLoginDto, @Req() req: Request) {
    return successResponse(await this.admin.adminLogin(body, req));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('auth/me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: JwtPayload) {
    return successResponse(await this.admin.adminMe(user));
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('dashboard/stats')
  @HttpCode(HttpStatus.OK)
  async dashboardStats() {
    return successResponse(await this.admin.getDashboardStats());
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async listUsers(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listUsers(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  async getUser(@Param('id') id: string) {
    return successResponse(await this.admin.getUser(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  async updateUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateUser(id, body));
  }

  @Roles('ADMIN')
  @RateLimit('api')
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return successResponse(await this.admin.deleteUser(id, user));
  }

  // ─── Posts ──────────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('posts')
  @HttpCode(HttpStatus.OK)
  async listPosts(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listPosts(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('posts/:id')
  @HttpCode(HttpStatus.OK)
  async updatePost(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updatePost(id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  async deletePost(@Param('id') id: string) {
    return successResponse(await this.admin.deletePost(id));
  }

  // ─── Listings ───────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('listings')
  @HttpCode(HttpStatus.OK)
  async listListings(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listListings(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('listings/:id')
  @HttpCode(HttpStatus.OK)
  async updateListing(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateListing(id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Delete('listings/:id')
  @HttpCode(HttpStatus.OK)
  async deleteListing(@Param('id') id: string) {
    return successResponse(await this.admin.deleteListing(id));
  }

  // ─── Reports / Tickets ──────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('reports')
  @HttpCode(HttpStatus.OK)
  async listReports(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listReports(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('reports/:id')
  @HttpCode(HttpStatus.OK)
  async getReport(@Param('id') id: string) {
    return successResponse(await this.admin.getReport(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('reports/:id')
  @HttpCode(HttpStatus.OK)
  async updateReport(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateReport(id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Delete('reports/:id')
  @HttpCode(HttpStatus.OK)
  async deleteReport(@Param('id') id: string) {
    return successResponse(await this.admin.deleteReport(id));
  }

  // ─── Livestreams ────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('livestreams')
  @HttpCode(HttpStatus.OK)
  async listLiveStreams(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listLiveStreams(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Post('livestreams/:id')
  @HttpCode(HttpStatus.OK)
  async stopLiveStream(@Param('id') id: string) {
    return successResponse(await this.admin.stopLiveStream(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Delete('livestreams/:id')
  @HttpCode(HttpStatus.OK)
  async deleteLiveStream(@Param('id') id: string) {
    return successResponse(await this.admin.deleteLiveStream(id));
  }

  // ─── Butchers ───────────────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('butchers')
  @HttpCode(HttpStatus.OK)
  async listButchers(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listButchers(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('butchers/:id')
  @HttpCode(HttpStatus.OK)
  async getButcher(@Param('id') id: string) {
    return successResponse(await this.admin.getButcher(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('orders')
  @HttpCode(HttpStatus.OK)
  async listOrders(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listOrders(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('orders/:id')
  @HttpCode(HttpStatus.OK)
  async getOrder(@Param('id') id: string) {
    return successResponse(await this.admin.getOrder(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('butchers/:id')
  @HttpCode(HttpStatus.OK)
  async updateButcher(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateButcher(id, body));
  }

  // ─── Settings (ADMIN only) ──────────────────────────────────────────────────

  @Roles('ADMIN')
  @RateLimit('api')
  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async listSettings() {
    return successResponse(await this.admin.listSettings());
  }

  @Roles('ADMIN')
  @RateLimit('api')
  @Put('settings')
  @HttpCode(HttpStatus.OK)
  async updateSetting(@Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateSetting(body));
  }

  // ─── Content Sections ───────────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('sections')
  @HttpCode(HttpStatus.OK)
  async listSections() {
    return successResponse(await this.admin.listSections());
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Post('sections')
  @HttpCode(HttpStatus.CREATED)
  async createSection(@Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.createSection(body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Patch('sections/:id')
  @HttpCode(HttpStatus.OK)
  async updateSection(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return successResponse(await this.admin.updateSection(id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Delete('sections/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSection(@Param('id') id: string) {
    return successResponse(await this.admin.deleteSection(id));
  }

  // ─── Butcher Applications ───────────────────────────────────────────────────

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('butcher-applications')
  @HttpCode(HttpStatus.OK)
  async listButcherApplications(@Query() query: Record<string, unknown>) {
    return successResponse(await this.admin.listButcherApplications(query));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Get('butcher-applications/:id')
  @HttpCode(HttpStatus.OK)
  async getButcherApplication(@Param('id') id: string) {
    return successResponse(await this.admin.getButcherApplication(id));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Post('butcher-applications/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveApplication(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: ApproveApplicationBodyDto,
  ) {
    return successResponse(await this.admin.approveButcherApplication(user, id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Post('butcher-applications/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectApplication(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: RejectApplicationBodyDto,
  ) {
    return successResponse(await this.admin.rejectButcherApplication(user, id, body));
  }

  @Roles(...STAFF)
  @RateLimit('api')
  @Post('butcher-applications/:id/comment')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: CommentApplicationBodyDto,
  ) {
    return successResponse(await this.admin.addButcherApplicationComment(user, id, body));
  }

  // ─── Maintenance ────────────────────────────────────────────────────────────

  @Public()
  @RateLimit('api')
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanup(
    @Req() req: Request,
    @Headers('x-cron-secret') cronSecret?: string,
  ) {
    return successResponse(
      await this.admin.runCleanupAuthorized(cronSecret, req.headers.authorization),
    );
  }
}
