import React, { useMemo } from 'react';
import { InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TFunction } from 'i18next';
import type { PartnerStatementLine } from '../services/finance/partnerStatement';
import { renderFinanceHierarchyDocType } from './partnerStatementLineDisplay';
import { partnerStatementMoney } from './partnerStatementAmountUtils';

const PS = 'app.kuaicaiwu.partnerStatement';

export type PartnerStatementLineColumnOptions = {
  t: TFunction;
  balanceLabel: string;
  editable?: boolean;
  onStatementAmountChange?: (lineKey: string, amount: number) => void;
  lineKey?: (line: PartnerStatementLine, index: number) => string;
};

export function usePartnerStatementLineColumns(
  options: PartnerStatementLineColumnOptions,
): ColumnsType<PartnerStatementLine> {
  const { t, balanceLabel, editable, onStatementAmountChange, lineKey } = options;

  return useMemo(
    () => [
      { title: t(`${PS}.col.date`), dataIndex: 'date', width: 110 },
      {
        title: t(`${PS}.col.docType`),
        dataIndex: 'doc_type',
        width: 120,
        render: (v: string, record: PartnerStatementLine) => renderFinanceHierarchyDocType(v, record),
      },
      { title: t(`${PS}.col.docCode`), dataIndex: 'doc_code', width: 140, ellipsis: true },
      { title: t(`${PS}.col.summary`), dataIndex: 'summary', ellipsis: true },
      {
        title: t(`${PS}.col.docAmount`),
        dataIndex: 'doc_amount',
        width: 110,
        align: 'right' as const,
        render: (_: unknown, row: PartnerStatementLine) =>
          partnerStatementMoney(row.doc_amount ?? row.debit ?? row.credit),
      },
      {
        title: t(`${PS}.col.priorStatedAmount`),
        dataIndex: 'prior_stated_amount',
        width: 110,
        align: 'right' as const,
        render: (v: unknown) => partnerStatementMoney(v as number),
      },
      {
        title: t(`${PS}.col.remainingAmount`),
        dataIndex: 'remaining_amount',
        width: 110,
        align: 'right' as const,
        render: (v: unknown) => partnerStatementMoney(v as number),
      },
      {
        title: t(`${PS}.col.statementAmount`),
        dataIndex: 'statement_amount',
        width: 130,
        align: 'right' as const,
        render: (_: unknown, row: PartnerStatementLine, index: number) => {
          const value = Number(row.statement_amount ?? row.debit ?? row.credit ?? 0);
          const max = Number(row.remaining_amount ?? row.doc_amount ?? value);
          if (!editable) {
            return partnerStatementMoney(value);
          }
          const key = lineKey ? lineKey(row, index) : `${row.doc_code}-${index}`;
          return (
            <InputNumber
              size="small"
              min={0.01}
              max={max > 0 ? max : undefined}
              precision={2}
              value={value}
              style={{ width: '100%' }}
              onChange={(next) => {
                if (next == null) return;
                onStatementAmountChange?.(key, Number(next));
              }}
            />
          );
        },
      },
      {
        title: t(`${PS}.col.debit`),
        dataIndex: 'debit',
        width: 100,
        align: 'right' as const,
        render: (v: unknown) => (v ? partnerStatementMoney(v as number) : '—'),
      },
      {
        title: t(`${PS}.col.credit`),
        dataIndex: 'credit',
        width: 100,
        align: 'right' as const,
        render: (v: unknown) => (v ? partnerStatementMoney(v as number) : '—'),
      },
      {
        title: balanceLabel,
        dataIndex: 'balance',
        width: 110,
        align: 'right' as const,
        render: (v: unknown) => partnerStatementMoney(v as number),
      },
    ],
    [balanceLabel, editable, lineKey, onStatementAmountChange, t],
  );
}
