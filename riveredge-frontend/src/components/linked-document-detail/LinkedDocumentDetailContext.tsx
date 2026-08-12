/**
 * 关联单据详情抽屉（当前页嵌套打开，不跳转列表）。
 * 唯一入口：openLinkedDocumentDetail(type, id)。
 * 内容：各单据原版 DetailDrawerTemplate 插槽壳（禁止 Brief / plainBody 另写）。
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { theme } from 'antd';
import { canOpenLinkedDocumentDetail } from '../../apps/kuaizhizao/utils/linkedDocumentDetail';
import { SalesOrderLinkedDetailDrawer } from './drawers/SalesOrderLinkedDetailDrawer';
import { PurchaseOrderLinkedDetailDrawer } from './drawers/PurchaseOrderLinkedDetailDrawer';
import { QuotationLinkedDetailDrawer } from './drawers/QuotationLinkedDetailDrawer';
import { SalesDeliveryLinkedDetailDrawer } from './drawers/SalesDeliveryLinkedDetailDrawer';
import { PurchaseReceiptLinkedDetailDrawer } from './drawers/PurchaseReceiptLinkedDetailDrawer';

/** 高于列表详情抽屉与报价单内嵌关联抽屉（常见 base+50） */
const LINKED_DRAWER_Z_OFFSET = 60;

type OpenFn = (documentType: string, documentId: number) => boolean;

type CtxValue = {
  openLinkedDocumentDetail: OpenFn;
};

const LinkedDocumentDetailContext = createContext<CtxValue | null>(null);

export function useLinkedDocumentDetail(): CtxValue {
  const ctx = useContext(LinkedDocumentDetailContext);
  if (!ctx) {
    throw new Error('useLinkedDocumentDetail must be used within LinkedDocumentDetailProvider');
  }
  return ctx;
}

/** 无 Provider 时不抛错（如单测）；有则打开抽屉 */
export function useOptionalLinkedDocumentDetail(): CtxValue | null {
  return useContext(LinkedDocumentDetailContext);
}

type Target = { documentType: string; documentId: number };

function LinkedDocumentDetailHost({
  target,
  onClose,
}: {
  target: Target | null;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const zIndex = token.zIndexPopupBase + LINKED_DRAWER_Z_OFFSET;
  const open = Boolean(target);
  const documentType = target?.documentType ?? '';
  const documentId = target?.documentId ?? 0;

  if (!open || documentId <= 0) return null;

  switch (documentType) {
    case 'sales_order':
      return (
        <SalesOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
    case 'purchase_order':
      return (
        <PurchaseOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
    case 'quotation':
      return (
        <QuotationLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
    case 'sales_delivery':
      return (
        <SalesDeliveryLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
    case 'purchase_receipt':
      return (
        <PurchaseReceiptLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
    default:
      return null;
  }
}

export function LinkedDocumentDetailProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);

  const openLinkedDocumentDetail = useCallback<OpenFn>((documentType, documentId) => {
    const type = String(documentType ?? '').trim();
    const id = Number(documentId);
    if (!canOpenLinkedDocumentDetail(type) || !Number.isFinite(id) || id <= 0) return false;
    setTarget({ documentType: type, documentId: id });
    return true;
  }, []);

  const onClose = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ openLinkedDocumentDetail }), [openLinkedDocumentDetail]);

  return (
    <LinkedDocumentDetailContext.Provider value={value}>
      {children}
      <LinkedDocumentDetailHost target={target} onClose={onClose} />
    </LinkedDocumentDetailContext.Provider>
  );
}

/** 供非 React 点击处复用：优先抽屉，无 Provider 时返回 false */
export function openLinkedDocumentDetailOrFalse(
  ctx: CtxValue | null,
  documentType: string,
  documentId: number,
): boolean {
  if (!ctx) return false;
  return ctx.openLinkedDocumentDetail(documentType, documentId);
}
