/**
 * 报工推送：对齐工单 DocumentPushBatchPanel 标准——列出已审核报工供勾选推送。
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicationConnection } from '../../../../../services/applicationConnection';
import type { API } from '../../../../../services/apiManagement';
import { DocumentPushBatchPanel } from '../../../components/DocumentPushBatchPanel';
import { reportingApi, type ReportingRecord } from '../../../services/reporting';

export interface ReportingPushCandidate {
  id: number;
  work_order_code?: string;
  operation_name?: string;
  worker_name?: string;
  reported_quantity?: number;
  qualified_quantity?: number;
  status?: string;
  kingdee_push_status?: string | null;
  reported_at?: string;
}

export interface ReportingPushBatchModalProps {
  open: boolean;
  onClose: () => void;
  reportingIds?: number[];
  onComplete?: () => void;
  embedded?: boolean;
}

/** 默认勾选由 profiles 接口 ∩ reporting_record 驱动；不写死仅金蝶 */
const REPORTING_DEFAULT_PROFILES: string[] = [];
const REPORTING_KINGDEE_PROFILES = ['kingdee_prd_morpt'];
const REPORTING_SAVE_API_HINTS = ['生产汇报', 'prd_morpt'];

function isKingdeeMorptSaveApi(
  api: API,
  connection: ApplicationConnection | undefined,
): boolean {
  if (!connection) return false;
  if (api.connection_uuid && api.connection_uuid !== connection.uuid) return false;
  const code = String(api.code || '').toLowerCase();
  const path = String(api.path || '').toLowerCase();
  const name = String(api.name || '').toLowerCase();
  const hay = `${code} ${path} ${name}`;
  if (code.includes('save_prd_morpt') || code.includes('push_prd_morpt')) return true;
  const isSave = path.includes('save') || hay.includes('save');
  const isMorpt =
    hay.includes('prd_morpt') ||
    name.includes('生产汇报') ||
    name.includes('报工');
  return isSave && isMorpt;
}

function preferMorptApiUuid(items: API[]): string | undefined {
  const preferred =
    items.find((api) => String(api.code || '').toLowerCase().includes('save_prd_morpt')) ||
    items.find((api) => String(api.name || '').includes('生产汇报')) ||
    items[0];
  return preferred?.uuid;
}

function toCandidate(row: ReportingRecord): ReportingPushCandidate | null {
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    work_order_code: row.work_order_code,
    operation_name: row.operation_name,
    worker_name: row.worker_name,
    reported_quantity: row.reported_quantity,
    qualified_quantity: row.qualified_quantity,
    status: row.status,
    kingdee_push_status: row.kingdee_push_status,
    reported_at: row.reported_at,
  };
}

export const ReportingPushBatchModal: React.FC<ReportingPushBatchModalProps> = ({
  open,
  onClose,
  reportingIds,
  onComplete,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workReporting.syncField.workOrderCode'),
        dataIndex: 'work_order_code',
        width: 150,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workReporting.syncField.operationName'),
        dataIndex: 'operation_name',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workReporting.syncField.workerName'),
        dataIndex: 'worker_name',
        width: 100,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workReporting.syncField.reportedQuantity'),
        dataIndex: 'reported_quantity',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColStatus'),
        dataIndex: 'status',
        width: 90,
        render: (v: string) =>
          v === 'approved'
            ? t('app.kuaizhizao.workReporting.statusApproved')
            : v || '—',
      },
      {
        title: t('app.kuaizhizao.workReporting.pushBatchColKingdeeStatus'),
        dataIndex: 'kingdee_push_status',
        width: 100,
        render: (v: string | null | undefined) => {
          if (v === 'success') return t('app.kuaizhizao.workReporting.kingdeePushSuccess');
          if (v === 'failed') return t('app.kuaizhizao.workReporting.kingdeePushFailed');
          if (v === 'dead') return t('app.kuaizhizao.workReporting.kingdeePushDead');
          return t('app.kuaizhizao.workReporting.kingdeePushNone');
        },
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
      const res = await reportingApi.list({
        status: 'approved',
        keyword: keyword || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        order_by: '-reported_at',
      });
      let data = (res.data || [])
        .map(toCandidate)
        .filter((row): row is ReportingPushCandidate => !!row);

      // 优先把 Hub 带入的已选行排到前面（无独立 candidates 接口时前端拼）
      if (preferIds.length && page === 1) {
        const preferSet = new Set(preferIds);
        const preferred = data.filter((row) => preferSet.has(row.id));
        const rest = data.filter((row) => !preferSet.has(row.id));
        const missing = preferIds.filter((id) => !data.some((row) => row.id === id));
        if (missing.length) {
          const extras: ReportingPushCandidate[] = [];
          for (const id of missing.slice(0, 20)) {
            try {
              const one = (await reportingApi.get(String(id))) as ReportingRecord;
              if (String(one?.status || '') === 'approved') {
                const c = toCandidate(one);
                if (c) extras.push(c);
              }
            } catch {
              // ignore
            }
          }
          data = [...extras, ...preferred, ...rest];
        } else {
          data = [...preferred, ...rest];
        }
      }

      return { data, total: res.total || data.length };
    },
    [],
  );

  // Hub 未激活推送 Tab / 独立 Modal 未打开：不挂载面板，避免列表页误打 profiles/apis
  if (!open) return null;

  return (
    <DocumentPushBatchPanel<ReportingPushCandidate>
      open={open}
      onClose={onClose}
      onComplete={onComplete}
      embedded={embedded}
      preferIds={reportingIds}
      sourceType="reporting_record"
      defaultProfiles={REPORTING_DEFAULT_PROFILES}
      kingdeeProfiles={REPORTING_KINGDEE_PROFILES}
      title={t('app.kuaizhizao.workReporting.pushBatchTitle')}
      hint={t('app.kuaizhizao.workReporting.pushBatchHint')}
      pipelineDesc={t('app.kuaizhizao.workReporting.pushBatchPipelineDesc')}
      searchPlaceholder={t('app.kuaizhizao.workReporting.pushBatchSearchPlaceholder')}
      needSelectMessage={t('app.kuaizhizao.workReporting.pushBatchNeedSelect')}
      confirmText={t('app.kuaizhizao.documentPush.batch.confirm')}
      columns={columns}
      getRowLabel={(row) =>
        row.work_order_code
          ? `${row.work_order_code}${row.operation_name ? ` / ${row.operation_name}` : ''}`
          : String(row.id)
      }
      loadCandidates={loadCandidates}
      matchSaveApi={isKingdeeMorptSaveApi}
      preferSaveApi={preferMorptApiUuid}
      saveApiSearchHints={REPORTING_SAVE_API_HINTS}
      successCountKey="app.kuaizhizao.workReporting.syncPushSuccess"
      partialCountKey="app.kuaizhizao.workReporting.syncPushPartial"
      failedTitleKey="app.kuaizhizao.workReporting.syncPushFailed"
      skippedHintKey="app.kuaizhizao.documentPush.batch.skippedHint"
    />
  );
};

export default ReportingPushBatchModal;
