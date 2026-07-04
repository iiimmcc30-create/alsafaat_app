// Client-side validation for butcher applications — mirrors backend field rules.

import type {
  ApplicationDetail,
  ApplicationSnapshotInput,
  ButcherApplicationDocumentType,
  DocumentReplaceInput,
  DocumentUploadInput,
  GccCountry,
  SubmitInput,
  WithdrawInput,
} from '@/services/butcherApplicationTypes';

const REQUIRED_DOCUMENT_TYPES = [
  'commercial_license',
  'national_id',
  'municipal_permit',
  'shop_photo',
] as const;

const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SHOP_PHOTO_FILE_BYTES = 15 * 1024 * 1024;

const SUBMIT_REQUIRED_SNAPSHOT_FIELDS = [
  'nameAr',
  'nameEn',
  'shopPhone',
  'commercialReg',
  'country',
  'city',
  'cityAr',
  'address',
  'addressAr',
  'lat',
  'lng',
  'openTime',
  'closeTime',
] as const;

export const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SHOP_PHONE_REGEX = /^\+?[0-9]{8,15}$/;
export const COMMERCIAL_REG_REGEX = /^[A-Za-z0-9\-\/]+$/;
export const GCC_COUNTRIES: readonly GccCountry[] = ['SA'];

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

function result(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues };
}

function pushIf(
  issues: ValidationIssue[],
  condition: boolean,
  field: string,
  message: string,
): void {
  if (condition) issues.push({ field, message });
}

export function validateSnapshotField(
  field: keyof ApplicationSnapshotInput,
  value: unknown,
): ValidationIssue | null {
  if (value === undefined || value === null || value === '') return null;

  switch (field) {
    case 'nameAr':
    case 'nameEn':
    case 'city':
    case 'cityAr':
      if (typeof value !== 'string' || value.trim().length < 2 || value.length > 100) {
        return { field, message: 'يجب أن يكون بين ٢ و ١٠٠ حرفاً' };
      }
      return null;
    case 'shopPhone':
      if (typeof value !== 'string' || !SHOP_PHONE_REGEX.test(value)) {
        return { field, message: 'رقم هاتف غير صالح' };
      }
      return null;
    case 'commercialReg':
      if (
        typeof value !== 'string' ||
        value.length < 5 ||
        value.length > 50 ||
        !COMMERCIAL_REG_REGEX.test(value)
      ) {
        return { field, message: 'رقم السجل التجاري غير صالح' };
      }
      return null;
    case 'country':
      if (typeof value !== 'string' || !GCC_COUNTRIES.includes(value as GccCountry)) {
        return { field, message: 'الدولة غير مدعومة' };
      }
      return null;
    case 'address':
    case 'addressAr':
      if (typeof value !== 'string' || value.trim().length < 5 || value.length > 300) {
        return { field, message: 'العنوان يجب أن يكون بين ٥ و ٣٠٠ حرف' };
      }
      return null;
    case 'lat':
      if (typeof value !== 'number' || value < -90 || value > 90) {
        return { field, message: 'خط العرض غير صالح' };
      }
      return null;
    case 'lng':
      if (typeof value !== 'number' || value < -180 || value > 180) {
        return { field, message: 'خط الطول غير صالح' };
      }
      return null;
    case 'bioAr':
    case 'bioEn':
      if (typeof value !== 'string' || value.length > 1000) {
        return { field, message: 'النبذة طويلة جداً' };
      }
      return null;
    case 'specialties':
      if (!Array.isArray(value) || value.length > 20) {
        return { field, message: 'عدد التخصصات غير صالح' };
      }
      if (value.some((s) => typeof s !== 'string' || s.trim().length < 1 || s.length > 50)) {
        return { field, message: 'تخصص غير صالح' };
      }
      return null;
    case 'openTime':
    case 'closeTime':
      if (typeof value !== 'string' || !HH_MM_REGEX.test(value)) {
        return { field, message: 'صيغة الوقت يجب أن تكون HH:mm' };
      }
      return null;
    default:
      return null;
  }
}

/** Validate only fields present in a snapshot patch/create payload. */
export function validateSnapshotInput(input: ApplicationSnapshotInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const [key, value] of Object.entries(input) as [keyof ApplicationSnapshotInput, unknown][]) {
    const issue = validateSnapshotField(key, value);
    if (issue) issues.push(issue);
  }

  if (
    input.openTime !== undefined &&
    input.closeTime !== undefined &&
    input.openTime === input.closeTime
  ) {
    issues.push({
      field: 'closeTime',
      message: 'وقت الإغلاق يجب أن يختلف عن وقت الفتح',
    });
  }

  return result(issues);
}

/** Validate persisted application is ready to submit (mirrors server submit checks). */
export function validateSubmitReady(application: ApplicationDetail): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const field of SUBMIT_REQUIRED_SNAPSHOT_FIELDS) {
    const value = application[field as keyof ApplicationDetail];
    if (value === null || value === undefined || value === '') {
      issues.push({ field, message: 'حقل مطلوب' });
    }
  }

  if (!HH_MM_REGEX.test(application.openTime) || !HH_MM_REGEX.test(application.closeTime)) {
    issues.push({ field: 'openTime', message: 'صيغة الوقت غير صالحة' });
  } else if (application.openTime === application.closeTime) {
    issues.push({ field: 'closeTime', message: 'وقت الإغلاق يجب أن يختلف عن وقت الفتح' });
  }

  for (const docType of REQUIRED_DOCUMENT_TYPES) {
    const doc = application.documents.find(
      (d) => d.type === docType && d.fileKey && d.status === 'UPLOADED',
    );
    if (!doc) {
      issues.push({ field: `document.${docType}`, message: 'مستند مطلوب غير مرفوع' });
    }
  }

  return result(issues);
}

