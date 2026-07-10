import { Test } from '@nestjs/testing';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderStateMachineService } from './order-state-machine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppNotificationsService } from '../../queue/services/app-notifications.service';
import { SocketEmitService } from '../../gateway/services/socket-emit.service';
import { ApiException } from '../../common/exceptions/api.exception';

describe('OrderLifecycleService', () => {
  let service: OrderLifecycleService;
  const prisma = {
    $transaction: jest.fn(),
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
  };
  const notifications = {
    notifyUser: jest.fn().mockResolvedValue(undefined),
    notifyUsers: jest.fn().mockResolvedValue(undefined),
  };
  const sockets = {
    emitToUser: jest.fn(),
    getServer: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderLifecycleService,
        OrderStateMachineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AppNotificationsService, useValue: notifications },
        { provide: SocketEmitService, useValue: sockets },
      ],
    }).compile();

    service = moduleRef.get(OrderLifecycleService);
  });

  it('returns existing order without writes when status unchanged', async () => {
    const existingOrder = {
      id: 'order-1',
      orderNumber: 'ORD-2026-000001',
      status: 'pending',
      butcher: { id: 'b1', userId: 'butcher-1' },
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              paymentStatus: 'paid',
              productId: 'p1',
              customerId: 'c1',
              reservedQuantity: 2,
              butcherId: 'b1',
              butcherUserId: 'butcher-1',
            },
          ]),
          butcherOrder: {
            findUnique: jest.fn().mockResolvedValue(existingOrder),
            update: jest.fn(),
          },
          orderTimeline: { create: jest.fn() },
          orderStatusAudit: { create: jest.fn() },
          $executeRaw: jest.fn(),
        }),
    );

    const result = await service.transitionOrder({
      orderId: 'order-1',
      actorId: 'butcher-1',
      nextStatus: 'pending',
    });

    expect(result).toEqual(existingOrder);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
    expect(notifications.notifyUsers).not.toHaveBeenCalled();
    expect(sockets.emitToUser).not.toHaveBeenCalled();
  });

  it('rejects confirm when order is unpaid', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              paymentStatus: 'unpaid',
              productId: 'p1',
              customerId: 'c1',
              reservedQuantity: 2,
              butcherId: 'b1',
              butcherUserId: 'butcher-1',
            },
          ]),
          butcherOrder: {
            findUnique: jest.fn(),
            update: jest.fn(),
          },
          orderTimeline: { create: jest.fn() },
          orderStatusAudit: { create: jest.fn() },
          $executeRaw: jest.fn(),
        }),
    );

    await expect(
      service.transitionOrder({
        orderId: 'order-1',
        actorId: 'butcher-1',
        nextStatus: 'confirmed',
      }),
    ).rejects.toMatchObject({ error: 'payment_required', status: 402 });
  });

  it('creates timeline, audit, and notifies on valid transition', async () => {
    const updatedOrder = {
      id: 'order-1',
      orderNumber: 'ORD-2026-000001',
      status: 'confirmed',
      butcher: { id: 'b1', userId: 'butcher-1' },
    };
    const timelineCreate = jest.fn().mockResolvedValue({
      status: 'confirmed',
      note: null,
      createdAt: new Date('2026-07-07T10:00:00Z'),
    });
    const orderUpdate = jest.fn().mockResolvedValue(updatedOrder);

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              paymentStatus: 'paid',
              productId: 'p1',
              customerId: 'c1',
              reservedQuantity: 2,
              butcherId: 'b1',
              butcherUserId: 'butcher-1',
            },
          ]),
          butcherOrder: {
            findUnique: jest.fn(),
            update: orderUpdate,
          },
          orderTimeline: { create: timelineCreate },
          orderStatusAudit: { create: jest.fn().mockResolvedValue({}) },
          $executeRaw: jest.fn(),
        }),
    );

    const result = await service.transitionOrder({
      orderId: 'order-1',
      actorId: 'butcher-1',
      nextStatus: 'confirmed',
    });

    expect(result).toEqual(updatedOrder);
    expect(timelineCreate).toHaveBeenCalled();
    expect(notifications.notifyUsers).toHaveBeenCalled();
    expect(sockets.emitToUser).toHaveBeenCalled();
  });

  it('rejects invalid transitions inside the transaction', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              paymentStatus: 'paid',
              productId: 'p1',
              customerId: 'c1',
              reservedQuantity: 2,
              butcherId: 'b1',
              butcherUserId: 'butcher-1',
            },
          ]),
          butcherOrder: { findUnique: jest.fn(), update: jest.fn() },
          orderTimeline: { create: jest.fn() },
          orderStatusAudit: { create: jest.fn() },
          $executeRaw: jest.fn(),
        }),
    );

    await expect(
      service.transitionOrder({
        orderId: 'order-1',
        actorId: 'butcher-1',
        nextStatus: 'delivered',
      }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('stores cancellation reason and releases inventory reservation', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const updatedOrder = {
      id: 'order-1',
      orderNumber: 'ORD-2026-000001',
      status: 'cancelled',
      butcher: { id: 'b1', userId: 'butcher-1' },
    };
    const timelineCreate = jest.fn().mockResolvedValue({
      status: 'cancelled',
      note: 'المنتج غير متوفر',
      createdAt: new Date(),
    });

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              paymentStatus: 'paid',
              productId: 'p1',
              customerId: 'c1',
              reservedQuantity: 3,
              butcherId: 'b1',
              butcherUserId: 'butcher-1',
            },
          ]),
          butcherOrder: {
            update: jest.fn().mockResolvedValue(updatedOrder),
          },
          orderTimeline: { create: timelineCreate },
          orderStatusAudit: { create: jest.fn().mockResolvedValue({}) },
          $executeRaw: executeRaw,
        }),
    );

    await service.transitionOrder({
      orderId: 'order-1',
      actorId: 'butcher-1',
      nextStatus: 'cancelled',
      cancellationReason: 'المنتج غير متوفر',
    });

    expect(executeRaw).toHaveBeenCalled();
    expect(timelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: 'المنتج غير متوفر',
          status: 'cancelled',
        }),
      }),
    );
  });

  it('generates sequential order numbers on create', async () => {
    const seqUpdate = jest
      .fn()
      .mockResolvedValueOnce({ lastNumber: 1 })
      .mockResolvedValueOnce({ lastNumber: 2 });
    const orderCreate = jest.fn().mockResolvedValue({
      id: 'order-new',
      orderNumber: 'ORD-2026-000001',
      status: 'pending',
      customerId: 'c1',
      butcher: { id: 'b1', userId: 'butcher-1' },
    });

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn().mockResolvedValue(1),
          orderNumberSequence: {
            upsert: jest.fn().mockResolvedValue({}),
            update: seqUpdate,
          },
          butcherOrder: { create: orderCreate },
          orderTimeline: { create: jest.fn().mockResolvedValue({}) },
        }),
    );

    await service.createOrder({
      butcherId: 'b1',
      customerId: 'c1',
      paymentStatus: 'paid',
              productId: 'p1',
      cutType: 'whole',
      weightKg: 2,
      deliveryType: 'pickup',
      currency: 'SAR',
      totalPrice: 100,
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: expect.stringMatching(/^ORD-\d{4}-\d{6}$/),
          reservedQuantity: 2,
        }),
      }),
    );
  });
});
