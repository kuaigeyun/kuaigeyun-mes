import { useCallback, useEffect, useRef } from 'react';
import { clearDocumentFormDraft, setDocumentFormDraft } from '../utils/documentFormDraftCache';

/**
 * 仓库 pull-entry 等非 ProForm 页面的 state 快照（非 `/new` 路由）。
 * `/new`、`/create` 与 `/:id/edit` 标签 keep-alive 由 TabRouteCache 负责，勿用本 hook。
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
