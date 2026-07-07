import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import bcrypt from 'bcryptjs';
import { AdminRepository } from './repositories/admin.repository';
import { ButcherApplicationAdminService } from '../butcher-applications/services/admin.service';
import { ApplicationRepository } from '../butcher-applications/repositories/application.repository';
import { JwtTokenService } from '../auth/services/jwt-token.service';
import { RedisSessionService } from '../redis/services/redis-session.service';
import { AuthRepository } from '../auth/repositories/auth.repository';
import { LoggerService } from '../common/services/logger.service';
import { throwApi, ApiException } from '../common/exceptions/api.exception';
import { parseApplicationId } from '../butcher-applications/routes/parseRequest';
import {
  adminListQuerySchema,
  approveBodySchema,
  rejectBodySchema,
  commentBodySchema,
} from '../butcher-applications/routes/schemas';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import type {
  AdminLoginDto,
  ApproveApplicationBodyDto,
  CommentApplicationBodyDto,
  PaginationQueryDto,
  RejectApplicationBodyDto,
} from './dto/admin.dto';
import {
  adminLoginSchema,
  createSectionSchema,
  paginationQuerySchema,
  updateButcherSchema,
  updateListingSchema,
  updatePostSchema,
  updateReportSchema,
  updateSectionSchema,
  updateSettingSchema,
  updateUserSchema,
} from './dto/admin.dto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set(['ADMIN', 'MODERATOR']);

