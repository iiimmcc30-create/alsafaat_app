// src/socket-server.ts
// FIX: input validation on all socket events, authorization checks on thread access,
//      viewers counter guard against negative, async disconnect cleanup
import './load-env';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import { z } from 'zod';
import { verifyAccessToken, JwtPayload } from './lib/jwt';
import { logger } from './lib/logger';
import prisma from './lib/prisma';
import { cacheSet, cacheDel, sessionGet } from './lib/redis';
import { isPasswordVersionValid } from './middleware/auth';

const PORT           = parseInt(process.env.SOCKET_PORT || '3002');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081').split(',');
const IS_DEV          = process.env.NODE_ENV !== 'production';
const FORCE_MEMORY    = process.env.SOCKET_USE_MEMORY_ADAPTER === 'true';

// ─── Input validation schemas ─────────────────────────────────────────────────
const chatSendSchema = z.object({
  threadId:   z.string().uuid(),
  receiverId: z.string().uuid(),
  text:       z.string().min(1).max(4000).optional(),
  imageUrl:   z.string().url().optional(),
  orderId:    z.string().uuid().optional(),
}).refine((d) => d.text || d.imageUrl, 'text or imageUrl required');

const chatTypingSchema = z.object({
  threadId:   z.string().uuid(),
  receiverId: z.string().uuid(),
});

const chatReadSchema = z.object({
  threadId:   z.string().uuid(),
  messageIds: z.array(z.string().uuid()).max(50),
});

const liveCommentSchema = z.object({
  streamId:    z.string().uuid(),
  message:     z.string().min(1).max(500).trim(),
  isOffer:     z.boolean().optional(),
  offerAmount: z.number().positive().max(10_000_000).optional(),
});

const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status:  z.enum(['confirmed','preparing','ready','delivered','cancelled']),
});

// ─── Server ───────────────────────────────────────────────────────────────────
const httpServer = createServer();
const io = new Server(httpServer, {
  cors:           { origin: ALLOWED_ORIGINS, credentials: true },
  transports:     ['websocket', 'polling'],
  pingTimeout:    60000,
  pingInterval:   25000,
  maxHttpBufferSize: 1e6, // 1MB max message size
});

async function setupRedisAdapter(): Promise<void> {
  if (FORCE_MEMORY) {
    logger.warn('SOCKET_USE_MEMORY_ADAPTER=true — using in-memory Socket.IO adapter');
    return;
  }

  // DB 3 = Socket.IO adapter pub/sub — isolated from cache (DB0), queues (DB1), sessions (DB2)
  const redisOpts = {
    host:                 process.env.REDIS_HOST || 'localhost',
    port:                 parseInt(process.env.REDIS_PORT || '6379'),
    password:             process.env.REDIS_PASSWORD || undefined,
    db:                   3,
    lazyConnect:          true,
    connectTimeout:       3000,
    maxRetriesPerRequest: null as null, // required for pub/sub clients
    retryStrategy:        () => null,   // fail fast during startup probe
  };

  const probe = new IORedis(redisOpts);
  probe.on('error', () => {}); // suppress probe noise

  try {
    await probe.connect();
    await probe.ping();
  } catch (err) {
    if (!IS_DEV) {
      probe.disconnect();
      throw err;
    }
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Redis unavailable — using in-memory Socket.IO adapter (dev single-instance). ' +
      'Install Docker and run `npm run db:up`, or set SOCKET_USE_MEMORY_ADAPTER=true'
    );
    probe.disconnect();
    return;
  }

  probe.disconnect();

  const pubClient = new IORedis({ ...redisOpts, retryStrategy: (times: number) => Math.min(times * 200, 3000) });
  const subClient = pubClient.duplicate();

  await pubClient.connect();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient));
  pubClient.on('error', (err) => logger.error({ err: err.message }, 'Socket Redis pub error'));
  subClient.on('error', (err) => logger.error({ err: err.message }, 'Socket Redis sub error'));
  logger.info('Socket.IO Redis adapter connected');
}

let adapterInit: Promise<void> | null = null;

function ensureAdapter(): Promise<void> {
  if (!adapterInit) adapterInit = setupRedisAdapter();
  return adapterInit;
}

