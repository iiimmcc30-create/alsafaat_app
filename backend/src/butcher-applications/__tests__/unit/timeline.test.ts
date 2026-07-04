import { appendTimelineEvent } from '../../helpers/timeline';

describe('appendTimelineEvent', () => {
  it('creates a timeline row with actor include', async () => {
    const created = {
      id: 'event-1',
      action: 'COMMENT',
      comment: 'note',
      createdBy: 'user-1',
      metadata: {},
      createdAt: new Date(),
      actor: { id: 'user-1', username: 'admin' },
    };

    const create = jest.fn().mockResolvedValue(created);
    const tx = {
      butcherApplicationTimelineEvent: { create },
    };

    const result = await appendTimelineEvent(tx as any, {
      applicationId: 'app-1',
      action: 'COMMENT',
      createdBy: 'user-1',
      comment: 'note',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        applicationId: 'app-1',
        action: 'COMMENT',
        createdBy: 'user-1',
        comment: 'note',
        metadata: {},
      },
      include: {
        actor: { select: { id: true, username: true } },
      },
    });
    expect(result).toBe(created);
  });
});
