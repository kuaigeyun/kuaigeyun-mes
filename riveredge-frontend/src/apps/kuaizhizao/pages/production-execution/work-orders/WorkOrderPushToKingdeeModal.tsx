/**
 * 生产工单推送：统一 DocumentPushBatchPanel 标准的工单实例。
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicationConnection } from '../../../../../services/applicationConnection';
import type { API } from '../../../../../services/apiManagement';
import { DocumentPushBatchPanel } from '../../../components/DocumentPushBatchPanel';
import {
  getWorkOrderPushBinding,
  listWorkOrderPushToKingdeeCandidates,
  saveWorkOrderPushBinding,
} from '../../../services/work-order';

export interface WorkOrderPushCandidate {
  id: number;
  code?: string;
  name?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  status?: string;
  planned_start_date?: string;
}

export interface WorkOrderPushToKingdeeModalProps {
  open: boolean;
  onClose: () => void;
  workOrderIds?: number[];
  onComplete?: () => void;
  /** 内嵌到 SyncPushHub 时不渲染独立 Modal 壳 */
  embedded?: boolean;
}

/**
 * 默认勾选由 GET /document-push/profiles ∩ work_order 驱动（含 OA/飞书若已注册）。
 * 空数组 = 不写死仅金蝶；kingdeeProfiles 仍用于连接器/Save 门控。
 */
const WORK_ORDER_DEFAULT_PROFILES: string[] = [];
const WORK_ORDER_KINGDEE_PROFILES = ['kingdee_prd_mo'];
const WORK_ORDER_SAVE_API_HINTS = ['生产订单', 'prd_mo'];

/** 该连接器下可用于推送生产订单的 Save 类接口（含 save_prd_mo / push_prd_mo / 生产订单）。 */
function isKingdeeMoSaveApi(api: API, connection: ApplicationConnection | undefined): boolean {
  if (!connection) return false;
  if (api.connection_uuid && api.connection_uuid !== connection.uuid) return false;
  const code = String(api.code || '').toLowerCase();
  const path = String(api.path || '').toLowerCase();
  const name = String(api.name || '').toLowerCase();
  const hay = `${code} ${path} ${name}`;
  const isSavePath = path.includes('save') || hay.includes('save');
  const isPrdMo =
    hay.includes('prd_mo') ||
    hay.includes('push_prd_mo') ||
    name.includes('生产订单') ||
    name.includes('推送生产');
  if (code.includes('push_prd_mo') || code.includes('save_prd_mo')) return true;
  if (isSavePath && isPrdMo) return true;
  return false;
}

function preferPushApiUuid(items: API[]): string | undefined {
  const preferred =
    items.find((api) => String(api.code || '').toLowerCase().includes('push_prd_mo')) ||
    items.find((api) => String(api.name || '').includes('推送生产订单')) ||
    items.find((api) => String(api.code || '').toLowerCase().includes('save_prd_mo')) ||
    items[0];
  return preferred?.uuid;
}

export const WorkOrderPushToKingdeeModal: React.FC<WorkOrderPushToKingdeeModalProps> = ({
  open,
  onClose,
  workOrderIds,
  onComplete,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workOrder.syncField.code'),
        dataIndex: 'code',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.syncField.productCode'),
        dataIndex: 'product_code',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.syncField.productName'),
        dataIndex: 'product_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.syncField.quantity'),
        dataIndex: 'quantity',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.workOrder.syncField.status'),
        dataIndex: 'status',
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
      const res = await listWorkOrderPushToKingdeeCandidates({
        keyword,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        prefer_ids: preferIds,
      });
      return { data: (res.items || []) as WorkOrderPushCandidate[], total: res.total || 0 };
    },
    [],
  );

  const loadBinding = useCallback(async () => getWorkOrderPushBinding(), []);
  const saveBinding = useCallback(
    async (payload: {
      connection_code?: string;
      save_api_uuid?: string;
      sync_mode?: string;
      schedule_interval_minutes?: number;
    }) => saveWorkOrderPushBinding(payload),
    [],
  );

  // Hub 未激活推送 Tab / 独立 Modal 未打开：不挂载面板，避免列表页误打 profiles/apis
  if (!open) return null;

  return (
    <DocumentPushBatchPanel<WorkOrderPushCandidate>
      open={open}
      onClose={onClose}
      onComplete={onComplete}
      embedded={embedded}
      preferIds={workOrderIds}
      sourceType="work_order"
      defaultProfiles={WORK_ORDER_DEFAULT_PROFILES}
      kingdeeProfiles={WORK_ORDER_KINGDEE_PROFILES}
      title={t('app.kuaizhizao.workOrder.pushToKingdeeTitle')}
      hint={t('app.kuaizhizao.workOrder.pushToKingdeeHint')}
      pipelineDesc={t('app.kuaizhizao.workOrder.pushToKingdeePipelineDesc')}
      searchPlaceholder={t('app.kuaizhizao.workOrder.pushToKingdeeSearchPlaceholder')}
      needSelectMessage={t('app.kuaizhizao.workOrder.pushToKingdeeNeedSelect')}
      confirmText={t('app.kuaizhizao.workOrder.pushToKingdeeConfirm')}
      columns={columns}
      getRowLabel={(row) => row.code || String(row.id)}
      loadCandidates={loadCandidates}
      matchSaveApi={isKingdeeMoSaveApi}
      preferSaveApi={preferPushApiUuid}
      saveApiSearchHints={WORK_ORDER_SAVE_API_HINTS}
      loadBinding={loadBinding}
      saveBinding={saveBinding}
      showScheduleControls
      successCountKey="app.kuaizhizao.workOrder.syncPushSuccess"
      partialCountKey="app.kuaizhizao.workOrder.syncPushPartial"
      failedTitleKey="app.kuaizhizao.workOrder.syncPushFailed"
      skippedHintKey="app.kuaizhizao.workOrder.pushToKingdeeSkippedHint"
    />
  );
};

export default WorkOrderPushToKingdeeModal;
