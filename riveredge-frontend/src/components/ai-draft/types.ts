/**
 * KU-Draft 生单契约（上传/粘贴 → 结构化预览 → 用户确认 → 建单）
 */

export type AiDraftDocumentType = 'sales_order' | 'purchase_order';

export type AiDraftParsePhase = 'idle' | 'parsing' | 'preview' | 'applying' | 'done' | 'error';

export interface AiDraftLineItem {
  materialCode?: string | null;
  materialName?: string | null;
  materialSpec?: string | null;
  materialUnit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  deliveryDate?: string | null;
  notes?: string | null;
}

export interface AiDraftResultBase {
  notes?: string | null;
  confidenceNotes?: string | null;
  items: AiDraftLineItem[];
}

export interface AiDraftApplyHandlers<T extends AiDraftResultBase> {
  applyToForm: (result: T) => void | Promise<void>;
  onApplied?: () => void;
}
