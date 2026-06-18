import { useCallback, useEffect, useRef } from 'react';
import { clearDocumentFormDraft, setDocumentFormDraft } from '../utils/documentFormDraftCache';

/**
 * 非 ProForm 页面草稿：state 变更时 persistNow + 卸载时再快照（TAB 切换保活）。
 */
export function useRecordFormDraft(draftKey: string | null) {
  const snapshotRef = useRef<() => Record<string, unknown>>(() => ({}));
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;

  useEffect(() => {
    return () => {
      if (!draftKeyRef.current) return;
      setDocumentFormDraft(draftKeyRef.current, snapshotRef.current());
    };
  }, []);

  const bindSnapshot = useCallback((getter: () => Record<string, unknown>) => {
    snapshotRef.current = getter;
  }, []);

  const persistNow = useCallback(() => {
    if (draftKey) {
      setDocumentFormDraft(draftKey, snapshotRef.current());
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (draftKey) clearDocumentFormDraft(draftKey);
  }, [draftKey]);

  return { bindSnapshot, persistNow, clearDraft };
}
