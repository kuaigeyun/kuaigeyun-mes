/**
 * 往来对账单入库明细展开（采购入库 / 委外收货共用）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../utils/format';
import {
  partnerStatementService,
  type PartnerStatementLine,
} from '../services/finance/partnerStatement';
import { App } from 'antd';

const PS = 'app.kuaicaiwu.partnerStatement';

const money = (v: number | string | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function partnerStatementLineDetailKey(line: PartnerStatementLine): string {
  return line.inbound_detail_doc_type && line.inbound_detail_doc_id
    ? `${line.inbound_detail_doc_type}-${line.inbound_detail_doc_id}`
    : '';
}

export function usePartnerStatementInboundDetail() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [cache, setCache] = useState<
    Record<string, { loading?: boolean; items?: Array<Record<string, unknown>> }>
  >({});

  const loadLineDetail = useCallback(
    async (line: PartnerStatementLine) => {
      const key = partnerStatementLineDetailKey(line);
      if (!key) return;
      let shouldFetch = false;
      setCache((prev) => {
        if (prev[key]?.items || prev[key]?.loading) return prev;
        shouldFetch = true;
        return { ...prev, [key]: { loading: true } };
      });
      if (!shouldFetch) return;
      try {
        const res = await partnerStatementService.getLineDetail({
          doc_type: String(line.inbound_detail_doc_type),
          doc_id: Number(line.inbound_detail_doc_id),
        });
        setCache((prev) => ({ ...prev, [key]: { items: res.items || [] } }));
      } catch (e: unknown) {
        const err = e as { message?: string };
        message.error(err?.message || t(`${PS}.lineDetail.loadFailed`));
        setCache((prev) => ({ ...prev, [key]: { items: [] } }));
      }
    },
    [message, t],
  );

  return { cache, loadLineDetail };
}

export function usePartnerStatementInboundDetailColumns(
  inboundDocType?: string | null,
): ColumnsType<Record<string, unknown>> {
  const { t } = useTranslation();
  const isOutsource =
    inboundDocType === 'outsource_material_receipt' ||
    inboundDocType === '委外收货' ||
    inboundDocType === 'outsource_receipt';

  return useMemo(
    () => [
      { title: t(`${PS}.lineDetail.materialCode`), dataIndex: 'material_code', width: 120 },
      { title: t(`${PS}.lineDetail.materialName`), dataIndex: 'material_name', ellipsis: true },
      {
        title: t(isOutsource ? `${PS}.lineDetail.outsourceQuantity` : `${PS}.lineDetail.purchaseQuantity`),
        dataIndex: 'quantity',
        width: 100,
        align: 'right',
      },
      {
        title: t(isOutsource ? `${PS}.lineDetail.outsourceUnitPrice` : `${PS}.lineDetail.purchaseUnitPrice`),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right',
        render: (v: number) => money(v),
      },
      {
        title: t(isOutsource ? `${PS}.lineDetail.outsourceAmount` : `${PS}.lineDetail.purchaseAmount`),
        dataIndex: 'amount',
        width: 110,
        align: 'right',
        render: (v: number) => money(v),
      },
      {
        title: t(`${PS}.lineDetail.inspectionDate`),
        dataIndex: 'inspection_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '—'),
      },
      {
        title: t(`${PS}.lineDetail.inspectionQty`),
        dataIndex: 'inspection_quantity',
        width: 90,
        align: 'right',
        render: (v: unknown) => (v == null || v === '' ? '—' : v),
      },
      {
        title: t(`${PS}.lineDetail.qualifiedQty`),
        dataIndex: 'qualified_quantity',
        width: 90,
        align: 'right',
      },
      {
        title: t(`${PS}.lineDetail.unqualifiedQty`),
        dataIndex: 'unqualified_quantity',
        width: 100,
        align: 'right',
      },
      { title: t(`${PS}.lineDetail.defectReason`), dataIndex: 'defect_reason', ellipsis: true },
      {
        title: t(`${PS}.lineDetail.processWaste`),
        dataIndex: 'process_waste_qty',
        width: 80,
        align: 'right',
        render: (v: unknown) => (v == null || v === '' ? '—' : v),
      },
      {
        title: t(`${PS}.lineDetail.materialWaste`),
        dataIndex: 'material_waste_qty',
        width: 80,
        align: 'right',
        render: (v: unknown) => (v == null || v === '' ? '—' : v),
      },
    ],
    [isOutsource, t],
  );
}

type ExpandedProps = {
  line: PartnerStatementLine;
  cache: Record<string, { loading?: boolean; items?: Array<Record<string, unknown>> }>;
};

export const PartnerStatementInboundExpandedRow: React.FC<ExpandedProps> = ({ line, cache }) => {
  const { t } = useTranslation();
  const key = partnerStatementLineDetailKey(line);
  const cached = key ? cache[key] : undefined;
  const columns = usePartnerStatementInboundDetailColumns(line.inbound_detail_doc_type);
  if (cached?.loading) {
    return <Spin size="small" />;
  }
  return (
    <Table
      size="small"
      rowKey={(_row, idx) => `${line.doc_code}-detail-${idx}`}
      pagination={false}
      dataSource={cached?.items || []}
      columns={columns}
      scroll={{ x: 1400 }}
      locale={{ emptyText: t(`${PS}.lineDetail.empty`) }}
    />
  );
};

export function partnerStatementExpandableProps(
  cache: Record<string, { loading?: boolean; items?: Array<Record<string, unknown>> }>,
  loadLineDetail: (line: PartnerStatementLine) => void | Promise<void>,
) {
  return {
    rowExpandable: (record: PartnerStatementLine) =>
      Boolean(record.inbound_detail_doc_type && record.inbound_detail_doc_id),
    onExpand: (expanded: boolean, record: PartnerStatementLine) => {
      if (expanded) void loadLineDetail(record);
    },
    expandedRowRender: (record: PartnerStatementLine) => (
      <PartnerStatementInboundExpandedRow line={record} cache={cache} />
    ),
  };
}
