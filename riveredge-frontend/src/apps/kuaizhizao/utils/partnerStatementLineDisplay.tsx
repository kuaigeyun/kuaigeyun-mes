import React from 'react';
import type { PartnerStatementLine } from '../services/finance/partnerStatement';

export type FinanceHierarchyLine = {
  tree_level?: number;
};

/** 业财单据层级：收/付款挂在应收/应付下时缩进显示 */
export function renderFinanceHierarchyDocType(
  docType: string | undefined,
  record: FinanceHierarchyLine,
): React.ReactNode {
  const level = Number(record.tree_level || 0);
  const label = docType || '—';
  if (level <= 0) return label;
  return (
    <span style={{ paddingLeft: 16, color: 'rgba(0,0,0,0.65)' }}>
      └ {label}
    </span>
  );
}

/** 对账明细单据类型列：收/付款挂在应收/应付下时缩进显示 */
export function renderPartnerStatementDocType(
  docType: string | undefined,
  record: PartnerStatementLine,
): React.ReactNode {
  return renderFinanceHierarchyDocType(docType, record);
}