function formatAdminUser(user: {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  arabicName: string;
  avatar: string | null;
  role: string;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    arabicName: user.arabicName,
    avatar: user.avatar,
    role: user.role as 'ADMIN' | 'MODERATOR',
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly butcherApplications: ButcherApplicationAdminService,
    private readonly applicationRepo: ApplicationRepository,
    private readonly jwt: JwtTokenService,
    private readonly sessions: RedisSessionService,
    private readonly authRepo: AuthRepository,
    private readonly logger: LoggerService,
  ) {}

  private parsePagination(query: Record<string, unknown>): PaginationQueryDto {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return parsed.data;
  }

  private sessionMeta(req: Request) {
    return {
      ipAddress: req.socket.remoteAddress,
      deviceInfo: req.headers['user-agent']?.slice(0, 200),
    };
  }

  async adminLogin(dto: AdminLoginDto, req: Request) {
    const parsed = adminLoginSchema.safeParse(dto);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }

    const user = await this.repo.findAdminUserForLogin(parsed.data.login);
    const dummyHash = '$2a$12$dummyhashfordummypassword1234567890abcdef';
    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);

    if (!user || !valid || !ADMIN_ROLES.has(user.role)) {
      throwApi(401, 'invalid_credentials', 'بيانات الدخول غير صحيحة');
    }

    const count = await this.authRepo.countUserSessions(user.id);
    if (count >= 5) {
      const oldest = await this.authRepo.findOldestSession(user.id);
      if (oldest) await this.authRepo.deleteSession(oldest.id);
    }

    const accessToken = this.jwt.signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = this.jwt.signRefreshToken(user.id);

    await this.authRepo.loginTransaction(user.id, {
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...this.sessionMeta(req),
    });

    this.logger.info({ userId: user.id, role: user.role }, 'Admin logged in');
    return {
      user: formatAdminUser(user),
      accessToken,
      refreshToken,
    };
  }

  async adminMe(user: JwtPayload) {
    const record = await this.repo.findUserById(user.userId);
    if (!record || !ADMIN_ROLES.has(record.role)) {
      throwApi(403, 'forbidden', 'غير مسموح');
    }
    return { user: formatAdminUser(record) };
  }

  getDashboardStats() {
    return this.repo.getDashboardStats();
  }

  listUsers(query: Record<string, unknown>) {
    return this.repo.listUsers(this.parsePagination(query));
  }

  async getUser(id: string) {
    const user = await this.repo.findUserById(id);
    if (!user) throwApi(404, 'not_found', 'المستخدم غير موجود');
    return { user };
  }

  updateUser(id: string, body: Record<string, unknown>) {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updateUser(id, parsed.data).then((user) => ({ user }));
  }

  async deleteUser(id: string, actor: JwtPayload) {
    if (id === actor.userId) {
      throwApi(400, 'cannot_delete_self', 'لا يمكنك حذف حسابك');
    }

    const target = await this.repo.findUserById(id);
    if (!target) throwApi(404, 'not_found', 'المستخدم غير موجود');
    if (ADMIN_ROLES.has(target.role)) {
      throwApi(400, 'cannot_delete_staff', 'لا يمكن حذف حساب مسؤول أو مشرف');
    }

    await this.repo.purgeUser(id);
    this.logger.info({ userId: id, by: actor.userId }, 'Admin purged user');
    return { deleted: true, archived: true };
  }

  listPosts(query: Record<string, unknown>) {
    return this.repo.listPosts(this.parsePagination(query));
  }

  updatePost(id: string, body: Record<string, unknown>) {
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updatePost(id, parsed.data).then((post) => ({ post }));
  }

  async deletePost(id: string) {
    await this.repo.softDeletePost(id);
    return { deleted: true, archived: true };
  }

  listListings(query: Record<string, unknown>) {
    return this.repo.listListings(this.parsePagination(query));
  }

  updateListing(id: string, body: Record<string, unknown>) {
    const parsed = updateListingSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updateListing(id, parsed.data).then((listing) => ({ listing }));
  }

  async deleteListing(id: string) {
    await this.repo.softDeleteListing(id);
    return { deleted: true, archived: true };
  }

  listReports(query: Record<string, unknown>) {
    return this.repo.listTickets(this.parsePagination(query));
  }

  async getReport(id: string) {
    const ticket = await this.repo.findTicket(id);
    if (!ticket) throwApi(404, 'not_found', 'البلاغ غير موجود');
    return { ticket };
  }

  updateReport(id: string, body: Record<string, unknown>) {
    const parsed = updateReportSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updateTicket(id, parsed.data).then((ticket) => ({ ticket }));
  }

  async deleteReport(id: string) {
    await this.repo.softDeleteTicket(id);
    return { deleted: true, archived: true };
  }

  listLiveStreams(query: Record<string, unknown>) {
    return this.repo.listLiveStreams(this.parsePagination(query));
  }

  stopLiveStream(id: string) {
    return this.repo.stopLiveStream(id).then((stream) => ({ stream }));
  }

  async deleteLiveStream(id: string) {
    await this.repo.softDeleteLiveStream(id);
    return { deleted: true, archived: true };
  }

  listButchers(query: Record<string, unknown>) {
    return this.repo.listButchers(this.parsePagination(query));
  }

  updateButcher(id: string, body: Record<string, unknown>) {
    const parsed = updateButcherSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updateButcher(id, parsed.data).then((butcher) => ({ butcher }));
  }

  async getButcher(id: string) {
    const butcher = await this.repo.findButcherById(id);
    if (!butcher) throwApi(404, 'not_found', 'المسلخ غير موجود');
    return { butcher, user: butcher.user };
  }

  listOrders(query: Record<string, unknown>) {
    const parsed = this.parsePagination(query);
    return this.repo.listOrders({
      ...parsed,
      status: typeof query.status === 'string' ? query.status : undefined,
      butcherId: typeof query.butcherId === 'string' ? query.butcherId : undefined,
      customerId: typeof query.customerId === 'string' ? query.customerId : undefined,
      dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
      dateTo: typeof query.dateTo === 'string' ? query.dateTo : undefined,
      orderNumber: typeof query.orderNumber === 'string' ? query.orderNumber : undefined,
    });
  }

  async getOrder(orderId: string) {
    const order = await this.repo.getOrderById(orderId);
    if (!order) throwApi(404, 'not_found', 'الطلب غير موجود');
    return { order };
  }

  async listSettings() {
    await this.repo.ensureDefaultSettings();
    const settings = await this.repo.listSettings();
    return {
      settings: settings.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.value,
        labelAr: s.labelAr,
        category: s.category,
        updatedAt: s.updatedAt,
      })),
    };
  }

  updateSetting(body: Record<string, unknown>) {
    const parsed = updateSettingSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo
      .upsertSetting(parsed.data.key, parsed.data.value, parsed.data.labelAr, parsed.data.category)
      .then((setting) => ({ setting }));
  }

  listSections() {
    return this.repo.listSections().then((sections) => ({ sections }));
  }

  createSection(body: Record<string, unknown>) {
    const parsed = createSectionSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.createSection(parsed.data).then((section) => ({ section }));
  }

  updateSection(id: string, body: Record<string, unknown>) {
    const parsed = updateSectionSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }
    return this.repo.updateSection(id, parsed.data).then((section) => ({ section }));
  }

  async deleteSection(id: string) {
    await this.repo.softDeleteSection(id);
    return { deleted: true, archived: true };
  }

  async runCleanup() {
    const now = new Date();
    this.logger.info({}, 'Running scheduled cleanup');
    const [sessions, notifications, stories, offers] = await this.repo.runCleanup(now);
    const stats = {
      expiredSessions: sessions.count,
      oldNotifications: notifications.count,
      expiredStories: stories.count,
      expiredOffers: offers.count,
    };
    this.logger.info({ stats }, 'Cleanup complete');
    return stats;
  }

  async assertAdminBearer(authHeader: string | undefined): Promise<void> {
    if (!authHeader?.startsWith('Bearer ')) {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwt.verifyAccessToken(token);
      const blacklisted = await this.sessions.get<boolean>(`blacklist:${token}`);
      if (blacklisted) throwApi(403, 'forbidden', 'غير مسموح');

      const user = await this.authRepo.getPasswordVersion(payload.userId);
      if (!user || (payload.passwordVersion ?? 0) !== user.passwordVersion) {
        throwApi(403, 'forbidden', 'غير مسموح');
      }

      const active = await this.authRepo.isUserActive(payload.userId);
      if (!active?.isActive) throwApi(403, 'forbidden', 'غير مسموح');

      if (!ADMIN_ROLES.has(payload.role)) throwApi(403, 'forbidden', 'غير مسموح');
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throwApi(403, 'forbidden', 'غير مسموح');
    }
  }

  async runCleanupAuthorized(cronSecret?: string, authHeader?: string) {
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      return this.runCleanup();
    }
    await this.assertAdminBearer(authHeader);
    return this.runCleanup();
  }

  async listButcherApplications(query: Record<string, unknown>) {
    const parsed = adminListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }

    const [page, draft] = await Promise.all([
      this.butcherApplications.listApplications(parsed.data),
      this.applicationRepo.countDraftApplications(),
    ]);

    return {
      applications: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      counts: { submitted: page.counts.submitted, draft },
    };
  }

  async getButcherApplication(id: string) {
    const applicationId = parseApplicationId({ id });
    if (!applicationId) throwApi(400, 'invalid_id', 'معرّف غير صالح');
    return this.butcherApplications.getApplication(applicationId);
  }

  async approveButcherApplication(
    user: JwtPayload,
    id: string,
    body: ApproveApplicationBodyDto,
  ) {
    const applicationId = parseApplicationId({ id });
    if (!applicationId) throwApi(400, 'invalid_id', 'معرّف غير صحيح');

    const parsed = approveBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }

    return this.butcherApplications.approveApplication(
      user.userId,
      applicationId,
      parsed.data as ApproveApplicationBodyDto,
    );
  }

  async rejectButcherApplication(
    user: JwtPayload,
    id: string,
    body: RejectApplicationBodyDto,
  ) {
    const applicationId = parseApplicationId({ id });
    if (!applicationId) throwApi(400, 'invalid_id', 'معرّف غير صحيح');

    const parsed = rejectBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }

    return this.butcherApplications.rejectApplication(
      user.userId,
      applicationId,
      parsed.data as RejectApplicationBodyDto,
    );
  }

  async addButcherApplicationComment(
    user: JwtPayload,
    id: string,
    body: CommentApplicationBodyDto,
  ) {
    const applicationId = parseApplicationId({ id });
    if (!applicationId) throwApi(400, 'invalid_id', 'معرّف غير صحيح');

    const parsed = commentBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
    }

    const timelineEvent = await this.butcherApplications.addComment(
      user.userId,
      applicationId,
      parsed.data as CommentApplicationBodyDto,
    );
    return { timelineEvent };
  }
}
