/**
 * 即时库存外推：候选为 MaterialBatch（非 material-balances 伪 id）。
 * source=material_batch → kingdee_stk_miscellaneous。
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicationConnection } from '../../../../../services/applicationConnection';
import type { API } from '../../../../../services/apiManagement';
import { apiRequest } from '../../../../../services/api';
import { DocumentPushBatchPanel } from '../../../components/DocumentPushBatchPanel';

export interface InventoryBatchPushCandidate {
  id: number;
  material_code?: string;
  material_name?: string;
  batch_no?: string;
  warehouse_name?: string | null;
  quantity?: number;
  status?: string;
}

export interface InventoryDocumentPushPanelProps {
  open: boolean;
  onClose: () => void;
  /** 仅在确认为 MaterialBatch.id 时传入；勿传 material-balances 伪 id */
  batchIds?: number[];
  onComplete?: () => void;
  embedded?: boolean;
}

const INV_DEFAULT_PROFILES = ['kingdee_stk_miscellaneous'];
const INV_KINGDEE_PROFILES = ['kingdee_stk_miscellaneous'];
const INV_SAVE_API_HINTS = ['miscellaneous', '其他入库', 'push_stk'];

/** report_service 主仓行：id = 1_000_000 + MaterialBatch.id；线边 >= 2_000_000 */
function resolveMaterialBatchId(rawId: unknown): number | null {
  const n = Number(rawId);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000 && n < 2_000_000) return n - 1_000_000;
  // 已是真实 MaterialBatch.id（兜底）
  if (n < 1_000_000) return n;
  return null;
}

function isKingdeeStkMiscellaneousSaveApi(
  api: API,
  connection: ApplicationConnection | undefined,
): boolean {
  if (!connection) return false;
  if (api.connection_uuid && api.connection_uuid !== connection.uuid) return false;
  const code = String(api.code || '').toLowerCase();
  const path = String(api.path || '').toLowerCase();
  const name = String(api.name || '').toLowerCase();
  const hay = `${code} ${path} ${name}`;
  if (code.includes('save_stk_miscellaneous') || code.includes('push_stk')) return true;
  const isSave = path.includes('save') || hay.includes('save');
  const isMisc =
    hay.includes('miscellaneous') ||
    hay.includes('stk_miscellaneous') ||
    name.includes('其他入库');
  return isSave && isMisc;
}

function preferStkApiUuid(items: API[]): string | undefined {
  const preferred =
    items.find((api) => String(api.code || '').toLowerCase().includes('push_stk')) ||
    items.find((api) => String(api.code || '').toLowerCase().includes('save_stk_miscellaneous')) ||
    items.find((api) => String(api.name || '').includes('其他入库')) ||
    items[0];
  return preferred?.uuid;
}

function formatBatchNo(batchNo?: string | null): string {
  const bn = String(batchNo ?? '').trim();
  if (!bn || bn.toUpperCase() === 'DEFAULT') return '';
  return bn;
}

interface BatchLineRow {
  id?: number;
  material_code?: string;
  material_name?: string;
  batch_no?: string;
  warehouse_name?: string | null;
  quantity?: number;
  status?: string;
}

function toCandidate(row: BatchLineRow): InventoryBatchPushCandidate | null {
  const id = resolveMaterialBatchId(row.id);
  if (id == null || id <= 0) return null;
  const qty = Number(row.quantity ?? 0);
  if (!(qty > 0)) return null;
  return {
    id,
    material_code: row.material_code,
    material_name: row.material_name,
    batch_no: formatBatchNo(row.batch_no) || row.batch_no,
    warehouse_name: row.warehouse_name,
    quantity: qty,
    status: row.status,
  };
}

export const InventoryDocumentPushPanel: React.FC<InventoryDocumentPushPanelProps> = ({
  open,
  onClose,
  batchIds,
  onComplete,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        dataIndex: 'material_code',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
        dataIndex: 'batch_no',
        width: 140,
        ellipsis: true,
        render: (v: string | undefined) => formatBatchNo(v) || '—',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 120,
        ellipsis: true,
        render: (v: string | null | undefined) => v || '—',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colStockQty'),
        dataIndex: 'quantity',
        width: 100,
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
      const res = await apiRequest<{ items: BatchLineRow[]; total: number }>(
        '/apps/kuaizhizao/reports/inventory/batch-lines',
        {
          method: 'GET',
          params: {
            keyword: keyword || undefined,
            include_zero_stock: false,
            include_expired: false,
            current: page,
            page_size: pageSize,
          },
        },
      );

      let data = (res.items || [])
        .map(toCandidate)
        .filter((row): row is InventoryBatchPushCandidate => !!row);

      // 去重：同一 MaterialBatch 可能因分页/过滤重复出现
      const seen = new Set<number>();
      data = data.filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });

      if (preferIds.length && page === 1) {
        const preferSet = new Set(preferIds);
        const preferred = data.filter((row) => preferSet.has(row.id));
        const rest = data.filter((row) => !preferSet.has(row.id));
        data = [...preferred, ...rest];
      }

      return { data, total: res.total || data.length };
    },
    [],
  );

  if (!open) return null;

  return (
    <DocumentPushBatchPanel<InventoryBatchPushCandidate>
      open={open}
      onClose={onClose}
      onComplete={onComplete}
      embedded={embedded}
      preferIds={batchIds}
      sourceType="material_batch"
      defaultProfiles={INV_DEFAULT_PROFILES}
      kingdeeProfiles={INV_KINGDEE_PROFILES}
      title={t('app.kuaizhizao.warehouseInventory.documentPush.title')}
      hint={t('app.kuaizhizao.warehouseInventory.documentPush.hint')}
      pipelineDesc={t('app.kuaizhizao.warehouseInventory.documentPush.pipelineDesc')}
      searchPlaceholder={t('app.kuaizhizao.warehouseInventory.documentPush.searchPlaceholder')}
      needSelectMessage={t('app.kuaizhizao.warehouseInventory.documentPush.needSelect')}
      confirmText={t('app.kuaizhizao.documentPush.batch.confirm')}
      columns={columns}
      getRowLabel={(row) =>
        row.material_code
          ? `${row.material_code}${row.batch_no ? ` / ${formatBatchNo(row.batch_no) || row.batch_no}` : ''}`
          : String(row.id)
      }
      loadCandidates={loadCandidates}
      matchSaveApi={isKingdeeStkMiscellaneousSaveApi}
      preferSaveApi={preferStkApiUuid}
      saveApiSearchHints={INV_SAVE_API_HINTS}
      showScheduleControls={false}
      successCountKey="app.kuaizhizao.documentPush.batch.success"
      partialCountKey="app.kuaizhizao.documentPush.batch.partial"
      failedTitleKey="app.kuaizhizao.documentPush.pushFailed"
      skippedHintKey="app.kuaizhizao.documentPush.batch.skippedHint"
    />
  );
};

export default InventoryDocumentPushPanel;
