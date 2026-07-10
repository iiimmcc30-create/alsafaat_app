import { Injectable } from '@nestjs/common';
import { OrderPaymentStatus, OrderStatus, Prisma } from '@prisma/client';
import { AppNotificationsService } from '../../queue/services/app-notifications.service';
import { SocketEmitService } from '../../gateway/services/socket-emit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { throwApi } from '../../common/exceptions/api.exception';
import { OrderStateMachineService } from './order-state-machine.service';

type CreateOrderInput = {
  butcherId: string;
  customerId: string;
  productId: string;
  cutType: string;
  weightKg: number;
  deliveryType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  currency: string;
  totalPrice: number;
};

type LockedOrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  productId: string;
  customerId: string;
  reservedQuantity: number;
  butcherId: string;
  butcherUserId: string;
};

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachineService,
    private readonly notifications: AppNotificationsService,
    private readonly sockets: SocketEmitService,
  ) {}

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    await tx.orderNumberSequence.upsert({
      where: { year },
      create: { year, lastNumber: 0 },
      update: {},
    });
    const seq = await tx.orderNumberSequence.update({
      where: { year },
      data: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });
    return `ORD-${year}-${String(seq.lastNumber).padStart(6, '0')}`;
  }

  private statusMsg(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      pending: 'تم استلام طلبك',
      confirmed: 'تم تأكيد طلبك',
      preparing: 'طلبك قيد التحضير',
      ready: 'طلبك جاهز للاستلام/التوصيل',
      delivered: 'تم تسليم طلبك بنجاح',
      cancelled: 'تم إلغاء طلبك',
    };
    return map[status];
  }

  private async staffUserIds(): Promise<string[]> {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MODERATOR'] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return staff.map((s) => s.id);
  }

  private emitOrderSockets(
    customerId: string,
    butcherUserId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    this.sockets.emitToUser(customerId, event, payload);
    this.sockets.emitToUser(butcherUserId, event, payload);
    this.sockets.getServer()?.emit(`admin.${event}`, payload);
  }

  private async notifyOrderParties(params: {
    customerId: string;
    butcherUserId: string;
    orderId: string;
    orderNumber: string;
    butcherId: string;
    status: OrderStatus;
    titleAr?: string;
    bodyAr?: string;
    type?: 'order_update' | 'system';
  }) {
    const bodyAr = params.bodyAr ?? this.statusMsg(params.status);
    const titleAr = params.titleAr ?? `طلب ${params.orderNumber}`;
    const data = {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      status: params.status,
      butcherId: params.butcherId,
    };

    const staffIds = await this.staffUserIds();
    const recipients = [
      ...new Set([params.customerId, params.butcherUserId, ...staffIds]),
    ];

    await this.notifications.notifyUsers(recipients, {
      type: params.type ?? 'order_update',
      titleAr,
      bodyAr,
      data,
    });
  }

  private async notifyOrderStatus(
    customerId: string,
    butcherUserId: string,
    payload: {
      orderId: string;
      orderNumber: string;
      butcherId: string;
      status: OrderStatus;
      timeline: { status: OrderStatus; note: string | null; createdAt: Date };
    },
  ) {
    this.emitOrderSockets(customerId, butcherUserId, 'order.updated', payload);
    this.sockets.emitToUser(customerId, 'order:updated', {
      orderId: payload.orderId,
      status: payload.status,
    });
    this.emitOrderSockets(
      customerId,
      butcherUserId,
      'order.timeline.updated',
      payload.timeline,
    );

    await this.notifyOrderParties({
      customerId,
      butcherUserId,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      butcherId: payload.butcherId,
      status: payload.status,
    });
  }

  private async lockOrderRow(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<LockedOrderRow | null> {
    const rows = await tx.$queryRaw<LockedOrderRow[]>`
      SELECT
        o.id,
        o."orderNumber" AS "orderNumber",
        o.status,
        o."paymentStatus" AS "paymentStatus",
        o."productId" AS "productId",
        o."customerId" AS "customerId",
        o."reservedQuantity" AS "reservedQuantity",
        o."butcherId" AS "butcherId",
        b."userId" AS "butcherUserId"
      FROM "ButcherOrder" o
      INNER JOIN "Butcher" b ON b.id = o."butcherId"
      WHERE o.id = ${orderId}
      FOR UPDATE OF o
    `;
    return rows[0] ?? null;
  }

  async createOrder(input: CreateOrderInput) {
    const reserveQty = Math.max(input.weightKg, 0);
    const created = await this.prisma.$transaction(async (tx) => {
      const productLock = await tx.$executeRaw`
        UPDATE "ButcherProduct"
        SET "reservedQuantity" = "reservedQuantity" + ${reserveQty}
        WHERE "id" = ${input.productId}
          AND "inStock" = true
          AND ("availableQuantity" - "reservedQuantity") >= ${reserveQty}
      `;
      if (productLock === 0) {
        throwApi(409, 'insufficient_inventory', 'الكمية غير متوفرة حالياً');
      }

      const orderNumber = await this.nextOrderNumber(tx);

      const order = await tx.butcherOrder.create({
        data: {
          ...input,
          orderNumber,
          reservedQuantity: reserveQty,
          status: 'pending',
          paymentStatus: 'unpaid',
        },
        include: {
          butcher: { select: { id: true, userId: true, nameAr: true } },
          product: true,
        },
      });

      const timeline = await tx.orderTimeline.create({
        data: {
          orderId: order.id,
          status: 'pending',
          note: 'Order Created — awaiting payment',
          createdBy: input.customerId,
        },
      });

      return { order, timeline };
    });

    this.emitOrderSockets(
      created.order.customerId,
      created.order.butcher.userId,
      'order.created',
      {
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
        status: created.order.status,
        paymentStatus: created.order.paymentStatus,
        butcherId: created.order.butcher.id,
        customerId: created.order.customerId,
      },
    );

    await this.notifications.notifyUser({
      userId: created.order.customerId,
      type: 'order_update',
      titleAr: `طلب ${created.order.orderNumber}`,
      bodyAr: 'أكمل الدفع عبر بوابة المنصة لتأكيد الطلب',
      data: {
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
        status: created.order.status,
        paymentStatus: created.order.paymentStatus,
        butcherId: created.order.butcher.id,
      },
    });

    return created.order;
  }

  async transitionOrder(params: {
    orderId: string;
    actorId: string;
    nextStatus: OrderStatus;
    cancellationReason?: string | null;
  }) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrderRow(tx, params.orderId);
      if (!locked) throwApi(404, 'not_found', 'الطلب غير موجود');

      if (locked.status === params.nextStatus) {
        const order = await tx.butcherOrder.findUnique({
          where: { id: params.orderId },
          include: { butcher: { select: { id: true, userId: true } } },
        });
        if (!order) throwApi(404, 'not_found', 'الطلب غير موجود');
        return { order, timeline: null, noop: true as const, locked };
      }

      this.stateMachine.assertTransition(locked.status, params.nextStatus);

      if (
        params.nextStatus === 'confirmed' &&
        locked.paymentStatus !== 'paid'
      ) {
        throwApi(
          402,
          'payment_required',
          'لا يمكن تأكيد الطلب قبل إتمام الدفع عبر بوابة المنصة',
        );
      }

      if (params.nextStatus === 'cancelled' && locked.reservedQuantity > 0) {
        await tx.$executeRaw`
          UPDATE "ButcherProduct"
          SET "reservedQuantity" = GREATEST("reservedQuantity" - ${locked.reservedQuantity}, 0)
          WHERE "id" = ${locked.productId}
        `;
      }

      if (params.nextStatus === 'delivered' && locked.reservedQuantity > 0) {
        const affected = await tx.$executeRaw`
          UPDATE "ButcherProduct"
          SET "reservedQuantity" = GREATEST("reservedQuantity" - ${locked.reservedQuantity}, 0),
              "availableQuantity" = GREATEST("availableQuantity" - ${locked.reservedQuantity}, 0)
          WHERE "id" = ${locked.productId}
            AND "reservedQuantity" >= ${locked.reservedQuantity}
        `;
        if (affected === 0) {
          throwApi(409, 'inventory_conflict', 'تعذر تحديث المخزون للطلب');
        }
      }

      const order = await tx.butcherOrder.update({
        where: { id: params.orderId },
        data: {
          status: params.nextStatus,
          ...(params.nextStatus === 'cancelled'
            ? {
                cancelledBy: params.actorId,
                cancellationReason: params.cancellationReason ?? null,
                cancelledAt: new Date(),
              }
            : {}),
        },
        include: { butcher: { select: { id: true, userId: true } } },
      });

      const timeline = await tx.orderTimeline.create({
        data: {
          orderId: params.orderId,
          status: params.nextStatus,
          note:
            params.nextStatus === 'cancelled'
              ? (params.cancellationReason ?? 'Order Cancelled')
              : null,
          createdBy: params.actorId,
        },
      });

      await tx.orderStatusAudit.create({
        data: {
          orderId: params.orderId,
          previousStatus: locked.status,
          newStatus: params.nextStatus,
          changedBy: params.actorId,
        },
      });

      return { order, timeline, noop: false as const, locked };
    });

    if (updated.noop) {
      return updated.order;
    }

    const locked = updated.locked;
    const timeline = updated.timeline!;

    this.emitOrderSockets(
      locked.customerId,
      locked.butcherUserId,
      'inventory.updated',
      {
        productId: locked.productId,
      },
    );

    await this.notifyOrderStatus(locked.customerId, locked.butcherUserId, {
      orderId: updated.order.id,
      orderNumber: updated.order.orderNumber,
      butcherId: updated.order.butcher.id,
      status: updated.order.status,
      timeline: {
        status: timeline.status,
        note: timeline.note,
        createdAt: timeline.createdAt,
      },
    });

    if (updated.order.status === 'cancelled') {
      this.emitOrderSockets(
        locked.customerId,
        locked.butcherUserId,
        'order.cancelled',
        {
          orderId: updated.order.id,
          orderNumber: updated.order.orderNumber,
        },
      );
    }

    return updated.order;
  }
}
