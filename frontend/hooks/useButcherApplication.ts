// Hook for butcher application user flows — wraps services/butcherApplications.ts

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  createApplicationDraft,
  deleteApplicationDocument,
  getApplication,
  listApplications,
  registerApplicationDocument,
  replaceApplicationDocument,
  submitApplication,
  toApiError,
  updateApplicationDraft,
  withdrawApplication,
} from '@/services/butcherApplications';
import type {
  ApplicationListQuery,
  ApplicationSnapshotInput,
  ButcherApplicationDocumentType,
  DocumentReplaceInput,
  LocalFileUploadParams,
  SubmitInput,
  WithdrawInput,
} from '@/services/butcherApplicationTypes';
import { uploadButcherApplicationFileFromUri } from '@/services/upload';
import {
  validateDocumentReplaceInput,
  validateDocumentUploadInput,
  validateSnapshotInput,
  validateSubmitInput,
  validateWithdrawInput,
} from '@/lib/butcherApplicationValidation';

function toErrorMessage(err: unknown): string {
  const apiErr = toApiError(err);
  if (apiErr) return apiErr.messageAr;
  if (err instanceof Error) return err.message;
  return 'حدث خطأ غير متوقع';
}

export function useButcherApplication() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createDraft = useCallback(
    (snapshot: ApplicationSnapshotInput = {}) =>
      run(async () => {
        const validation = validateSnapshotInput(snapshot);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات غير صحيحة');
        }
        return createApplicationDraft(snapshot);
      }),
    [run],
  );

  const updateDraft = useCallback(
    (
      applicationId: string,
      snapshot: ApplicationSnapshotInput,
      expectedUpdatedAt?: string | Date,
    ) =>
      run(async () => {
        const validation = validateSnapshotInput(snapshot);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات غير صحيحة');
        }
        return updateApplicationDraft(applicationId, snapshot, expectedUpdatedAt);
      }),
    [run],
  );

  const submit = useCallback(
    (applicationId: string, input: SubmitInput) =>
      run(async () => {
        const validation = validateSubmitInput(input);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات غير صحيحة');
        }
        return submitApplication(applicationId, input);
      }),
    [run],
  );

  const withdraw = useCallback(
    (applicationId: string, input: WithdrawInput = {}) =>
      run(async () => {
        const validation = validateWithdrawInput(input);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات غير صحيحة');
        }
        return withdrawApplication(applicationId, input);
      }),
    [run],
  );

  const get = useCallback(
    (applicationId: string) => run(() => getApplication(applicationId)),
    [run],
  );

  const list = useCallback(
    (query: ApplicationListQuery = {}) => run(() => listApplications(query)),
    [run],
  );

  const uploadDocument = useCallback(
    (
      applicationId: string,
      type: ButcherApplicationDocumentType,
      file: LocalFileUploadParams,
    ) =>
      run(async () => {
        if (!accessToken) {
          throw new Error('يجب تسجيل الدخول أولاً');
        }

        const uploaded = await uploadButcherApplicationFileFromUri(accessToken, file.localUri, {
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
        });

        const payload = {
          type,
          fileKey: uploaded.fileKey,
          mimeType: uploaded.mimeType,
          fileSizeBytes: uploaded.fileSizeBytes,
          originalFileName: uploaded.originalFileName,
        };

        const validation = validateDocumentUploadInput(payload);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات المستند غير صحيحة');
        }

        return registerApplicationDocument(applicationId, payload);
      }),
    [accessToken, run],
  );

  const replaceDocument = useCallback(
    (
      applicationId: string,
      documentId: string,
      type: ButcherApplicationDocumentType,
      file: LocalFileUploadParams,
    ) =>
      run(async () => {
        if (!accessToken) {
          throw new Error('يجب تسجيل الدخول أولاً');
        }

        const uploaded = await uploadButcherApplicationFileFromUri(accessToken, file.localUri, {
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
        });

        const payload: DocumentReplaceInput = {
          fileKey: uploaded.fileKey,
          mimeType: uploaded.mimeType,
          fileSizeBytes: uploaded.fileSizeBytes,
          originalFileName: uploaded.originalFileName,
        };

        const validation = validateDocumentReplaceInput(type, payload);
        if (!validation.valid) {
          throw new Error(validation.issues[0]?.message ?? 'بيانات المستند غير صحيحة');
        }

        return replaceApplicationDocument(applicationId, documentId, payload);
      }),
    [accessToken, run],
  );

  const deleteDocument = useCallback(
    (applicationId: string, documentId: string) =>
      run(() => deleteApplicationDocument(applicationId, documentId)),
    [run],
  );

  return {
    createDraft,
    updateDraft,
    submit,
    withdraw,
    get,
    list,
    uploadDocument,
    replaceDocument,
    deleteDocument,
    loading,
    error,
  };
}
