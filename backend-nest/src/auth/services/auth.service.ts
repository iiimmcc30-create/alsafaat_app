import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import twilio from 'twilio';
import { Request } from 'express';
import { AuthRepository } from '../repositories/auth.repository';
import { JwtTokenService } from '../services/jwt-token.service';
import { RedisSessionService } from '../../redis/services/redis-session.service';
import { LoggerService } from '../../common/services/logger.service';
import { SocketDisconnectService } from '../../gateway/services/socket-disconnect.service';
import { EmailQueueService } from '../../queue/services/email-queue.service';
import { ApiException, throwApi } from '../../common/exceptions/api.exception';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import {
  ChangePasswordDto,
  GoogleAuthDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SendOtpDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from '../dto/auth.dto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function formatUser(user: {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  arabicName: string;
  avatar: string | null;
  verified: boolean;
  country: string;
  role: string;
  phone?: string | null;
  subscription: unknown;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    arabicName: user.arabicName,
    avatar: user.avatar,
    verified: user.verified,
    country: user.country,
    role: user.role,
    subscription: user.subscription,
    ...(user.phone !== undefined ? { phone: user.phone } : {}),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtTokenService,
    private readonly sessions: RedisSessionService,
    private readonly logger: LoggerService,
    private readonly socketDisconnect: SocketDisconnectService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
  ) {}

  private async enforceSessionLimit(userId: string) {
    const count = await this.repo.countUserSessions(userId);
    if (count >= 5) {
      const oldest = await this.repo.findOldestSession(userId);
      if (oldest) await this.repo.deleteSession(oldest.id);
    }
  }

  private sessionMeta(req: Request) {
    return {
      ipAddress: req.socket.remoteAddress,
      deviceInfo: req.headers['user-agent']?.slice(0, 200),
    };
  }

  async login(dto: LoginDto, req: Request) {
    const user = await this.repo.findUserForLogin(dto.login);
    const dummyHash = '$2a$12$dummyhashfordummypassword1234567890abcdef';
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !valid) {
      this.logger.warn(
        { login: dto.login.slice(0, 20) },
        'Failed login attempt',
      );
      throwApi(401, 'invalid_credentials', 'بيانات الدخول غير صحيحة');
    }

    await this.enforceSessionLimit(user.id);
    const accessToken = this.jwt.signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = this.jwt.signRefreshToken(user.id);

    await this.repo.loginTransaction(user.id, {
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...this.sessionMeta(req),
    });

    this.logger.info({ userId: user.id }, 'User logged in');
    return {
      user: formatUser({ ...user, phone: user.phone }),
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterDto, req: Request) {
    try {
      const decoded = jwt.verify(
        dto.phone_token,
        this.config.get<string>('JWT_SECRET')!,
      ) as {
        phone: string;
        verified: boolean;
      };
      if (!decoded.verified || decoded.phone !== dto.phone) {
        throwApi(
          400,
          'invalid_phone_token',
          'رمز تحقق الجوال غير صحيح أو لا يطابق رقم الجوال',
        );
      }
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throwApi(
        400,
        'invalid_phone_token',
        'رمز تحقق الجوال منتهي الصلاحية أو غير صحيح',
      );
    }

    const orConditions: Array<Record<string, string>> = [
      { username: dto.username },
      { phone: dto.phone },
    ];
    if (dto.email) orConditions.push({ email: dto.email });
    if (dto.googleId) orConditions.push({ googleId: dto.googleId });

    const exists = await this.repo.findExistingUser(orConditions);
    if (exists) {
      if (exists.username === dto.username)
        throwApi(409, 'username_taken', 'اسم المستخدم مستخدم بالفعل');
      if (exists.phone === dto.phone)
        throwApi(409, 'phone_taken', 'رقم الجوال مسجّل بالفعل');
      if (dto.email && exists.email === dto.email)
        throwApi(409, 'email_taken', 'البريد الإلكتروني مستخدم بالفعل');
      if (dto.googleId && exists.googleId === dto.googleId)
        throwApi(409, 'google_linked', 'حساب Google مرتبط بمستخدم آخر');
    }

    let passwordHash: string;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    } else {
      const randomPassword =
        Math.random().toString(36).slice(-8) + Date.now().toString(36);
      passwordHash = await bcrypt.hash(randomPassword, 12);
    }

    const user = await this.repo.createUser({
      username: dto.username,
      displayName: dto.displayName,
      arabicName: dto.arabicName ?? dto.displayName,
      country: dto.country ?? 'SA',
      phone: dto.phone,
      email: dto.email ?? null,
      googleId: dto.googleId ?? null,
      avatar: dto.avatar ?? null,
      passwordHash,
      verified: !!dto.googleId,
    });

    const accessToken = this.jwt.signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = this.jwt.signRefreshToken(user.id);

    await this.repo.createSession({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...this.sessionMeta(req),
    });

    this.logger.info(
      { userId: user.id, via: dto.googleId ? 'google' : 'otp' },
      'User registered',
    );

    return {
      user: formatUser({ ...user, phone: user.phone }),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(dto: RefreshDto) {
    if (!dto.refreshToken) {
      throwApi(400, 'missing_token', 'الرمز مطلوب');
    }

    try {
      const decoded = this.jwt.verifyRefreshToken(dto.refreshToken);
      const session = await this.repo.findSessionByRefreshToken(
        dto.refreshToken,
      );

      if (!session) {
        this.logger.warn(
          { userId: decoded.userId },
          'Refresh token reuse detected — invalidating all sessions',
        );
        await this.repo.deleteAllSessions(decoded.userId);
        throwApi(
          401,
          'token_reuse',
          'تم إلغاء جميع الجلسات لأسباب أمنية. سجّل دخولك مجدداً.',
        );
      }

      if (session.expiresAt < new Date()) {
        await this.repo.deleteSession(session.id);
        throwApi(401, 'session_expired', 'انتهت الجلسة، يرجى تسجيل الدخول');
      }

      if (!session.user.isActive) {
        throwApi(401, 'account_disabled', 'الحساب موقوف');
      }

      const newAccessToken = this.jwt.signAccessToken({
        userId: session.user.id,
        username: session.user.username,
        role: session.user.role,
        passwordVersion: session.user.passwordVersion,
      });
      const newRefreshToken = this.jwt.signRefreshToken(session.user.id);

      await this.repo.rotateSession(
        session.id,
        newRefreshToken,
        new Date(Date.now() + SESSION_TTL_MS),
      );

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (
        err instanceof jwt.TokenExpiredError ||
        err instanceof jwt.JsonWebTokenError
      ) {
        throwApi(401, 'invalid_refresh', 'رمز غير صالح');
      }
      this.logger.error({ err }, 'Refresh error');
      throwApi(500, 'server_error', 'خطأ في الخادم');
    }
  }

  async logout(user: JwtPayload, accessToken: string, dto: LogoutDto) {
    await this.sessions.set(`blacklist:${accessToken}`, true, 15 * 60);

    if (dto.allDevices) {
      await this.repo.deleteAllSessions(user.userId);
      this.logger.info({ userId: user.userId }, 'Logged out from all devices');
    } else if (dto.refreshToken) {
      await this.repo.deleteSessionsByRefreshToken(
        user.userId,
        dto.refreshToken,
      );
      this.logger.info(
        { userId: user.userId },
        'Logged out from current device',
      );
    } else {
      this.logger.info(
        { userId: user.userId },
        'Logged out from current device',
      );
    }

    await this.socketDisconnect.disconnectUser(user.userId);
    return { loggedOut: true };
  }

  async changePassword(
    user: JwtPayload,
    accessToken: string,
    dto: ChangePasswordDto,
  ) {
    const record = await this.repo.findUserPassword(user.userId);
    if (!record) throwApi(404, 'not_found', 'المستخدم غير موجود');

    const valid = await bcrypt.compare(
      dto.currentPassword,
      record.passwordHash,
    );
    if (!valid)
      throwApi(401, 'wrong_password', 'كلمة المرور الحالية غير صحيحة');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.changePasswordTransaction(user.userId, newHash);
    await this.sessions.set(`blacklist:${accessToken}`, true, 15 * 60);
    await this.socketDisconnect.disconnectUser(user.userId);

    this.logger.info(
      { userId: user.userId },
      'Password changed — all sessions invalidated',
    );
    return {
      changed: true,
      message: 'تم تغيير كلمة المرور. سجّل دخولك مجدداً.',
    };
  }

  async sendOtp(dto: SendOtpDto) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (
      process.env.DEV_OTP === 'true' ||
      !accountSid ||
      !authToken ||
      !serviceSid ||
      accountSid.startsWith('AC...') ||
      accountSid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    ) {
      this.logger.warn(
        { phone: dto.phone },
        'Twilio not configured — using dev OTP mode',
      );
      return {
        success: true,
        dev_mode: true,
        message: 'وضع التطوير: استخدم الكود 123456',
      };
    }

    try {
      const client = twilio(accountSid, authToken);
      const to =
        dto.channel === 'whatsapp' ? `whatsapp:${dto.phone}` : dto.phone;
      await client.verify.v2.services(serviceSid).verifications.create({
        to,
        channel: dto.channel === 'whatsapp' ? 'whatsapp' : 'sms',
      });

      this.logger.info({ phone: dto.phone }, 'OTP sent via Twilio');
      return { success: true, expiresIn: 120 };
    } catch (err) {
      this.logger.error({ err, phone: dto.phone }, 'Twilio send OTP error');
      throwApi(500, 'otp_send_failed', 'فشل إرسال رمز التحقق. حاول مجدداً.');
    }
  }

  async verifyOtp(dto: VerifyOtpDto, req: Request) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const isDevMode =
      process.env.DEV_OTP === 'true' ||
      !accountSid ||
      accountSid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    if (isDevMode) {
      if (dto.code !== '123456') {
        throwApi(
          400,
          'invalid_code',
          'الرمز غير صحيح (وضع التطوير: استخدم 123456)',
        );
      }
    } else {
      try {
        const client = twilio(accountSid!, authToken!);
        const check = await client.verify.v2
          .services(serviceSid!)
          .verificationChecks.create({ to: dto.phone, code: dto.code });
        if (check.status !== 'approved') {
          this.logger.warn({ phone: dto.phone }, 'OTP verification failed');
          throwApi(400, 'invalid_code', 'الرمز غير صحيح أو منتهي الصلاحية');
        }
      } catch (err) {
        if (err instanceof ApiException) throw err;
        this.logger.error({ err, phone: dto.phone }, 'Twilio verify error');
        throwApi(500, 'verify_failed', 'فشل التحقق. حاول مجدداً.');
      }
    }

    const user = await this.repo.findUserByPhone(dto.phone);

    if (dto.purpose === 'reset_password') {
      if (!user) throwApi(404, 'not_found', 'لا يوجد حساب مرتبط بهذا الرقم');
      const phoneToken = jwt.sign(
        { phone: dto.phone, verified: true, purpose: 'reset_password' },
        this.config.get<string>('JWT_SECRET')!,
        { expiresIn: '15m' },
      );
      this.logger.info({ userId: user.id }, 'OTP verified for password reset');
      return {
        verified: true,
        purpose: 'reset_password',
        phone: dto.phone,
        phone_token: phoneToken,
        message: 'تم التحقق — يمكنك تعيين كلمة مرور جديدة',
      };
    }

    if (!user) {
      const phoneToken = jwt.sign(
        { phone: dto.phone, verified: true },
        this.config.get<string>('JWT_SECRET')!,
        { expiresIn: '15m' },
      );
      return {
        verified: true,
        is_new_user: true,
        phone: dto.phone,
        phone_token: phoneToken,
        message: 'مستخدم جديد — يجب إكمال التسجيل',
      };
    }

    await this.enforceSessionLimit(user.id);
    const accessToken = this.jwt.signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = this.jwt.signRefreshToken(user.id);

    await this.repo.loginTransaction(user.id, {
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...this.sessionMeta(req),
    });
    await this.repo.updateLastSeen(user.id);

    this.logger.info({ userId: user.id }, 'User logged in via OTP');

    return {
      verified: true,
      is_new_user: false,
      user: formatUser({ ...user, phone: user.phone }),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private getAllowedGoogleClientIds(): string[] {
    const ids = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter((id): id is string => Boolean(id && !id.includes('your_google')));
    return [...new Set(ids)];
  }

  private async verifyGoogleToken(idToken: string) {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, string>;
    const allowed = this.getAllowedGoogleClientIds();
    if (allowed.length > 0 && !allowed.includes(data.aud)) return null;
    return {
      googleId: data.sub,
      email: data.email,
      displayName: data.name ?? data.email,
      avatar: data.picture ?? null,
      emailVerified: data.email_verified === 'true',
    };
  }

  async googleAuth(dto: GoogleAuthDto, req: Request) {
    let googleUser;
    try {
      googleUser = await this.verifyGoogleToken(dto.id_token);
      if (!googleUser)
        throwApi(401, 'invalid_google_token', 'فشل التحقق من حساب Google');
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throwApi(500, 'google_verify_error', 'خطأ في التحقق من Google');
    }

    let user = await this.repo.findGoogleUser(
      googleUser!.googleId,
      googleUser!.email,
    );

    if (!user) {
      return {
        is_new_user: true,
        google_id: googleUser!.googleId,
        email: googleUser!.email,
        display_name: googleUser!.displayName,
        avatar: googleUser!.avatar,
        message: 'مستخدم جديد — يجب إكمال بيانات الملف الشخصي',
      };
    }

    if (!user.googleId) {
      user = await this.repo.linkGoogleId(
        user.id,
        googleUser!.googleId,
        user.avatar ?? googleUser!.avatar,
      );
    }

    await this.enforceSessionLimit(user.id);
    const accessToken = this.jwt.signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = this.jwt.signRefreshToken(user.id);

    await this.repo.loginTransaction(user.id, {
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...this.sessionMeta(req),
    });

    this.logger.info({ userId: user.id }, 'User logged in via Google');

    return {
      is_new_user: false,
      user: formatUser({ ...user, phone: user.phone }),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const decoded = jwt.verify(
        dto.phone_token,
        this.config.get<string>('JWT_SECRET')!,
      ) as {
        phone: string;
        verified: boolean;
        purpose?: string;
      };
      if (!decoded.verified || decoded.phone !== dto.phone) {
        throwApi(
          400,
          'invalid_phone_token',
          'رمز تحقق الجوال غير صحيح أو لا يطابق رقم الجوال',
        );
      }
      if (decoded.purpose && decoded.purpose !== 'reset_password') {
        throwApi(
          400,
          'invalid_phone_token',
          'رمز التحقق غير مخصص لإعادة تعيين كلمة المرور',
        );
      }
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throwApi(
        400,
        'invalid_phone_token',
        'رمز تحقق الجوال منتهي الصلاحية أو غير صحيح',
      );
    }

    const user = await this.repo.findUserByPhone(dto.phone);
    if (!user) throwApi(404, 'not_found', 'لا يوجد حساب مرتبط بهذا الرقم');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.resetPasswordTransaction(user.id, passwordHash);
    await this.socketDisconnect.disconnectUser(user.id);

    this.logger.info({ userId: user.id }, 'Password reset via OTP');
    return {
      reset: true,
      message: 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
    };
  }

  async verifyEmail(user: JwtPayload, dto: VerifyEmailDto) {
    const storedCode = await this.sessions.get<string>(
      `email_verify:${user.userId}`,
    );
    if (!storedCode)
      throwApi(410, 'code_expired', 'انتهت صلاحية الرمز، اطلب رمزاً جديداً');
    if (storedCode !== dto.code)
      throwApi(400, 'invalid_code', 'الرمز غير صحيح');

    await this.repo.verifyEmail(user.userId);
    await this.sessions.del(`email_verify:${user.userId}`);

    this.logger.info({ userId: user.userId }, 'Email verified');
    return { verified: true };
  }

  async resendVerification(user: JwtPayload) {
    const cooldownKey = `email_verify_cooldown:${user.userId}`;
    const onCooldown = await this.sessions.get<string>(cooldownKey);
    if (onCooldown) throwApi(429, 'too_soon', 'انتظر دقيقة قبل طلب رمز جديد');

    const record = await this.repo.findUserForEmailVerify(user.userId);
    if (!record) throwApi(404, 'not_found', 'المستخدم غير موجود');
    if (record.emailVerified)
      throwApi(400, 'already_verified', 'البريد محقق بالفعل');

    const code = crypto.randomInt(100000, 999999).toString();
    await this.sessions.set(`email_verify:${user.userId}`, code, 600);
    await this.sessions.set(cooldownKey, '1', 60);

    await this.emailQueue.addEmail({
      to: record.email!,
      subject: 'تأكيد البريد الإلكتروني — سرح',
      template: 'email_verification',
      variables: { name: record.arabicName, code },
    });

    return { sent: true };
  }

  async isPasswordVersionValid(payload: JwtPayload): Promise<boolean> {
    const user = await this.repo.getPasswordVersion(payload.userId);
    if (!user) return false;
    return (payload.passwordVersion ?? 0) === user.passwordVersion;
  }
}