/** Disconnect every active socket in user:<userId>. Safe to call with zero connected sockets. Never throws. */
export async function disconnectUserSockets(userId: string): Promise<void> {
  try {
    await ensureAdapter();
    const room = `user:${userId}`;
    const sockets = await io.in(room).fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    if (sockets.length > 0) {
      logger.info({ userId, count: sockets.length }, 'Disconnected user sockets');
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), userId },
      'Failed to disconnect user sockets',
    );
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
interface SocketWithUser extends Socket {
  user: JwtPayload;
}

io.use(async (socket, next) => {
  const authToken = socket.handshake.auth?.token;
  const headerAuth = socket.handshake.headers?.authorization;
  const token =
    (typeof authToken === 'string' ? authToken : undefined) ||
    (typeof headerAuth === 'string' ? headerAuth.replace('Bearer ', '') : undefined);

  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = verifyAccessToken(token);

    const blacklisted = await sessionGet<boolean>(`blacklist:${token}`);
    if (blacklisted) {
      return next(new Error('Token revoked'));
    }

    if (!(await isPasswordVersionValid(payload))) {
      return next(new Error('Token revoked'));
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return next(new Error('Account disabled'));
    }

    (socket as SocketWithUser).user = payload;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Emit an error to the socket without disconnecting */
function emitErr(socket: Socket, code: string, message: string) {
  socket.emit('error', { code, message });
}

/**
 * Verify user is a participant in the thread.
 * Prevents sending messages to threads the user doesn't belong to.
 */
async function assertThreadParticipant(threadId: string, userId: string): Promise<boolean> {
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      OR: [{ participant1: userId }, { participant2: userId }],
    },
    select: { id: true },
  });
  return !!thread;
}

