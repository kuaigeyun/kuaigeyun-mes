/**
 * 往来对账单入库明细展开（采购入库 / 委外收货共用）
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatCurrencyAmount } from '../../../utils/format';
import {
  partnerStatementService,
  type PartnerStatementLine,
} from '../services/finance/partnerStatement';
import { App } from 'antd';

const PS = 'app.kuaicaiwu.partnerStatement';

const money = (v: number | string | undefined) =>
  formatCurrencyAmount(v ?? 0);

export function partnerStatementLineDetailKey(line: PartnerStatementLine): string {
  return line.inbound_detail_doc_type && line.inbound_detail_doc_id
    ? `${line.inbound_detail_doc_type}-${line.inbound_detail_doc_id}`
    : '';
}

type LineDetailCacheEntry = {
  loading?: boolean;
  items?: Array<Record<string, unknown>>;
};

export function usePartnerStatementInboundDetail() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [cache, setCache] = useState<Record<string, LineDetailCacheEntry>>({});
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

  const clearCache = useCallback(() => {
    inflightRef.current.clear();
    setCache({});
  }, []);

  const loadLineDetail = useCallback(
    async (line: PartnerStatementLine) => {
      const key = partnerStatementLineDetailKey(line);
      if (!key) return;

      const inflight = inflightRef.current.get(key);
      if (inflight) {
        await inflight;
        return;
      }

      let alreadyLoaded = false;
      setCache((prev) => {
        if (prev[key]?.items) {
          alreadyLoaded = true;
          return prev;
        }
        return { ...prev, [key]: { loading: true } };
      });
      if (alreadyLoaded) return;

      const task = (async () => {
        try {
          const res = await partnerStatementService.getLineDetail({
            doc_type: String(line.inbound_detail_doc_type),
            doc_id: Number(line.inbound_detail_doc_id),
          });
          setCache((prev) => ({ ...prev, [key]: { items: res?.items || [] } }));
        } catch (e: unknown) {
          const err = e as { message?: string };
          message.error(err?.message || t(`${PS}.lineDetail.loadFailed`));
          setCache((prev) => ({ ...prev, [key]: { items: [] } }));
        } finally {
          inflightRef.current.delete(key);
        }
      })();

      inflightRef.current.set(key, task);
      await task;
    },
    [message, t],
  );

  return { cache, loadLineDetail, clearCache };
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
  entry?: LineDetailCacheEntry;
};

export const PartnerStatementInboundExpandedRow: React.FC<ExpandedProps> = ({ line, entry }) => {
  const { t } = useTranslation();
  const columns = usePartnerStatementInboundDetailColumns(line.inbound_detail_doc_type);
  if (entry?.loading && !entry.items) {
    return <Spin size="small" />;
  }
  return (
    <Table
      size="small"
      rowKey={(_row, idx) => `${line.doc_code}-detail-${idx}`}
      pagination={false}
      dataSource={entry?.items || []}
      columns={columns}
      scroll={{ x: 1400 }}
      locale={{ emptyText: t(`${PS}.lineDetail.empty`) }}
    />
  );
};

export function partnerStatementExpandableProps(
  cache: Record<string, LineDetailCacheEntry>,
  loadLineDetail: (line: PartnerStatementLine) => void | Promise<void>,
) {
  return {
    rowExpandable: (record: PartnerStatementLine) =>
      Boolean(record.inbound_detail_doc_type && record.inbound_detail_doc_id),
    onExpand: (expanded: boolean, record: PartnerStatementLine) => {
      if (expanded) void loadLineDetail(record);
    },
    expandedRowRender: (record: PartnerStatementLine) => {
      const key = partnerStatementLineDetailKey(record);
      return (
        <PartnerStatementInboundExpandedRow line={record} entry={key ? cache[key] : undefined} />
      );
    },
  };
}
