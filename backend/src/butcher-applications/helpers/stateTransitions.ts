import type { ButcherApplicationStatus, ButcherApplicationTimelineAction } from '@prisma/client';
import { ButcherApplicationError } from '../errors';

const ALLOWED_TRANSITIONS: Record<ButcherApplicationStatus, ButcherApplicationStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const TRANSITION_TIMELINE_ACTION: Partial<
  Record<ButcherApplicationStatus, ButcherApplicationTimelineAction>
> = {
  SUBMITTED: 'SUBMIT',
  APPROVED: 'APPROVE',
  REJECTED: 'REJECT',
  WITHDRAWN: 'WITHDRAW',
};

export function canTransition(
  from: ButcherApplicationStatus,
  to: ButcherApplicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ButcherApplicationStatus,
  to: ButcherApplicationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ButcherApplicationError('INVALID_STATUS_TRANSITION', { from, to });
  }
}

export function timelineActionForTransition(
  to: ButcherApplicationStatus,
): ButcherApplicationTimelineAction {
  const action = TRANSITION_TIMELINE_ACTION[to];
  if (!action) {
    throw new ButcherApplicationError('INVALID_STATUS_TRANSITION', { to });
  }
  return action;
}

export function assertEditableStatus(status: ButcherApplicationStatus): void {
  if (status !== 'DRAFT') {
    throw new ButcherApplicationError('APPLICATION_NOT_EDITABLE');
  }
}

export function assertSubmittedStatus(status: ButcherApplicationStatus): void {
  if (status !== 'SUBMITTED') {
    if (status === 'APPROVED') throw new ButcherApplicationError('APPLICATION_ALREADY_APPROVED');
    if (status === 'REJECTED') throw new ButcherApplicationError('APPLICATION_ALREADY_REJECTED');
    if (status === 'WITHDRAWN') throw new ButcherApplicationError('APPLICATION_ALREADY_WITHDRAWN');
    if (status === 'DRAFT') throw new ButcherApplicationError('INVALID_STATUS_TRANSITION');
    throw new ButcherApplicationError('INVALID_STATUS_TRANSITION');
  }
}

export function assertWithdrawableStatus(status: ButcherApplicationStatus): void {
  if (status === 'WITHDRAWN') {
    throw new ButcherApplicationError('APPLICATION_ALREADY_WITHDRAWN');
  }
  if (status !== 'SUBMITTED') {
    throw new ButcherApplicationError('INVALID_STATUS_TRANSITION');
  }
}

export function assertRejectableStatus(status: ButcherApplicationStatus): void {
  if (status === 'REJECTED') {
    throw new ButcherApplicationError('APPLICATION_ALREADY_REJECTED');
  }
  assertSubmittedStatus(status);
}

export function assertApprovableStatus(status: ButcherApplicationStatus): void {
  if (status === 'APPROVED') {
    return;
  }
  assertSubmittedStatus(status);
}

export function assertSubmittableStatus(status: ButcherApplicationStatus): void {
  if (status === 'SUBMITTED') {
    throw new ButcherApplicationError('APPLICATION_ALREADY_SUBMITTED');
  }
  if (status !== 'DRAFT') {
    throw new ButcherApplicationError('INVALID_STATUS_TRANSITION');
  }
}

export function getAllowedTransitionsFrom(
  from: ButcherApplicationStatus,
): ButcherApplicationStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}
