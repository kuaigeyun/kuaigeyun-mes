import React from 'react';
import type { PartnerStatementLine } from '../services/finance/partnerStatement';

/** 对账明细单据类型列：收/付款挂在应收/应付下时缩进显示 */
export function renderPartnerStatementDocType(
  docType: string | undefined,
  record: PartnerStatementLine,
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
