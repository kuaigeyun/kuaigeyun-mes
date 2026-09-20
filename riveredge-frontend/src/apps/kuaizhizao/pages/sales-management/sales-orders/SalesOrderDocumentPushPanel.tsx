/**
 * 销售订单外推：DocumentPushBatchPanel 薄封装（source=sales_order → kingdee_sal_saleorder）。
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicationConnection } from '../../../../../services/applicationConnection';
import type { API } from '../../../../../services/apiManagement';
import { DocumentPushBatchPanel } from '../../../components/DocumentPushBatchPanel';
import {
  getSalesOrder,
  listSalesOrders,
  type SalesOrder,
} from '../../../services/sales-order';

export interface SalesOrderPushCandidate {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  review_status?: string;
  total_quantity?: number;
  order_date?: string;
}

export interface SalesOrderDocumentPushPanelProps {
  open: boolean;
  onClose: () => void;
  orderIds?: number[];
  onComplete?: () => void;
  embedded?: boolean;
}

const SALES_DEFAULT_PROFILES = ['kingdee_sal_saleorder'];
const SALES_KINGDEE_PROFILES = ['kingdee_sal_saleorder'];
const SALES_SAVE_API_HINTS = ['saleorder', '销售订单', 'push_sal'];

const PUSHABLE_STATUSES = new Set([
  'CONFIRMED',
  'AUDITED',
  'APPROVED',
  'RELEASED',
  'IN_PROGRESS',
  'COMPLETED',
]);

function isKingdeeSalSaleOrderSaveApi(
  api: API,
  connection: ApplicationConnection | undefined,
): boolean {
  if (!connection) return false;
  if (api.connection_uuid && api.connection_uuid !== connection.uuid) return false;
  const code = String(api.code || '').toLowerCase();
  const path = String(api.path || '').toLowerCase();
  const name = String(api.name || '').toLowerCase();
  const hay = `${code} ${path} ${name}`;
  if (code.includes('save_sal_saleorder') || code.includes('push_sal')) return true;
  const isSave = path.includes('save') || hay.includes('save');
  const isSale =
    hay.includes('saleorder') ||
    hay.includes('sal_saleorder') ||
    name.includes('销售订单');
  return isSave && isSale;
}

function preferSalApiUuid(items: API[]): string | undefined {
  const preferred =
    items.find((api) => String(api.code || '').toLowerCase().includes('push_sal')) ||
    items.find((api) => String(api.code || '').toLowerCase().includes('save_sal_saleorder')) ||
    items.find((api) => String(api.name || '').includes('销售订单')) ||
    items[0];
  return preferred?.uuid;
}

function isPushableOrder(row: { status?: string; review_status?: string }): boolean {
  const review = String(row.review_status || '').trim().toUpperCase();
  const status = String(row.status || '').trim().toUpperCase();
  return review === 'APPROVED' || PUSHABLE_STATUSES.has(status);
}

function toCandidate(row: SalesOrder): SalesOrderPushCandidate | null {
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    order_code: row.order_code,
    customer_name: row.customer_name,
    status: row.status,
    review_status: row.review_status,
    total_quantity: row.total_quantity,
    order_date: row.order_date,
  };
}

function sortCandidates(
  data: SalesOrderPushCandidate[],
  preferIds: number[],
): SalesOrderPushCandidate[] {
  const preferSet = new Set(preferIds);
  return [...data].sort((a, b) => {
    const ap = preferSet.has(a.id) ? 0 : 1;
    const bp = preferSet.has(b.id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const aa = isPushableOrder(a) ? 0 : 1;
    const bb = isPushableOrder(b) ? 0 : 1;
    return aa - bb;
  });
}

export const SalesOrderDocumentPushPanel: React.FC<SalesOrderDocumentPushPanelProps> = ({
  open,
  onClose,
  orderIds,
  onComplete,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesOrder.orderCode'),
        dataIndex: 'order_code',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.customerName'),
        dataIndex: 'customer_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.totalQuantity'),
        dataIndex: 'total_quantity',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.salesOrder.orderDate'),
        dataIndex: 'order_date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 100,
        ellipsis: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        ellipsis: true,
      },
    ],
    [t],
  );

  const loadCandidates = useCallback(
    async ({
      keyword,
      page,
      pageSize,
      preferIds,
    }: {
      keyword: string;
      page: number;
      pageSize: number;
      preferIds: number[];
    }) => {
      const res = await listSalesOrders({
        keyword: keyword || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        order_by: '-order_date',
      });
      let data = (res.data || [])
        .map(toCandidate)
        .filter((row): row is SalesOrderPushCandidate => !!row);

      if (preferIds.length && page === 1) {
        const missing = preferIds.filter((id) => !data.some((row) => row.id === id));
        if (missing.length) {
          const extras: SalesOrderPushCandidate[] = [];
          for (const id of missing.slice(0, 20)) {
            try {
              const one = await getSalesOrder(id);
              const c = toCandidate(one);
              if (c) extras.push(c);
            } catch {
              // ignore
            }
          }
          data = [...extras, ...data];
        }
        data = sortCandidates(data, preferIds);
      } else {
        data = sortCandidates(data, []);
      }

      return { data, total: res.total || data.length };
    },
    [],
  );

  if (!open) return null;

  return (
    <DocumentPushBatchPanel<SalesOrderPushCandidate>
      open={open}
      onClose={onClose}
      onComplete={onComplete}
      embedded={embedded}
      preferIds={orderIds}
      sourceType="sales_order"
      defaultProfiles={SALES_DEFAULT_PROFILES}
      kingdeeProfiles={SALES_KINGDEE_PROFILES}
      title={t('app.kuaizhizao.salesOrder.documentPush.title')}
      hint={t('app.kuaizhizao.salesOrder.documentPush.hint')}
      pipelineDesc={t('app.kuaizhizao.salesOrder.documentPush.pipelineDesc')}
      searchPlaceholder={t('app.kuaizhizao.salesOrder.documentPush.searchPlaceholder')}
      needSelectMessage={t('app.kuaizhizao.salesOrder.documentPush.needSelect')}
      confirmText={t('app.kuaizhizao.documentPush.batch.confirm')}
      columns={columns}
      getRowLabel={(row) => row.order_code || String(row.id)}
      loadCandidates={loadCandidates}
      matchSaveApi={isKingdeeSalSaleOrderSaveApi}
      preferSaveApi={preferSalApiUuid}
      saveApiSearchHints={SALES_SAVE_API_HINTS}
      showScheduleControls={false}
      successCountKey="app.kuaizhizao.documentPush.batch.success"
      partialCountKey="app.kuaizhizao.documentPush.batch.partial"
      failedTitleKey="app.kuaizhizao.documentPush.pushFailed"
      skippedHintKey="app.kuaizhizao.documentPush.batch.skippedHint"
    />
  );
};

export default SalesOrderDocumentPushPanel;
