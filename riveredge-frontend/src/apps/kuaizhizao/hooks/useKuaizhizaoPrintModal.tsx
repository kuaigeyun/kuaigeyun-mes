/**
 * 快制造统一打印弹窗状态
 */

import { useCallback, useMemo, useState } from 'react';
import KuaizhizaoDocumentPrintModal from '../components/KuaizhizaoDocumentPrintModal';
import {
  buildKuaizhizaoPrintApiPath,
  getKuaizhizaoPrintTitle,
  type KuaizhizaoPrintDocumentType,
} from '../utils/kuaizhizaoPrintConfig';

export interface KuaizhizaoPrintTarget {
  documentType: KuaizhizaoPrintDocumentType | string;
  documentId: number;
  title?: string;
  printApiPath?: string;
  pdfDownloadFilename?: string;
}

export function useKuaizhizaoPrintModal(options?: {
  onAfterPrint?: (target: KuaizhizaoPrintTarget) => void | Promise<void>;
}) {
  const [target, setTarget] = useState<KuaizhizaoPrintTarget | null>(null);

  const openPrint = useCallback((next: KuaizhizaoPrintTarget) => {
    if (!next.documentId) return;
    setTarget(next);
  }, []);

  const closePrint = useCallback(() => setTarget(null), []);

  const PrintModal = useMemo(
    () => (
      <KuaizhizaoDocumentPrintModal
        open={!!target}
        onClose={closePrint}
        documentType={target?.documentType ?? ''}
        documentId={target?.documentId ?? null}
        printApiPath={
          target
            ? target.printApiPath ?? buildKuaizhizaoPrintApiPath(target.documentType, target.documentId)
            : ''
        }
        title={target?.title ?? (target ? getKuaizhizaoPrintTitle(target.documentType) : '打印预览')}
        pdfDownloadFilename={target?.pdfDownloadFilename}
        onAfterPrint={target && options?.onAfterPrint ? () => options.onAfterPrint!(target) : undefined}
      />
    ),
    [target, closePrint, options?.onAfterPrint],
  );

  return { openPrint, closePrint, printTarget: target, PrintModal };
}