// ─── Connection handler ───────────────────────────────────────────────────────
io.on('connection', async (socket: Socket) => {
  const user = (socket as any).user as { userId: string; username: string };
  logger.info({ userId: user.userId, socketId: socket.id }, 'Socket connected');

  socket.join(`user:${user.userId}`);
  await cacheSet(`online:${user.userId}`, { socketId: socket.id, since: new Date() }, 3600);

  // ── Chat ──────────────────────────────────────────────────────────────────

  socket.on('chat:join', async (threadId: unknown) => {
    const parsed = z.string().uuid().safeParse(threadId);
    if (!parsed.success) return emitErr(socket, 'invalid_input', 'Invalid threadId');

    // Verify user belongs to this thread before joining the room
    const allowed = await assertThreadParticipant(parsed.data, user.userId);
    if (!allowed) return emitErr(socket, 'unauthorized', 'Not a participant in this thread');

    socket.join(`thread:${parsed.data}`);
  });

  socket.on('chat:leave', (threadId: unknown) => {
    const parsed = z.string().uuid().safeParse(threadId);
    if (!parsed.success) return;
    socket.leave(`thread:${parsed.data}`);
  });

  socket.on('chat:send', async (raw: unknown) => {
    const parsed = chatSendSchema.safeParse(raw);
    if (!parsed.success) return emitErr(socket, 'invalid_input', 'Invalid message data');
    const data = parsed.data;

    // Verify sender is in this thread
    const allowed = await assertThreadParticipant(data.threadId, user.userId);
    if (!allowed) return emitErr(socket, 'unauthorized', 'Not a participant in this thread');

    // Verify receiverId is actually the other participant
    const thread = await prisma.messageThread.findUnique({
      where:  { id: data.threadId },
      select: { participant1: true, participant2: true },
    });
    if (!thread) return emitErr(socket, 'not_found', 'Thread not found');
    const expectedReceiver = thread.participant1 === user.userId ? thread.participant2 : thread.participant1;
    if (data.receiverId !== expectedReceiver) {
      return emitErr(socket, 'unauthorized', 'Invalid receiverId for this thread');
    }

    try {
      const [message] = await prisma.$transaction([
        prisma.message.create({
          data: {
            threadId:   data.threadId,
            senderId:   user.userId,
            receiverId: data.receiverId,
            text:       data.text,
            imageUrl:   data.imageUrl,
            orderId:    data.orderId,
          },
          include: {
            sender: { select: { id: true, username: true, arabicName: true, avatar: true } },
          },
        }),
        prisma.messageThread.update({
          where: { id: data.threadId },
          data:  { lastMessageAt: new Date() },
        }),
      ]);

      io.to(`thread:${data.threadId}`).emit('chat:message', message);
      io.to(`user:${data.receiverId}`).emit('chat:notification', {
        threadId:   data.threadId,
        senderId:   user.userId,
        senderName: message.sender.arabicName,
        preview:    data.text?.slice(0, 60) || '📷 صورة',
      });
    } catch (err) {
      logger.error({ err }, 'chat:send error');
      emitErr(socket, 'server_error', 'Failed to send message');
    }
  });

  socket.on('chat:typing', (raw: unknown) => {
    const parsed = chatTypingSchema.safeParse(raw);
    if (!parsed.success) return;
    // Don't emit to self, just to receiver
    socket.to(`user:${parsed.data.receiverId}`).emit('chat:typing', {
      threadId: parsed.data.threadId,
      userId:   user.userId,
    });
  });

  socket.on('chat:read', async (raw: unknown) => {
    const parsed = chatReadSchema.safeParse(raw);
    if (!parsed.success) return;

    // Only update messages where this user is the receiver
    await prisma.message.updateMany({
      where: {
        id:         { in: parsed.data.messageIds },
        receiverId: user.userId,  // prevents marking others' messages as read
        threadId:   parsed.data.threadId,
      },
      data: { isRead: true, readAt: new Date() },
    }).catch(() => {});

    socket.to(`thread:${parsed.data.threadId}`).emit('chat:read', {
      threadId: parsed.data.threadId,
      readBy:   user.userId,
    });
  });

  // ── Live stream ───────────────────────────────────────────────────────────

  socket.on('live:join', async (streamId: unknown) => {
    const parsed = z.string().uuid().safeParse(streamId);
    if (!parsed.success) return emitErr(socket, 'invalid_input', 'Invalid streamId');

    const stream = await prisma.liveStream.findFirst({
      where:  { id: parsed.data, isLive: true },
      select: {
        id: true,
        hostId: true,
        viewers: true,
        likes: true,
        _count: { select: { comments: true } },
      },
    });
    if (!stream) return emitErr(socket, 'not_found', 'Stream not found or not live');

    socket.join(`stream:${parsed.data}`);
    socket.data.streamId = parsed.data;

    let viewers = stream.viewers;
    if (user.userId !== stream.hostId) {
      const updated = await prisma.liveStream.update({
        where: { id: parsed.data },
        data:  { viewers: { increment: 1 } },
        select: { viewers: true, peakViewers: true },
      });

      viewers = updated.viewers;

      if (updated.viewers > updated.peakViewers) {
        await prisma.liveStream.update({
          where: { id: parsed.data },
          data:  { peakViewers: updated.viewers },
        }).catch(() => {});
      }

      io.to(`stream:${parsed.data}`).emit('live:viewers', viewers);
    }

    const stats = {
      viewers,
      likes: stream.likes,
      commentsCount: stream._count.comments,
    };
    socket.emit('live:stats', stats);
    io.to(`stream:${parsed.data}`).emit('live:stats', stats);
  });

  socket.on('live:leave', async (streamId: unknown) => {
    const parsed = z.string().uuid().safeParse(streamId);
    if (!parsed.success) return;

    socket.leave(`stream:${parsed.data}`);

    const updated = await prisma.liveStream.update({
      where: { id: parsed.data },
      data:  { viewers: { decrement: 1 } },
      select: { viewers: true },
    }).catch(() => ({ viewers: 0 }));

    // FIX: guard against negative viewer count
    const viewers = Math.max(0, updated.viewers);
    io.to(`stream:${parsed.data}`).emit('live:viewers', viewers);

    // Fix negative counter in DB if it happened
    if (updated.viewers < 0) {
      await prisma.liveStream.update({ where: { id: parsed.data }, data: { viewers: 0 } }).catch(() => {});
    }
  });

  socket.on('live:comment', async (raw: unknown) => {
    const parsed = liveCommentSchema.safeParse(raw);
    if (!parsed.success) return emitErr(socket, 'invalid_input', 'Invalid comment data');

    // Verify stream is actually live
    const stream = await prisma.liveStream.findFirst({
      where:  { id: parsed.data.streamId, isLive: true },
      select: { id: true },
    });
    if (!stream) return emitErr(socket, 'stream_ended', 'Stream is not live');

    const profile = await prisma.user.findUnique({
      where:  { id: user.userId },
      select: { arabicName: true, displayName: true, avatar: true },
    });

    const comment = await prisma.liveComment.create({
      data: {
        streamId:    parsed.data.streamId,
        userId:      user.userId,
        username:    user.username,
        arabicName:  profile?.arabicName ?? profile?.displayName ?? user.username,
        avatar:      profile?.avatar,
        message:     parsed.data.message,
        isOffer:     parsed.data.isOffer || false,
        offerAmount: parsed.data.offerAmount,
      },
    });

    io.to(`stream:${parsed.data.streamId}`).emit('live:comment', comment);
  });

  socket.on('live:like', async (streamId: unknown) => {
    const parsed = z.string().uuid().safeParse(streamId);
    if (!parsed.success) return;

    const updated = await prisma.liveStream.update({
      where: { id: parsed.data },
      data:  { likes: { increment: 1 } },
      select: { likes: true },
    }).catch(() => null);

    if (!updated) return;

    io.to(`stream:${parsed.data}`).emit('live:like', { userId: user.userId, likes: updated.likes });
    io.to(`stream:${parsed.data}`).emit('live:likes', updated.likes);
  });

  // ── Butcher order ─────────────────────────────────────────────────────────

  socket.on('order:status', async (raw: unknown) => {
    const parsed = orderStatusSchema.safeParse(raw);
    if (!parsed.success) return emitErr(socket, 'invalid_input', 'Invalid order data');

    const order = await prisma.butcherOrder.findUnique({
      where:  { id: parsed.data.orderId },
      select: { butcher: { select: { userId: true } }, customerId: true, status: true },
    });

    if (!order)                                    return emitErr(socket, 'not_found', 'Order not found');
    if (order.butcher.userId !== user.userId)      return emitErr(socket, 'unauthorized', 'Not your order');
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return emitErr(socket, 'invalid_state', 'Order already finalized');
    }

    await prisma.butcherOrder.update({
      where: { id: parsed.data.orderId },
      data:  { status: parsed.data.status as any },
    });

    io.to(`user:${order.customerId}`).emit('order:updated', {
      orderId: parsed.data.orderId,
      status:  parsed.data.status,
    });

    // In-app notification (direct DB — avoids BullMQ/Redis dependency in socket process)
    await prisma.notification.create({
      data: {
        userId:  order.customerId,
        type:    'order_update',
        titleAr: 'تحديث طلبك',
        bodyAr:  `حالة طلبك: ${parsed.data.status}`,
        data:    { orderId: parsed.data.orderId, status: parsed.data.status },
      },
    }).catch(() => {});
  });

  // ── Presence ──────────────────────────────────────────────────────────────

  socket.on('presence:ping', () => {
    cacheSet(`online:${user.userId}`, { socketId: socket.id, updatedAt: new Date() }, 3600).catch(() => {});
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  socket.on('notifications:read', async (raw: unknown) => {
    const parsed = z.array(z.string().uuid()).max(50).safeParse(raw);
    if (!parsed.success) return;

    await prisma.notification.updateMany({
      where: { id: { in: parsed.data }, userId: user.userId },
      data:  { isRead: true, readAt: new Date() },
    }).catch(() => {});
  });

  // ── Disconnect ────────────────────────────────────────────────────────────

  socket.on('disconnect', async () => {
    logger.info({ userId: user.userId }, 'Socket disconnected');

    // FIX: fire-and-forget with timeout — don't block socket cleanup on DB
    const cleanup = async () => {
      await cacheDel(`online:${user.userId}`);
      await prisma.user.update({
        where: { id: user.userId },
        data:  { lastSeenAt: new Date() },
      });
    };

    // Give it 5 seconds, then abandon — non-critical
    Promise.race([
      cleanup(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('cleanup timeout')), 5000)),
    ]).catch((err) => logger.warn({ err: err.message, userId: user.userId }, 'Disconnect cleanup failed'));
  });
});

// ─── Exports for API routes ───────────────────────────────────────────────────
export const emitToUser   = (userId: string,   event: string, data: unknown) => io.to(`user:${userId}`).emit(event, data);
export const emitToThread = (threadId: string, event: string, data: unknown) => io.to(`thread:${threadId}`).emit(event, data);
export const emitToStream = (streamId: string, event: string, data: unknown) => io.to(`stream:${streamId}`).emit(event, data);
export { io };

async function start() {
  await ensureAdapter();
  httpServer.listen(PORT, () => logger.info({ port: PORT }, '🔌 Socket.IO server running'));
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, 'Socket server failed to start');
    process.exit(1);
  });
}
