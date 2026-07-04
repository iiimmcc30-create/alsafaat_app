// Butcher Application API types — aligned with backend Phase C DTOs.

export const GCC_COUNTRIES = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'EG'] as const;
export type GccCountry = (typeof GCC_COUNTRIES)[number];

export type ButcherApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type ButcherApplicationDocumentType =
  | 'commercial_license'
  | 'national_id'
  | 'municipal_permit'
  | 'shop_photo'
  | 'other';

export type ButcherApplicationDocumentStatus = 'UPLOADED' | 'APPROVED' | 'REJECTED';

export type ButcherApplicationTimelineAction =
  | 'CREATE'
  | 'UPDATE'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'WITHDRAW'
  | 'COMMENT';

export type ApplicationSnapshotInput = {
  nameAr?: string;
  nameEn?: string;
  shopPhone?: string;
  commercialReg?: string;
  country?: GccCountry;
  city?: string;
  cityAr?: string;
  address?: string;
  addressAr?: string;
  lat?: number;
  lng?: number;
  bioAr?: string;
  bioEn?: string;
  specialties?: string[];
  openTime?: string;
  closeTime?: string;
};

export type SubmitInput = {
  acceptedTerms: true;
  confirmAccuracy: true;
};

export type WithdrawInput = {
  reason?: string;
};

export type DocumentUploadInput = {
  type: ButcherApplicationDocumentType;
  fileKey: string;
  originalFileName?: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type DocumentReplaceInput = {
  fileKey: string;
  originalFileName?: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type ApplicationListQuery = {
  cursor?: string;
  status?: ButcherApplicationStatus;
  limit?: number;
};

export type ApplicationSummary = {
  id: string;
  applicationNumber: number;
  status: ButcherApplicationStatus;
  nameAr: string | null;
  nameEn: string | null;
  country: GccCountry | null;
  city: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  provisionedButcherId: string | null;
};

export type ApplicationDetail = ApplicationSummary & {
  shopPhone: string | null;
  commercialReg: string | null;
  cityAr: string | null;
  address: string | null;
  addressAr: string | null;
  lat: number | null;
  lng: number | null;
  bioAr: string | null;
  bioEn: string | null;
  specialties: string[];
  openTime: string;
  closeTime: string;
  rejectionReason: string | null;
  acceptedTermsAt: string | null;
  documents: ApplicationDocument[];
  timeline: ApplicationTimelineEvent[];
  user?: {
    id: string;
    username: string;
    phone: string | null;
    avatar?: string | null;
  };
};

export type ApplicationDocument = {
  id: string;
  type: ButcherApplicationDocumentType;
  fileKey: string | null;
  status: ButcherApplicationDocumentStatus;
  notes: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationTimelineEvent = {
  id: string;
  action: ButcherApplicationTimelineAction;
  comment: string | null;
  createdBy: string;
  actorUsername: string;
  metadata: Record<string, unknown> | unknown[] | string | number | boolean | null;
  createdAt: string;
};

export type ApplicationListResult = {
  applications: ApplicationSummary[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type LocalFileUploadParams = {
  localUri: string;
  originalFileName?: string;
  mimeType?: string;
};

export class ButcherApplicationApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageAr: string;
  readonly details?: unknown;

  constructor(status: number, code: string, messageAr: string, details?: unknown) {
    super(messageAr);
    this.name = 'ButcherApplicationApiError';
    this.status = status;
    this.code = code;
    this.messageAr = messageAr;
    this.details = details;
  }
}
