import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentTrackingResponse } from '../../services/documentTracking';
import { getDocumentTracking, normalizeDocumentTrackingResponse } from '../../services/documentTracking';

export interface UseDocumentTrackingResult {
  data: DocumentTrackingResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * 拉取单据跟踪（上下游 + 时间线），供详情抽屉多区块共用，避免重复请求。
 */
export function useDocumentTracking(
  documentType: string | undefined,
  documentId: number | undefined,
  refreshKey?: number
): UseDocumentTrackingResult {
  const { t } = useTranslation();
  const [data, setData] = useState<DocumentTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentType || documentId == null || Number.isNaN(Number(documentId))) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDocumentTracking(documentType, documentId)
      .then((d) => {
        if (!cancelled) setData(normalizeDocumentTrackingResponse(d));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || t('components.documentTrackingPanel.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentType, documentId, refreshKey, t]);

  return { data, loading, error };
}
