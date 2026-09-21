/**
 * 采购订单外推：DocumentPushBatchPanel 薄封装（source=purchase_order → kingdee_pur_purchaseorder）。
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicationConnection } from '../../../../../services/applicationConnection';
import type { API } from '../../../../../services/apiManagement';
import { DocumentPushBatchPanel } from '../../../components/DocumentPushBatchPanel';
import {
  getPurchaseOrder,
  listPurchaseOrders,
  type PurchaseOrder,
} from '../../../services/purchase';

export interface PurchaseOrderPushCandidate {
  id: number;
  order_code?: string;
  supplier_name?: string;
  status?: string;
  review_status?: string;
  total_quantity?: number;
  order_date?: string;
}

export interface PurchaseOrderDocumentPushPanelProps {
  open: boolean;
  onClose: () => void;
  orderIds?: number[];
  onComplete?: () => void;
  embedded?: boolean;
}

/** 默认勾选由 profiles 接口 ∩ purchase_order 驱动；不写死仅金蝶 */
const PURCHASE_DEFAULT_PROFILES: string[] = [];
const PURCHASE_KINGDEE_PROFILES = ['kingdee_pur_purchaseorder'];
const PURCHASE_SAVE_API_HINTS = ['purchaseorder', '采购订单', 'push_pur'];

const PUSHABLE_STATUSES = new Set([
  'CONFIRMED',
  'AUDITED',
  'APPROVED',
  'RELEASED',
  'IN_PROGRESS',
  'COMPLETED',
]);

function isKingdeePurPurchaseOrderSaveApi(
  api: API,
  connection: ApplicationConnection | undefined,
): boolean {
  if (!connection) return false;
  if (api.connection_uuid && api.connection_uuid !== connection.uuid) return false;
  const code = String(api.code || '').toLowerCase();
  const path = String(api.path || '').toLowerCase();
  const name = String(api.name || '').toLowerCase();
  const hay = `${code} ${path} ${name}`;
  if (code.includes('save_pur_purchaseorder') || code.includes('push_pur')) return true;
  const isSave = path.includes('save') || hay.includes('save');
  const isPur =
    hay.includes('purchaseorder') ||
    hay.includes('pur_purchaseorder') ||
    name.includes('采购订单');
  return isSave && isPur;
}

function preferPurApiUuid(items: API[]): string | undefined {
  const preferred =
    items.find((api) => String(api.code || '').toLowerCase().includes('push_pur')) ||
    items.find((api) => String(api.code || '').toLowerCase().includes('save_pur_purchaseorder')) ||
    items.find((api) => String(api.name || '').includes('采购订单')) ||
    items[0];
  return preferred?.uuid;
}

function isPushableOrder(row: { status?: string; review_status?: string }): boolean {
  const review = String(row.review_status || '').trim().toUpperCase();
  const status = String(row.status || '').trim().toUpperCase();
  return review === 'APPROVED' || PUSHABLE_STATUSES.has(status);
}

function toCandidate(row: PurchaseOrder): PurchaseOrderPushCandidate | null {
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    order_code: row.order_code,
    supplier_name: row.supplier_name,
    status: row.status,
    review_status: row.review_status,
    total_quantity: row.total_quantity,
    order_date: row.order_date,
  };
}

function sortCandidates(
  data: PurchaseOrderPushCandidate[],
  preferIds: number[],
): PurchaseOrderPushCandidate[] {
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

export const PurchaseOrderDocumentPushPanel: React.FC<PurchaseOrderDocumentPushPanelProps> = ({
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
        title: t('app.kuaizhizao.purchaseOrder.col.orderCode'),
        dataIndex: 'order_code',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
        dataIndex: 'supplier_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.totalQuantity'),
        dataIndex: 'total_quantity',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
        dataIndex: 'order_date',
        width: 120,
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
      const res = await listPurchaseOrders({
        keyword: keyword || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        order_by: '-order_date',
      });
      let data = (res.data || [])
        .map(toCandidate)
        .filter((row): row is PurchaseOrderPushCandidate => !!row);

      if (preferIds.length && page === 1) {
        const missing = preferIds.filter((id) => !data.some((row) => row.id === id));
        if (missing.length) {
          const extras: PurchaseOrderPushCandidate[] = [];
          for (const id of missing.slice(0, 20)) {
            try {
              const one = await getPurchaseOrder(id);
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
    <DocumentPushBatchPanel<PurchaseOrderPushCandidate>
      open={open}
      onClose={onClose}
      onComplete={onComplete}
      embedded={embedded}
      preferIds={orderIds}
      sourceType="purchase_order"
      defaultProfiles={PURCHASE_DEFAULT_PROFILES}
      kingdeeProfiles={PURCHASE_KINGDEE_PROFILES}
      title={t('app.kuaizhizao.purchaseOrder.documentPush.title')}
      hint={t('app.kuaizhizao.purchaseOrder.documentPush.hint')}
      pipelineDesc={t('app.kuaizhizao.purchaseOrder.documentPush.pipelineDesc')}
      searchPlaceholder={t('app.kuaizhizao.purchaseOrder.documentPush.searchPlaceholder')}
      needSelectMessage={t('app.kuaizhizao.purchaseOrder.documentPush.needSelect')}
      confirmText={t('app.kuaizhizao.documentPush.batch.confirm')}
      columns={columns}
      getRowLabel={(row) => row.order_code || String(row.id)}
      loadCandidates={loadCandidates}
      matchSaveApi={isKingdeePurPurchaseOrderSaveApi}
      preferSaveApi={preferPurApiUuid}
      saveApiSearchHints={PURCHASE_SAVE_API_HINTS}
      showScheduleControls={false}
      successCountKey="app.kuaizhizao.documentPush.batch.success"
      partialCountKey="app.kuaizhizao.documentPush.batch.partial"
      failedTitleKey="app.kuaizhizao.documentPush.pushFailed"
      skippedHintKey="app.kuaizhizao.documentPush.batch.skippedHint"
    />
  );
};

export default PurchaseOrderDocumentPushPanel;
