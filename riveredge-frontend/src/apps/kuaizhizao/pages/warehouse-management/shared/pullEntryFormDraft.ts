import { useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useRecordFormDraft } from '../../../../../hooks/useRecordFormDraft';
import { buildDocumentCreateDraftKey, getDocumentFormDraft } from '../../../../../utils/documentFormDraftCache';
import { coerceFormDate } from '../../../../../utils/formDate';

export function mergeRecordMaps<T extends Record<number, unknown>>(
  base: T,
  overlay: Record<number, unknown> | undefined,
): T {
  if (!overlay || typeof overlay !== 'object') return base;
  return { ...base, ...overlay } as T;
}

export function draftDayjs(value: unknown, fallback = dayjs()): dayjs.Dayjs {
  const parsed = coerceFormDate(value);
  return parsed ?? fallback;
}

export function draftOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function mergeKeyedLineQuantities<T extends { key: string; return_quantity: number }>(
  lines: T[],
  qtyByKey: Record<string, number> | undefined,
): T[] {
  if (!qtyByKey) return lines;
  return lines.map((row) =>
    qtyByKey[row.key] != null ? { ...row, return_quantity: Number(qtyByKey[row.key]) } : row,
  );
}

export function mergeMaterialIssueQuantities<T extends { materialId: number; issueQuantity: number }>(
  lines: T[],
  qtyByMaterialId: Record<number, number> | undefined,
): T[] {
  if (!qtyByMaterialId) return lines;
  return lines.map((row) =>
    qtyByMaterialId[row.materialId] != null
      ? { ...row, issueQuantity: Number(qtyByMaterialId[row.materialId]) }
      : row,
  );
}

export function usePullEntryFormDraft(resourceKey: string) {
  const location = useLocation();
  const draftKey = useMemo(
    () => buildDocumentCreateDraftKey(resourceKey, location.pathname, location.search),
    [resourceKey, location.pathname, location.search],
  );
  const restoredRef = useRef(false);
  const { bindSnapshot, persistNow, clearDraft } = useRecordFormDraft(draftKey);

  const applyDraftOnce = useCallback(
    (apply: (draft: Record<string, unknown>) => void | Promise<void>) => {
      if (restoredRef.current || !draftKey) return;
      const draft = getDocumentFormDraft<Record<string, unknown>>(draftKey);
      if (!draft) return;
      restoredRef.current = true;
      void Promise.resolve(apply(draft));
    },
    [draftKey],
  );

  const resetDraftRestore = useCallback(() => {
    restoredRef.current = false;
  }, []);

  const clearDraftAndReset = useCallback(() => {
    clearDraft();
    resetDraftRestore();
  }, [clearDraft, resetDraftRestore]);

  return {
    draftKey,
    bindSnapshot,
    persistNow,
    clearDraft: clearDraftAndReset,
    applyDraftOnce,
    resetDraftRestore,
  };
}