export function validateSubmitInput(input: SubmitInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  pushIf(issues, input.acceptedTerms !== true, 'acceptedTerms', 'يجب الموافقة على الشروط');
  pushIf(issues, input.confirmAccuracy !== true, 'confirmAccuracy', 'يجب تأكيد صحة البيانات');
  return result(issues);
}

export function validateWithdrawInput(input: WithdrawInput = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (input.reason !== undefined && input.reason.length > 500) {
    issues.push({ field: 'reason', message: 'السبب طويل جداً' });
  }
  return result(issues);
}

export function validateDocumentUploadInput(input: DocumentUploadInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.fileKey || input.fileKey.length < 10) {
    issues.push({ field: 'fileKey', message: 'مفتاح الملف غير صالح' });
  }

  if (
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(
      input.mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number],
    )
  ) {
    issues.push({ field: 'mimeType', message: 'نوع الملف غير مدعوم' });
  }

  const maxBytes =
    input.type === 'shop_photo' ? MAX_SHOP_PHOTO_FILE_BYTES : MAX_DOCUMENT_FILE_BYTES;

  if (!Number.isInteger(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    issues.push({ field: 'fileSizeBytes', message: 'حجم الملف غير صالح' });
  } else if (input.fileSizeBytes > maxBytes) {
    issues.push({ field: 'fileSizeBytes', message: 'حجم الملف يتجاوز الحد المسموح' });
  }

  if (
    input.originalFileName !== undefined &&
    (input.originalFileName.length < 1 || input.originalFileName.length > 255)
  ) {
    issues.push({ field: 'originalFileName', message: 'اسم الملف غير صالح' });
  }

  return result(issues);
}

export function validateDocumentReplaceInput(
  type: ButcherApplicationDocumentType,
  input: DocumentReplaceInput,
): ValidationResult {
  return validateDocumentUploadInput({
    type,
    ...input,
  });
}

export function isAllowedDocumentMime(mimeType: string): boolean {
  return ALLOWED_DOCUMENT_MIME_TYPES.includes(
    mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number],
  );
}

export function maxBytesForDocumentType(type: ButcherApplicationDocumentType): number {
  return type === 'shop_photo' ? MAX_SHOP_PHOTO_FILE_BYTES : MAX_DOCUMENT_FILE_BYTES;
}

export function maxBytesLabelForDocumentType(type: ButcherApplicationDocumentType): string {
  const mb = maxBytesForDocumentType(type) / (1024 * 1024);
  return `${mb} م.ب`;
}

export function validatePickedDocumentFile(
  type: ButcherApplicationDocumentType,
  mimeType: string,
  fileSizeBytes: number | undefined,
): ValidationIssue | null {
  if (!isAllowedDocumentMime(mimeType)) {
    return { field: 'mimeType', message: 'نوع الملف غير مدعوم. المسموح: PDF، JPG، PNG، WEBP' };
  }
  if (fileSizeBytes === undefined || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return { field: 'fileSizeBytes', message: 'تعذّر قراءة حجم الملف' };
  }
  const maxBytes = maxBytesForDocumentType(type);
  if (fileSizeBytes > maxBytes) {
    return {
      field: 'fileSizeBytes',
      message: `حجم الملف يتجاوز الحد المسموح (${maxBytesLabelForDocumentType(type)})`,
    };
  }
  return null;
}

const WIZARD_STEP1_FIELDS = [
  'nameAr',
  'nameEn',
  'shopPhone',
  'commercialReg',
  'country',
  'city',
  'cityAr',
  'address',
  'addressAr',
] as const satisfies readonly (keyof ApplicationSnapshotInput)[];

const WIZARD_STEP2_FIELDS = ['lat', 'lng'] as const satisfies readonly (keyof ApplicationSnapshotInput)[];

const WIZARD_STEP3_REQUIRED_FIELDS = ['openTime', 'closeTime'] as const satisfies readonly (keyof ApplicationSnapshotInput)[];

const WIZARD_STEP3_OPTIONAL_FIELDS = ['bioAr', 'bioEn', 'specialties'] as const satisfies readonly (keyof ApplicationSnapshotInput)[];

function validateRequiredFields(
  fields: readonly (keyof ApplicationSnapshotInput)[],
  input: ApplicationSnapshotInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    const value = input[field];
    if (value === undefined || value === null || value === '') {
      issues.push({ field, message: 'حقل مطلوب' });
      continue;
    }
    const issue = validateSnapshotField(field, value);
    if (issue) issues.push(issue);
  }
  return issues;
}

export function issuesByField(issues: ValidationIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    if (!map[issue.field]) map[issue.field] = issue.message;
  }
  return map;
}

export function validateWizardStep1(input: ApplicationSnapshotInput): ValidationResult {
  return result(validateRequiredFields(WIZARD_STEP1_FIELDS, input));
}

export function validateWizardStep2(input: ApplicationSnapshotInput): ValidationResult {
  return result(validateRequiredFields(WIZARD_STEP2_FIELDS, input));
}

export function validateWizardStep3(input: ApplicationSnapshotInput): ValidationResult {
  const issues = validateRequiredFields(WIZARD_STEP3_REQUIRED_FIELDS, input);
  for (const field of WIZARD_STEP3_OPTIONAL_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null || value === '') continue;
    const issue = validateSnapshotField(field, value);
    if (issue) issues.push(issue);
  }
  if (
    input.openTime !== undefined &&
    input.closeTime !== undefined &&
    input.openTime === input.closeTime
  ) {
    issues.push({
      field: 'closeTime',
      message: 'وقت الإغلاق يجب أن يختلف عن وقت الفتح',
    });
  }
  return result(issues);
}
