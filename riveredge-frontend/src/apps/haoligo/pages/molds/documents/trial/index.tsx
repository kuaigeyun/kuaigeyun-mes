/**
 * 好力 GO — 试模单（列表 + 表单，对齐需求稿字段）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormInstance,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadProps } from 'antd';
import {
  App,
  Alert,
  AutoComplete,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  theme,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  RollbackOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CodeSandboxOutlined,
  PlusOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../../components/uni-table/stackedPrimaryColumn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
  notificationRuleRequiresFormNotifyUsers,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { invalidateHaoligoMoldLedgerTableCache } from '../../../../utils/moldLedgerTableCache';
import { UniUserIdSelect, type UniUserIdSelectPreset, type UniUserIdSearchFn } from '../../../../../../components/uni-user-id-select';
import { useGlobalStore } from '../../../../../../stores';
import { formatUserDisplayLabel } from '../../../../../../utils/userDisplay';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { uploadFile } from '../../../../../../services/file';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { searchHaoligoUserIdOptions } from '../../../../utils/haoligoUserPicker';
import { supplierApi, unwrapSupplyPagedList } from '../../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../../apps/master-data/types/supply-chain';
import {
  approveMoldTrialSheet,
  createMoldWarehouse,
  createMoldTrialSheet,
  deleteMoldTrialSheet,
  getMoldTrialDatasetBinding,
  getMoldTrialIncompleteMolds,
  getMoldTrialSheet,
  getNextMoldTrialTimes,
  previewTrialRepairNotifyUsers,
  previewTrialSupplierNotifyUsers,
  listHaoligoNotifyUserOptions,
  listMoldTrialSheets,
  listMoldWarehouses,
  listMolds,
  putMoldTrialDatasetBinding,
  rejectMoldTrialSheet,
  dispatchMoldTrialSheet,
  markMoldTrialSheetAdjustmentComplete,
  recallMoldTrialSheet,
  revokeMoldTrialSheetApproval,
  updateMold,
  updateMoldTrialSheet,
  type MoldRow,
  type MoldWarehouseCreatePayload,
  type MoldWarehouseRow,
  type MoldTrialSheetCreatePayload,
  type MoldTrialDatasetBindingPayload,
  type MoldTrialSheetRow,
} from '../../../../services/haoligo';
import { buildMoldSheetAuditActionElements, MoldSheetAuditActions } from '../../../../components/MoldSheetAuditActions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { canAuditMoldSheet } from '../../../../utils/moldSheetStatus';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { isMoldSheetApproved, moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { hasModulePermission } from '../../../../../../utils/permissionContract';
import { userIsExternalPartner } from '../../../../../../utils/externalPartner';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import { executeDatasetQuery, getDatasetList } from '../../../../../../services/dataset';

const HAOLIGO_TRIAL_RESOURCE = 'haoligo:molds-documents-trial';

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

const trialResultEnum: Record<string, { text: string }> = {
  合格: { text: '合格' },
  不合格: { text: '不合格' },
};

type PoPickerTrialFilter = 'all' | 'pending' | 'trialed';

/** 分页统计各采购订单号在本系统的试模单条数（采购单选择器展示试模次数） */
async function fetchTrialCountByPurchaseOrderNoForPoPicker(): Promise<Map<string, number>> {
  const limit = 200;
  let skip = 0;
  const map = new Map<string, number>();
  for (;;) {
    const res = await listMoldTrialSheets({ skip, limit });
    const total = typeof res.total === 'number' ? res.total : 0;
    for (const row of res.items) {
      const n = String(row.purchase_order_no ?? '').trim();
      if (n) map.set(n, (map.get(n) ?? 0) + 1);
    }
    skip += res.items.length;
    if (res.items.length === 0 || res.items.length < limit || skip >= total) break;
  }
  return map;
}

/** 台账 → 试模单：供应商（优先购买厂商，其次外协厂商） */
function ledgerSupplierName(row: MoldRow): string | undefined {
  const purchase = (row.purchase_vendor_name || '').trim();
  if (purchase) return purchase;
  const outsource = (row.outsource_vendor_name || '').trim();
  return outsource || undefined;
}

function ledgerWarehouseName(row: MoldRow): string | undefined {
  const name = (row.mold_warehouse_name || '').trim();
  return name || undefined;
}

function formatMoldWarehouseLabel(row: MoldWarehouseRow): string {
  const name = (row.warehouse_name || '').trim();
  return name || String(row.id);
}

function parseMoldWarehouseIdForForm(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getDefaultTrialUserId(): number | undefined {
  const id = useGlobalStore.getState().currentUser?.id;
  return id != null && Number.isFinite(id) ? id : undefined;
}

function buildProductionTrialUserPresets(row?: {
  production_trial_user_id?: number | null;
  production_trial_user_name?: string | null;
}): UniUserIdSelectPreset[] {
  const merged = new Map<number, UniUserIdSelectPreset>();
  const cu = useGlobalStore.getState().currentUser;
  if (cu?.id != null) {
    merged.set(cu.id, { id: cu.id, label: formatUserDisplayLabel(cu) });
  }
  if (row?.production_trial_user_id != null) {
    merged.set(row.production_trial_user_id, {
      id: row.production_trial_user_id,
      label: (row.production_trial_user_name || '').trim() || `用户#${row.production_trial_user_id}`,
    });
  }
  return [...merged.values()];
}

function buildTrialUserPresets(row?: {
  trial_user_id?: number | null;
  trial_user_name?: string | null;
}): UniUserIdSelectPreset[] {
  const merged = new Map<number, UniUserIdSelectPreset>();
  const cu = useGlobalStore.getState().currentUser;
  if (cu?.id != null) {
    merged.set(cu.id, { id: cu.id, label: formatUserDisplayLabel(cu) });
  }
  if (row?.trial_user_id != null) {
    merged.set(row.trial_user_id, {
      id: row.trial_user_id,
      label: (row.trial_user_name || '').trim() || `用户#${row.trial_user_id}`,
    });
  }
  return [...merged.values()];
}

async function findMoldByCode(moldCode: string): Promise<MoldRow | undefined> {
  const mc = moldCode.trim();
  if (!mc) return undefined;
  const res = await listMolds({ keyword: mc, limit: 20 });
  return res.items.find((m) => m.mold_code.trim() === mc);
}

const TRIAL_FAILURE_PENDING = '待处理';
const TRIAL_FAILURE_REPAIR = '立即送修';
const TRIAL_FAILURE_DISPATCHED = '已发出';
const TRIAL_FAILURE_ADJUSTMENT_DONE = '调整完成';
const TRIAL_FAILURE_RECALLED = '已收回';

const WORKFLOW_PHASE_TRIAL = '试模';
const WORKFLOW_PHASE_PENDING_PRODUCTION = '试模合格待试产';
const WORKFLOW_PHASE_CLOSED = '已结案';

function sheetWorkflowPhase(record: Pick<MoldTrialSheetRow, 'workflow_phase'>): string {
  return (record.workflow_phase || WORKFLOW_PHASE_TRIAL).trim();
}

function isProductionTrialPhase(phase: string): boolean {
  return phase === WORKFLOW_PHASE_PENDING_PRODUCTION;
}

function lockedTrialMoldSummaryCols(
  trialUserId: number | undefined,
  trialUserName: string | undefined,
  trialUserPresets: { id: number; label: string }[],
): React.ReactNode {
  const label =
    (trialUserName || '').trim() ||
    (trialUserId != null
      ? trialUserPresets.find((p) => p.id === trialUserId)?.label
      : undefined) ||
    '—';
  return (
    <>
      <Col span={12}>
        <ProForm.Item label="试模结果">
          <Tag color="success">合格</Tag>
        </ProForm.Item>
      </Col>
      <Col span={12}>
        <ProForm.Item label="试模人员">
          <Typography.Text>{label}</Typography.Text>
        </ProForm.Item>
      </Col>
    </>
  );
}

/** 试产区：待试产阶段，或已结案且存在试产结果（详情只读） */
function showProductionTrialSection(phase: string, productionResult?: string | null): boolean {
  if (isProductionTrialPhase(phase)) return true;
  return phase === WORKFLOW_PHASE_CLOSED && Boolean((productionResult || '').trim());
}

function isProductionTrialUnqualified(record: MoldTrialSheetRow): boolean {
  return (record.production_trial_result || '').trim() === '不合格';
}

function renderFailureHandlingCell(value: string | null | undefined): React.ReactNode {
  const s = (value || '').trim();
  if (!s) return '—';
  const color =
    s === TRIAL_FAILURE_DISPATCHED
      ? 'processing'
      : s === TRIAL_FAILURE_ADJUSTMENT_DONE
        ? 'success'
        : s === TRIAL_FAILURE_RECALLED
          ? 'default'
          : s === TRIAL_FAILURE_REPAIR
            ? 'warning'
            : undefined;
  return <Tag color={color}>{s}</Tag>;
}

function isTrialSheetHandlingClosed(record: MoldTrialSheetRow): boolean {
  return (record.failure_handling || '').trim() === TRIAL_FAILURE_RECALLED;
}

const TRIAL_FAILURE_IN_PROGRESS = [
  TRIAL_FAILURE_PENDING,
  TRIAL_FAILURE_REPAIR,
  TRIAL_FAILURE_DISPATCHED,
  TRIAL_FAILURE_ADJUSTMENT_DONE,
] as const;

function isTrialFailureFlowInProgress(record: MoldTrialSheetRow): boolean {
  const fh = (record.failure_handling || '').trim();
  return TRIAL_FAILURE_IN_PROGRESS.includes(fh as (typeof TRIAL_FAILURE_IN_PROGRESS)[number]);
}

/** 列表展示：送修流程进行中时不显示「已结案」 */
function displayWorkflowPhaseLabel(record: MoldTrialSheetRow): string {
  if (isMoldSheetApproved(record.sheet_status) && isTrialFailureFlowInProgress(record)) {
    return '送修处理中';
  }
  return sheetWorkflowPhase(record);
}

function canDispatchTrialSheet(record: MoldTrialSheetRow): boolean {
  return (
    isProductionTrialUnqualified(record) &&
    (record.failure_handling || '').trim() === TRIAL_FAILURE_PENDING &&
    isMoldSheetApproved(record.sheet_status)
  );
}

function canMarkAdjustmentComplete(record: MoldTrialSheetRow): boolean {
  const fh = (record.failure_handling || '').trim();
  const unqualified =
    isProductionTrialUnqualified(record) ||
    (record.trial_result === '不合格' && !(record.production_trial_result || '').trim());
  return (
    unqualified &&
    (fh === TRIAL_FAILURE_DISPATCHED || fh === TRIAL_FAILURE_REPAIR) &&
    isMoldSheetApproved(record.sheet_status)
  );
}

function canConfirmRecallTrialSheet(record: MoldTrialSheetRow): boolean {
  const fh = (record.failure_handling || '').trim();
  const unqualified =
    isProductionTrialUnqualified(record) ||
    (record.trial_result === '不合格' && !record.production_trial_result);
  return unqualified && fh === TRIAL_FAILURE_ADJUSTMENT_DONE && isMoldSheetApproved(record.sheet_status);
}

function recallFromWarehouseLabel(record: MoldTrialSheetRow | null): string {
  if (!record) return '当前所在仓库（供应商侧）';
  const fh = (record.failure_handling || '').trim();
  if (fh === TRIAL_FAILURE_ADJUSTMENT_DONE) {
    return '当前所在仓库（外协侧，待本公司到厂收回）';
  }
  return fh === TRIAL_FAILURE_REPAIR
    ? '送修仓库（当前所在，供应商侧）'
    : '发出仓库（当前所在，供应商侧）';
}

const TRIAL_SHEET_DOC_COPY_ICON_STYLE: React.CSSProperties = { color: '#d48806', fontSize: 11 };

/** 列表堆叠：试模单单号 / 采购订单号 / 供应商 */
function TrialSheetDocStackedCell({ row }: { row: MoldTrialSheetRow }) {
  const { token } = theme.useToken();
  const sheetNo = (row.sheet_no || '').trim() || '—';
  const po = (row.purchase_order_no || '').trim() || '—';
  const supplier = (row.supplier_name || '').trim() || '—';
  const subLineStyle: React.CSSProperties = {
    fontSize: token.fontSizeSM,
    lineHeight: 1.2,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <Space size={2} align="center" style={{ maxWidth: '100%', minWidth: 0 }}>
        <Typography.Text
          strong
          ellipsis
          title={sheetNo}
          style={{ fontSize: token.fontSize, margin: 0, maxWidth: '100%' }}
        >
          {sheetNo}
        </Typography.Text>
        {sheetNo !== '—' ? (
          <Typography.Text
            copyable={{
              text: sheetNo,
              icon: [
                <CopyOutlined key="copy" style={TRIAL_SHEET_DOC_COPY_ICON_STYLE} />,
                <CopyOutlined key="copied" style={{ ...TRIAL_SHEET_DOC_COPY_ICON_STYLE, color: '#52c41a' }} />,
              ],
              tooltips: ['复制', '已复制'],
            }}
            style={{ margin: 0 }}
          />
        ) : null}
      </Space>
      <Typography.Text type="secondary" style={{ ...subLineStyle, marginTop: 1 }} title={po}>
        {po}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ ...subLineStyle, marginTop: 1 }} title={supplier}>
        {supplier}
      </Typography.Text>
    </div>
  );
}

function parsePendingNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((id) => Number.isFinite(id) && id > 0);
}

function findSupplierUuidForName(
  supplierName: string,
  options: { key: string; value: string; label: string }[],
): string | undefined {
  const sn = supplierName.trim();
  if (!sn) return undefined;
  return options.find((o) => o.value.trim() === sn)?.key;
}

function filterInternalWarehouses(warehouses: MoldWarehouseRow[]): { value: number; label: string }[] {
  return warehouses
    .filter((w) => (w.warehouse_type || '').trim() === '内部')
    .map((w) => ({
      value: w.id,
      label: formatMoldWarehouseLabel(w),
    }));
}

function pickDefaultRecallWarehouseId(
  record: MoldTrialSheetRow,
  warehouses: MoldWarehouseRow[],
): number | undefined {
  const internalOpts = filterInternalWarehouses(warehouses);
  if (internalOpts.length === 0) return undefined;
  const origin = record.dispatch_origin_warehouse_id;
  if (origin != null && origin > 0) {
    const wh = warehouses.find((w) => w.id === origin);
    if (wh && (wh.warehouse_type || '').trim() === '内部') return origin;
  }
  return internalOpts[0]?.value;
}

function filterRepairWarehousesForSupplier(
  warehouses: MoldWarehouseRow[],
  supplierName: string | undefined,
): { value: number; label: string }[] {
  const sn = (supplierName || '').trim();
  if (!sn) return [];
  return warehouses
    .filter((w) => {
      if (w.warehouse_type !== '外部') return false;
      return (w.supplier_name || '').trim() === sn;
    })
    .map((w) => ({
      value: w.id,
      label: (w.warehouse_name || '').trim() || w.warehouse_code,
    }));
}

function pickDefaultRepairWarehouseId(
  warehouses: MoldWarehouseRow[],
  supplierName: string | undefined,
): number | undefined {
  const opts = filterRepairWarehousesForSupplier(warehouses, supplierName);
  return opts.length > 0 ? opts[0].value : undefined;
}

function warehouseLabelById(rows: MoldWarehouseRow[], id: number | null | undefined): string {
  if (id == null || !Number.isFinite(id) || id < 1) return '（未设置）';
  const w = rows.find((r) => r.id === id);
  return w ? formatMoldWarehouseLabel(w) : `仓库#${id}`;
}

const TRIAL_IMMEDIATE_REPAIR_WAREHOUSE_EXTRA =
  '保存后将把模具台账「所在仓库」转移至所选外部仓库';

const TrialAdjustmentPointsField: React.FC<{ readonly?: boolean }> = ({ readonly }) => (
  <Col span={24}>
    <ProFormTextArea
      name="adjustment_points"
      label="需要调整的点"
      placeholder="请描述模具需维修或调整的具体问题，供外协厂商参考"
      readonly={readonly}
      disabled={readonly}
      rules={[{ required: true, message: '请填写需要调整的点' }]}
      fieldProps={{ rows: 4, maxLength: 2000, showCount: true }}
    />
  </Col>
);

/** 试模/试产「立即送修」：送修仓库、站内信预览、外部仓快捷新建（与试模不合格一致） */
const TrialImmediateRepairWarehouseFields: React.FC<{
  supplierNameStr: string;
  repairOptions: { value: number; label: string }[];
  notifyUserId: number | null | undefined;
  unqualifiedLabel: string;
  notifyPersonLabel?: string;
  onQuickCreateWarehouse: (supplierName: string) => void;
}> = ({
  supplierNameStr,
  repairOptions,
  notifyUserId,
  unqualifiedLabel,
  notifyPersonLabel = '试模人员',
  onQuickCreateWarehouse,
}) => (
  <>
    <Col span={24} style={{ marginBottom: 24 }}>
      <Alert
        type="warning"
        showIcon
        message="返厂维修阶段"
        description={`${unqualifiedLabel}须立即送修：审核通过后将向${notifyPersonLabel}及供应商（模具生产商）发送站内信，并同步将模具台账所在仓库转移至送修仓。`}
      />
    </Col>
    <Col span={12}>
      <ProFormSelect
        name="repair_warehouse_id"
        label="送修仓库"
        showSearch
        allowClear={false}
        rules={[{ required: true, message: '请选择送修仓库' }]}
        options={repairOptions}
        placeholder={
          repairOptions.length > 0 ? '已带出供应商外部模具仓库，可改选' : '该供应商暂无外部模具仓库'
        }
        extra={TRIAL_IMMEDIATE_REPAIR_WAREHOUSE_EXTRA}
        fieldProps={{ optionFilterProp: 'label' }}
      />
    </Col>
    <Col span={24}>
      <TrialRepairNotifyHint
        supplierName={supplierNameStr}
        trialUserId={notifyUserId}
        notifyPersonLabel={notifyPersonLabel}
      />
    </Col>
    {repairOptions.length === 0 && supplierNameStr.trim() ? (
      <Col span={24}>
        <Alert
          type="warning"
          showIcon
          message={`供应商「${supplierNameStr.trim()}」尚未维护外部模具仓库`}
          description="可快速新建该供应商的外部模具仓库，创建后将自动填入送修仓库。"
          action={
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onQuickCreateWarehouse(supplierNameStr)}
            >
              新建模具仓库
            </Button>
          }
        />
      </Col>
    ) : null}
  </>
);

const TrialRepairNotifyHint: React.FC<{
  supplierName?: string;
  trialUserId?: number | null;
  notifyPersonLabel?: string;
}> = ({ supplierName, trialUserId, notifyPersonLabel = '试模人员' }) => {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const sn = (supplierName || '').trim();
    const uid = trialUserId != null && Number.isFinite(trialUserId) ? trialUserId : undefined;
    if (!sn && uid == null) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void previewTrialRepairNotifyUsers({
      supplier_name: sn || undefined,
      trial_user_id: uid,
    })
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierName, trialUserId]);

  if (items.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        保存后将向{notifyPersonLabel}及供应商绑定用户发送站内信（请填写供应商或{notifyPersonLabel}以预览）
      </Typography.Text>
    );
  }
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      保存后将发送站内信通知：{items.map((u) => u.name).join('、')}
    </Typography.Text>
  );
};

const TrialSupplierCcHint: React.FC<{ supplierName?: string }> = ({ supplierName }) => {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const sn = (supplierName || '').trim();
    if (!sn) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void previewTrialSupplierNotifyUsers({ supplier_name: sn })
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierName]);

  const sn = (supplierName || '').trim();
  if (!sn) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        填写供应商后可预览将抄送的供应商绑定用户
      </Typography.Text>
    );
  }
  if (items.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        未找到该供应商的数据范围绑定用户，将仅通知上方指定人员
      </Typography.Text>
    );
  }
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      保存后将同时抄送供应商绑定用户：{items.map((u) => u.name).join('、')}
    </Typography.Text>
  );
};

/** 新建试模单：根据模具代号/采购订单号预览第几次试模（含弹窗初始值，未保存即可见） */
const MoldTrialTimesPreview: React.FC<{ active: boolean; initialKey?: string }> = ({ active, initialKey }) => {
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const moldCodeWatched = Form.useWatch('mold_code', form);
  const purchaseOrderNoWatched = Form.useWatch('purchase_order_no', form);
  const [trialTimes, setTrialTimes] = useState<number | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [blockingSheetNo, setBlockingSheetNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [seedMc, seedPo] = (initialKey ?? '').split('|');

  useEffect(() => {
    if (!active) {
      setTrialTimes(null);
      setCanCreate(true);
      setBlockingSheetNo(null);
      setLoading(false);
      return;
    }
    const mc = String(moldCodeWatched ?? form?.getFieldValue?.('mold_code') ?? seedMc ?? '').trim();
    const po = String(
      purchaseOrderNoWatched ?? form?.getFieldValue?.('purchase_order_no') ?? seedPo ?? '',
    ).trim();
    if (!mc && !po) {
      setTrialTimes(null);
      setCanCreate(true);
      setBlockingSheetNo(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getNextMoldTrialTimes({
      mold_code: mc || undefined,
      purchase_order_no: po || undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setTrialTimes(res.trial_times);
          setCanCreate(res.can_create !== false);
          setBlockingSheetNo(res.blocking_sheet_no?.trim() || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrialTimes(null);
          setCanCreate(true);
          setBlockingSheetNo(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, initialKey, moldCodeWatched, purchaseOrderNoWatched, form, seedMc, seedPo]);

  const mc = String(moldCodeWatched ?? form?.getFieldValue?.('mold_code') ?? seedMc ?? '').trim();
  const po = String(
    purchaseOrderNoWatched ?? form?.getFieldValue?.('purchase_order_no') ?? seedPo ?? '',
  ).trim();
  if (!mc && !po) return null;

  return (
    <>
      <Col span={12}>
        <Form.Item label="试模次数" style={{ marginBottom: 0 }}>
          {loading ? (
            <Typography.Text type="secondary">计算中…</Typography.Text>
          ) : trialTimes != null ? (
            <Typography.Text>
              第{' '}
              <span
                style={{
                  fontSize: token.fontSizeHeading3,
                  color: canCreate ? token.colorPrimary : token.colorError,
                  fontWeight: token.fontWeightStrong,
                  lineHeight: 1.2,
                }}
              >
                {trialTimes}
              </span>
              {' '}
              次试模
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
        </Form.Item>
      </Col>
      {!loading && !canCreate ? (
        <Col span={24}>
          <Alert
            type="error"
            showIcon
            message="当前不可新建试模单"
            description={
              blockingSheetNo
                ? `该模具/订单仍有未完结的试模流程（试模单 ${blockingSheetNo}），请先完成试模/试产及发出收回等环节。`
                : '该模具/订单仍有未完结的试模流程，请先完成当前试模流程后再新建。'
            }
          />
        </Col>
      ) : null}
    </>
  );
};

const TRIAL_DOC_NOTIFICATION = 'haoligo_mold_trial';
const TRIAL_ACTION_SUBMITTED = 'submitted';

const MoldTrialSheetsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canDispatchTrial = useMemo(
    () => hasModulePermission(currentUser, HAOLIGO_TRIAL_RESOURCE, 'dispatch'),
    [currentUser],
  );
  const canRecallTrial = useMemo(
    () => hasModulePermission(currentUser, HAOLIGO_TRIAL_RESOURCE, 'recall'),
    [currentUser],
  );
  const canConfirmAdjustmentTrial = useMemo(
    () => hasModulePermission(currentUser, HAOLIGO_TRIAL_RESOURCE, 'confirm_adjustment'),
    [currentUser],
  );
  const trialPerms = useResourcePermissions(HAOLIGO_TRIAL_RESOURCE);

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });

  const trialSubmittedNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        TRIAL_DOC_NOTIFICATION,
        TRIAL_ACTION_SUBMITTED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const trialSubmittedNeedsFormNotifyUsers = useMemo(
    () => notificationRuleRequiresFormNotifyUsers(trialSubmittedNotifyRule),
    [trialSubmittedNotifyRule],
  );
  const trialSubmittedNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(trialSubmittedNotifyRule),
    [trialSubmittedNotifyRule],
  );

  const actionRef = useRef<ActionType>(null);
  const bumpMoldLedgerTableCache = useCallback(() => {
    invalidateHaoligoMoldLedgerTableCache(queryClient);
  }, [queryClient]);
  const formRef = useRef<ProFormInstance>(null);
  /** 编辑时保留原状态（表单不再展示状态字段） */
  const [bindingCfgForm] = Form.useForm<MoldTrialDatasetBindingPayload & { test_po?: string }>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [auditSheetStatus, setAuditSheetStatus] = useState<string>('待审核');
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    if (!modalVisible || isDetailView || isEdit) return;
    if (!trialSubmittedNeedsFormNotifyUsers || trialSubmittedNotifyDefaults.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const cur = formRef.current?.getFieldValue('submitted_notify_user_ids') as number[] | undefined;
      if (Array.isArray(cur) && cur.length > 0) return;
      formRef.current?.setFieldsValue({
        submitted_notify_user_ids: [...trialSubmittedNotifyDefaults],
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    modalVisible,
    isDetailView,
    isEdit,
    trialSubmittedNeedsFormNotifyUsers,
    trialSubmittedNotifyDefaults,
  ]);

  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string; key: string }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ value: number; label: string }[]>([]);
  const [warehouseRows, setWarehouseRows] = useState<MoldWarehouseRow[]>([]);
  const [repairWhCreateOpen, setRepairWhCreateOpen] = useState(false);
  const [repairWhCreateSupplierName, setRepairWhCreateSupplierName] = useState('');
  const [repairWhCreateLoading, setRepairWhCreateLoading] = useState(false);
  const repairWhCreateFormRef = useRef<ProFormInstance>(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchRecord, setDispatchRecord] = useState<MoldTrialSheetRow | null>(null);
  const [dispatchFromLabel, setDispatchFromLabel] = useState('—');
  const [dispatchTargetWhId, setDispatchTargetWhId] = useState<number | undefined>();
  const [dispatchTargetOptions, setDispatchTargetOptions] = useState<{ value: number; label: string }[]>([]);
  const [dispatchModalLoading, setDispatchModalLoading] = useState(false);
  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [recallSubmitting, setRecallSubmitting] = useState(false);
  const [recallRecord, setRecallRecord] = useState<MoldTrialSheetRow | null>(null);
  const [recallFromLabel, setRecallFromLabel] = useState('—');
  const [recallTargetWhId, setRecallTargetWhId] = useState<number | undefined>();
  const [recallTargetOptions, setRecallTargetOptions] = useState<{ value: number; label: string }[]>([]);
  const [recallModalLoading, setRecallModalLoading] = useState(false);
  const [trialUserPresets, setTrialUserPresets] = useState<UniUserIdSelectPreset[]>([]);
  const [productionTrialUserPresets, setProductionTrialUserPresets] = useState<UniUserIdSelectPreset[]>([]);
  const [formWorkflowPhase, setFormWorkflowPhase] = useState(WORKFLOW_PHASE_TRIAL);
  const [pendingNotifyLabelRef] = useState(() => new Map<number, string>());
  const [pendingNotifyPresetOptions, setPendingNotifyPresetOptions] = useState<
    Array<{ value: number; label: string }>
  >([]);
  const [datasetBinding, setDatasetBinding] = useState<MoldTrialDatasetBindingPayload | null>(null);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [bindingTestResult, setBindingTestResult] = useState<string | null>(null);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const isExternalPartner = useMemo(() => userIsExternalPartner(currentUser), [currentUser]);
  const [adjustmentSubmittingId, setAdjustmentSubmittingId] = useState<number | null>(null);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const [poPickerLoading, setPoPickerLoading] = useState(false);
  /** 采购订单号 → 本系统试模单条数（与弹窗内 ERP 行比对） */
  const [trialCountByPoNo, setTrialCountByPoNo] = useState<Map<string, number>>(() => new Map());
  const [poPickerRows, setPoPickerRows] = useState<Record<string, unknown>[]>([]);
  const [poPickerSelectedKeys, setPoPickerSelectedKeys] = useState<React.Key[]>([]);
  const [poPickerSelectedRow, setPoPickerSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [poPickerTrialFilter, setPoPickerTrialFilter] = useState<PoPickerTrialFilter>('all');
  const [poPickerKw, setPoPickerKw] = useState('');

  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldPickerLoading, setMoldPickerLoading] = useState(false);
  const [moldKw, setMoldKw] = useState('');
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  /** 仍有未完结试模流程的模具代号 → 阻塞试模单单号 */
  const [trialBlockedByMoldCode, setTrialBlockedByMoldCode] = useState<Map<string, string>>(new Map());
  /** 从待启用模具创建时跳过采购订单号必填 */
  const [skipPurchaseOrder, setSkipPurchaseOrder] = useState(false);
  const canReadMoldLedger = useMemo(
    () => hasModulePermission(currentUser, 'haoligo:molds-ledger', 'read'),
    [currentUser],
  );

  const loadBindingDatasetColumns = useCallback(
    async (datasetUuid: string | undefined, opts?: { silent?: boolean }) => {
      const uuid = (datasetUuid ?? '').trim();
      if (!uuid) {
        setBindingColumnOptions([]);
        return;
      }
      setBindingColumnsLoading(true);
      try {
        const res = await executeDatasetQuery(uuid, {
          parameters: {},
          fill_missing_sql_parameters: true,
          limit: 5,
          offset: 0,
        });
        const raw = res.columns?.length
          ? res.columns
          : res.data?.[0]
            ? Object.keys(res.data[0] as object)
            : [];
        if (!raw.length) {
          if (!opts?.silent) {
            messageApi.warning(
              res.error ||
                '无法加载列名：请确认该 SQL 支持无参数执行（与「从模具采购单创建」列表一致）',
            );
          }
          setBindingColumnOptions([]);
          return;
        }
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
        if (!opts?.silent && unique.length) {
          messageApi.success(`已加载 ${unique.length} 个列，可从下拉选择映射`);
        }
      } catch (e) {
        if (!opts?.silent) messageApi.error((e as Error).message || '加载列名失败');
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getMoldTrialDatasetBinding();
        if (cancelled) return;
        setDatasetBinding(b.dataset_uuid ? b : null);
      } catch {
        if (!cancelled) setDatasetBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canCreateFromPo = useMemo(() => {
    const b = datasetBinding;
    if (!b?.dataset_uuid?.trim()) return false;
    if (!b.purchase_order_column?.trim()) return false;
    if (!b.supplier_column?.trim() || !b.mold_code_column?.trim() || !b.mold_name_column?.trim()) return false;
    return true;
  }, [datasetBinding]);

  const handleOpenPoFromErp = useCallback(() => {
    if (!canCreateFromPo) {
      messageApi.warning('请先在「数据集」里选好数据集，并填齐四个结果列名后保存。');
      return;
    }
    setPoPickerSelectedKeys([]);
    setPoPickerSelectedRow(null);
    setPoPickerKw('');
    setPoPickerOpen(true);
  }, [canCreateFromPo, messageApi]);

  useEffect(() => {
    if (!poPickerOpen || !datasetBinding) return;
    let cancelled = false;
    (async () => {
      setPoPickerLoading(true);
      setPoPickerRows([]);
      setTrialCountByPoNo(new Map());
      setPoPickerTrialFilter('all');
      setPoPickerKw('');
      try {
        const uuid = String(datasetBinding.dataset_uuid || '').trim();
        const [res, trialCounts] = await Promise.all([
          executeDatasetQuery(uuid, { parameters: {}, limit: 2000, offset: 0 }),
          fetchTrialCountByPurchaseOrderNoForPoPicker(),
        ]);
        if (cancelled) return;
        if (!res.success) {
          messageApi.error(res.error || '加载模具采购单列表失败');
          return;
        }
        setPoPickerRows((res.data ?? []) as Record<string, unknown>[]);
        setTrialCountByPoNo(trialCounts);
      } catch (e) {
        if (!cancelled) messageApi.error((e as Error).message || '加载失败');
      } finally {
        if (!cancelled) setPoPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poPickerOpen, datasetBinding, messageApi]);

  const handlePoPickerConfirm = useCallback(() => {
    const b = datasetBinding;
    const r = poPickerSelectedRow;
    if (!b?.purchase_order_column?.trim() || !r) {
      messageApi.warning('请选择一条模具采购单');
      return;
    }
    const poK = b.purchase_order_column.trim();
    const supK = (b.supplier_column || '').trim();
    const codeK = (b.mold_code_column || '').trim();
    const nameK = (b.mold_name_column || '').trim();
    const purchase_order_no = String(r[poK] ?? '').trim();
    if (!purchase_order_no) {
      messageApi.warning('选中行缺少采购订单号，请检查配置中的「采购订单号」结果列名');
      return;
    }
    const pick = (key: string) => {
      const v = r[key];
      return v == null ? undefined : String(v);
    };
    setPoPickerOpen(false);
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setSkipPurchaseOrder(false);
    setFormWorkflowPhase(WORKFLOW_PHASE_TRIAL);
    setTrialUserPresets(buildTrialUserPresets());
    setProductionTrialUserPresets(buildProductionTrialUserPresets());
    setFormInitialValues({
      purchase_order_no,
      supplier_name: pick(supK),
      mold_code: pick(codeK),
      mold_name: pick(nameK),
      trial_user_id: getDefaultTrialUserId(),
      failure_handling: undefined,
      pending_notify_user_ids: [],
      submitted_notify_user_ids: [...trialSubmittedNotifyDefaults],
      repair_warehouse_id: undefined,
      result_attachments: [],
    });
    setModalVisible(true);
    setPoPickerSelectedKeys([]);
    setPoPickerSelectedRow(null);
  }, [datasetBinding, poPickerSelectedRow, messageApi, trialSubmittedNotifyDefaults]);

  const loadTrialBlockedMoldCodes = useCallback(async () => {
    try {
      const res = await getMoldTrialIncompleteMolds();
      const m = new Map<string, string>();
      for (const it of res.items ?? []) {
        const mc = String(it.mold_code ?? '').trim();
        if (mc) m.set(mc, String(it.blocking_sheet_no ?? '').trim());
      }
      setTrialBlockedByMoldCode(m);
    } catch {
      setTrialBlockedByMoldCode(new Map());
    }
  }, []);

  const loadPendingEnableMolds = useCallback(async () => {
    setMoldPickerLoading(true);
    try {
      const [res] = await Promise.all([
        listMolds({ limit: 200, skip: 0, status: '待启用' }),
        loadTrialBlockedMoldCodes(),
      ]);
      setMoldRows(res.items ?? []);
    } catch {
      setMoldRows([]);
      messageApi.error('加载待启用模具失败');
    } finally {
      setMoldPickerLoading(false);
    }
  }, [messageApi, loadTrialBlockedMoldCodes]);

  const trialBlockedMessage = useCallback((moldCode: string, sheetNo?: string) => {
    const sn = (sheetNo || '').trim();
    return sn
      ? `模具「${moldCode}」仍有未完结的试模流程（试模单 ${sn}），不可新建`
      : `模具「${moldCode}」仍有未完结的试模流程，不可新建`;
  }, []);

  const isMoldBlockedForNewTrial = useCallback(
    (moldCode: string) => trialBlockedByMoldCode.has(moldCode.trim()),
    [trialBlockedByMoldCode],
  );

  const handleOpenMoldPicker = useCallback(() => {
    setMoldKw('');
    setMoldPickerOpen(true);
    void loadPendingEnableMolds();
  }, [loadPendingEnableMolds]);

  const searchPendingNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('pending_notify_user_ids') as number[] | undefined) || []);
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        pendingNotifyLabelRef.set(o.value, o.label);
      }
      return opts;
    },
    [pendingNotifyLabelRef],
  );

  const searchSubmittedNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('submitted_notify_user_ids') as number[] | undefined) ||
            []);
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        pendingNotifyLabelRef.set(o.value, o.label);
      }
      return opts;
    },
    [pendingNotifyLabelRef],
  );

  const searchTrialOperatorUsers = useCallback<UniUserIdSearchFn>(
    async (keyword, selectedIds) => {
      const presetIds = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const wid = formRef.current?.getFieldValue('trial_user_id');
      const prodWid = formRef.current?.getFieldValue('production_trial_user_id');
      for (const raw of [wid, prodWid]) {
        const n = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(n) && n > 0 && !presetIds.includes(n)) presetIds.push(n);
      }
      return searchHaoligoUserIdOptions({
        keyword,
        pageSize: 50,
        selectedIds: presetIds,
      });
    },
    [],
  );

  /** 从模具台账带出上次「待处理」时选择的消息提醒人员（新建单，可再改） */
  const applyPendingNotifyMemoryForMoldCode = useCallback(
    async (code: string) => {
      if (isEdit || isDetailView) return;
      const mc = code.trim();
      if (!mc) return;
      const trialResult = formRef.current?.getFieldValue('trial_result');
      const failureHandling = formRef.current?.getFieldValue('failure_handling');
      if (trialResult !== '不合格' || failureHandling !== TRIAL_FAILURE_PENDING) return;
      try {
        const row = await findMoldByCode(mc);
        const ids = parsePendingNotifyUserIds(row?.trial_pending_notify_user_ids);
        if (!ids.length) return;
        const users = await listHaoligoNotifyUserOptions({
          limit: 80,
          selected_user_ids: ids,
        });
        const opts = users.map((u) => ({ label: u.label, value: u.id }));
        for (const o of opts) {
          pendingNotifyLabelRef.set(o.value, o.label);
        }
        formRef.current?.setFieldsValue({ pending_notify_user_ids: ids });
      } catch {
        /* 记忆查询失败不阻断填单 */
      }
    },
    [isDetailView, isEdit, pendingNotifyLabelRef],
  );

  const reloadWarehouses = useCallback(async (): Promise<MoldWarehouseRow[]> => {
    const rows = await listMoldWarehouses();
    setWarehouseRows(rows);
    setWarehouseOptions(rows.map((w) => ({ value: w.id, label: formatMoldWarehouseLabel(w) })));
    return rows;
  }, []);

  const formatMoldLedgerWarehouseLabel = useCallback((mold: MoldRow | undefined): string => {
    if (!mold) return '（未设置）';
    const name = (mold.mold_warehouse_name || '').trim();
    const code = (mold.mold_warehouse_code || '').trim();
    if (name && code) return `${code} · ${name}`;
    return name || code || '（未设置）';
  }, []);

  const openDispatchModal = useCallback(
    async (record: MoldTrialSheetRow) => {
      setDispatchRecord(record);
      setDispatchModalOpen(true);
      setDispatchModalLoading(true);
      setDispatchTargetWhId(undefined);
      setDispatchTargetOptions([]);
      try {
        const rows = warehouseRows.length > 0 ? warehouseRows : await reloadWarehouses();
        const mc = (record.mold_code || '').trim();
        const mold = mc ? await findMoldByCode(mc) : undefined;
        setDispatchFromLabel(formatMoldLedgerWarehouseLabel(mold));
        const opts = filterRepairWarehousesForSupplier(rows, record.supplier_name);
        setDispatchTargetOptions(opts);
        setDispatchTargetWhId(pickDefaultRepairWarehouseId(rows, record.supplier_name));
      } catch (e) {
        messageApi.error((e as Error).message || '加载发出信息失败');
        setDispatchModalOpen(false);
      } finally {
        setDispatchModalLoading(false);
      }
    },
    [warehouseRows, reloadWarehouses, formatMoldLedgerWarehouseLabel, messageApi],
  );

  const handleDispatchConfirm = useCallback(async () => {
    if (!dispatchRecord) return;
    if (dispatchTargetWhId == null || dispatchTargetWhId < 1) {
      messageApi.warning('请选择接收仓库');
      return;
    }
    setDispatchSubmitting(true);
    try {
      await dispatchMoldTrialSheet(dispatchRecord.id, { target_warehouse_id: dispatchTargetWhId });
      messageApi.success('已发出');
      setDispatchModalOpen(false);
      bumpMoldLedgerTableCache();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '发出失败');
    } finally {
      setDispatchSubmitting(false);
    }
  }, [dispatchRecord, dispatchTargetWhId, messageApi, bumpMoldLedgerTableCache]);

  const openRecallModal = useCallback(
    async (record: MoldTrialSheetRow) => {
      setRecallRecord(record);
      setRecallModalOpen(true);
      setRecallModalLoading(true);
      setRecallTargetWhId(undefined);
      setRecallTargetOptions([]);
      try {
        const rows = warehouseRows.length > 0 ? warehouseRows : await reloadWarehouses();
        const mc = (record.mold_code || '').trim();
        const mold = mc ? await findMoldByCode(mc) : undefined;
        const fromWhId = record.repair_warehouse_id ?? mold?.mold_warehouse_id ?? undefined;
        setRecallFromLabel(
          fromWhId != null ? warehouseLabelById(rows, fromWhId) : formatMoldLedgerWarehouseLabel(mold),
        );
        const opts = filterInternalWarehouses(rows);
        setRecallTargetOptions(opts);
        setRecallTargetWhId(pickDefaultRecallWarehouseId(record, rows));
      } catch (e) {
        messageApi.error((e as Error).message || '加载收回信息失败');
        setRecallModalOpen(false);
      } finally {
        setRecallModalLoading(false);
      }
    },
    [warehouseRows, reloadWarehouses, formatMoldLedgerWarehouseLabel, messageApi],
  );

  const handleRecallConfirm = useCallback(async () => {
    if (!recallRecord) return;
    if (recallTargetWhId == null || recallTargetWhId < 1) {
      messageApi.warning('请选择收回目标仓库');
      return;
    }
    setRecallSubmitting(true);
    try {
      await recallMoldTrialSheet(recallRecord.id, { target_warehouse_id: recallTargetWhId });
      messageApi.success('已确认收回');
      setRecallModalOpen(false);
      bumpMoldLedgerTableCache();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '收回失败');
    } finally {
      setRecallSubmitting(false);
    }
  }, [recallRecord, recallTargetWhId, messageApi, bumpMoldLedgerTableCache]);

  const handleMarkAdjustmentComplete = useCallback(
    async (record: MoldTrialSheetRow) => {
      setAdjustmentSubmittingId(record.id);
      try {
        await markMoldTrialSheetAdjustmentComplete(record.id);
        messageApi.success('已确认调整完成，待本公司到厂后确认收回');
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error((e as Error).message || '操作失败');
      } finally {
        setAdjustmentSubmittingId(null);
      }
    },
    [messageApi],
  );

  const applyDefaultRepairWarehouseForSupplier = useCallback(
    (supplierName: string) => {
      if (isEdit || isDetailView) return;
      const trialFail = formRef.current?.getFieldValue('trial_result') === '不合格';
      const prodFail = formRef.current?.getFieldValue('production_trial_result') === '不合格';
      const repairMode =
        formRef.current?.getFieldValue('failure_handling') === TRIAL_FAILURE_REPAIR;
      const needsRepairWarehouse = trialFail || (prodFail && repairMode);
      if (!needsRepairWarehouse) return;
      const whId = pickDefaultRepairWarehouseId(warehouseRows, supplierName);
      formRef.current?.setFieldsValue({
        repair_warehouse_id: whId ?? undefined,
      });
    },
    [isDetailView, isEdit, warehouseRows],
  );

  const openRepairWarehouseQuickCreate = useCallback(
    (supplierName: string) => {
      const sn = supplierName.trim();
      if (!sn) {
        messageApi.warning('请先选择供应商');
        return;
      }
      const supplierUuid = findSupplierUuidForName(sn, supplierOptions);
      if (!supplierUuid) {
        messageApi.warning('未找到该供应商主数据，请从供应商下拉中选择');
        return;
      }
      setRepairWhCreateSupplierName(sn);
      setRepairWhCreateOpen(true);
      setTimeout(() => {
        repairWhCreateFormRef.current?.setFieldsValue({
          warehouse_type: '外部',
          supplier_uuid: supplierUuid,
        });
      }, 0);
    },
    [messageApi, supplierOptions],
  );

  const handleRepairWarehouseQuickCreate = useCallback(
    async (values: Record<string, unknown>) => {
      const supplierUuid = String(values.supplier_uuid ?? '').trim();
      if (!supplierUuid) {
        messageApi.warning('请选择供应商');
        return;
      }
      const payload: MoldWarehouseCreatePayload = {
        warehouse_code: String(values.warehouse_code ?? '').trim(),
        warehouse_name: String(values.warehouse_name ?? '').trim(),
        warehouse_type: '外部',
        supplier_uuid: supplierUuid,
        workshop_id: null,
      };
      setRepairWhCreateLoading(true);
      try {
        const row = await createMoldWarehouse(payload);
        await reloadWarehouses();
        formRef.current?.setFieldsValue({ repair_warehouse_id: row.id });
        setRepairWhCreateOpen(false);
        messageApi.success('已创建外部模具仓库并已填入送修仓库');
      } catch (e) {
        messageApi.error((e as Error).message || '创建模具仓库失败');
        throw e;
      } finally {
        setRepairWhCreateLoading(false);
      }
    },
    [messageApi, reloadWarehouses],
  );

  const applyLedgerFieldsByMoldCode = useCallback(
    async (code: string) => {
      const mc = code.trim();
      if (!mc) return;
      try {
        const row = await findMoldByCode(mc);
        if (!row || row.status !== '待启用') return;
        formRef.current?.setFieldsValue({
          mold_name: row.name || undefined,
          supplier_name: ledgerSupplierName(row),
          mold_warehouse_id: row.mold_warehouse_id ?? undefined,
        });
      } catch {
        /* 台账查询失败时不阻断填单 */
      }
      void applyPendingNotifyMemoryForMoldCode(mc);
    },
    [applyPendingNotifyMemoryForMoldCode],
  );

  const handleUsePendingMold = useCallback(
    async (row: MoldRow) => {
      const mc = row.mold_code.trim();
      const blockedSn = trialBlockedByMoldCode.get(mc);
      if (blockedSn !== undefined) {
        messageApi.error(trialBlockedMessage(mc, blockedSn));
        return;
      }
      try {
        const preview = await getNextMoldTrialTimes({ mold_code: mc });
        if (!preview.can_create) {
          messageApi.error(trialBlockedMessage(mc, preview.blocking_sheet_no ?? undefined));
          return;
        }
      } catch (e) {
        messageApi.error((e as Error).message || '无法校验试模流程状态');
        return;
      }
      setIsDetailView(false);
      setIsEdit(false);
      setEditId(null);
      setSkipPurchaseOrder(true);
      setFormWorkflowPhase(WORKFLOW_PHASE_TRIAL);
      setTrialUserPresets(buildTrialUserPresets());
      setProductionTrialUserPresets(buildProductionTrialUserPresets());
      setFormInitialValues({
        purchase_order_no: undefined,
        supplier_name: ledgerSupplierName(row),
        mold_code: row.mold_code,
        mold_name: row.name,
        mold_warehouse_id: row.mold_warehouse_id ?? undefined,
        trial_user_id: getDefaultTrialUserId(),
        failure_handling: undefined,
        pending_notify_user_ids: [],
        submitted_notify_user_ids: [...trialSubmittedNotifyDefaults],
        repair_warehouse_id: undefined,
        result_attachments: [],
      });
      setMoldPickerOpen(false);
      setModalVisible(true);
      messageApi.success(`已选择模具 ${row.mold_code}`);
    },
    [messageApi, trialBlockedByMoldCode, trialBlockedMessage, trialSubmittedNotifyDefaults],
  );

  const filteredPendingMolds = useMemo(() => {
    const q = moldKw.trim().toLowerCase();
    if (!q) return moldRows;
    return moldRows.filter(
      (r) =>
        r.mold_code.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)),
    );
  }, [moldRows, moldKw]);

  const showProductionSection = useMemo(
    () =>
      showProductionTrialSection(
        formWorkflowPhase,
        formInitialValues?.production_trial_result as string | undefined,
      ),
    [formWorkflowPhase, formInitialValues?.production_trial_result],
  );

  const createToolbarActions = useMemo(
    () => [
      <Tooltip {...rowActionKind('skip')}
        key="from-po-tip"
        title={
          canCreateFromPo
            ? '从当前数据集拉列表，选一行带出订单与模具信息'
            : '请完成「数据集」配置：一个数据集 + 四个列名'
        }
      >
        <span>
          <Button {...rowActionKind('create')}
            key="from-mold-po"
            type="primary"
            icon={<ShoppingOutlined />}
            disabled={!canCreateFromPo}
            onClick={handleOpenPoFromErp}
          >
            从模具采购单创建
          </Button>
        </span>
      </Tooltip>,
      <Button {...rowActionKind('create')} key="from-pending-mold" onClick={handleOpenMoldPicker}>
        从待启用模具创建
      </Button>,
    ],
    [canCreateFromPo, handleOpenPoFromErp, handleOpenMoldPicker],
  );

  const poPickerFilteredRows = useMemo(() => {
    const b = datasetBinding;
    const poCol = b?.purchase_order_column?.trim();
    if (!poCol) return poPickerRows;
    const supCol = (b?.supplier_column || '').trim();
    const codeCol = (b?.mold_code_column || '').trim();
    const nameCol = (b?.mold_name_column || '').trim();

    let rows = poPickerRows;
    if (poPickerTrialFilter !== 'all') {
      rows = rows.filter((row) => {
        const no = String(row[poCol] ?? '').trim();
        const hasTrial = Boolean(no && (trialCountByPoNo.get(no) ?? 0) > 0);
        if (poPickerTrialFilter === 'pending') return !hasTrial;
        return hasTrial;
      });
    }

    const q = poPickerKw.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => {
        const haystack = [
          String(row[poCol] ?? ''),
          supCol ? String(row[supCol] ?? '') : '',
          codeCol ? String(row[codeCol] ?? '') : '',
          nameCol ? String(row[nameCol] ?? '') : '',
        ];
        return haystack.some((part) => part.toLowerCase().includes(q));
      });
    }
    return rows;
  }, [poPickerRows, datasetBinding, trialCountByPoNo, poPickerTrialFilter, poPickerKw]);

  const getPoPickerRowKey = useCallback(
    (row: Record<string, unknown>) => {
      const i = poPickerRows.indexOf(row);
      return i >= 0 ? String(i) : '__';
    },
    [poPickerRows],
  );

  useEffect(() => {
    if (!poPickerSelectedRow) return;
    if (!poPickerFilteredRows.includes(poPickerSelectedRow)) {
      setPoPickerSelectedKeys([]);
      setPoPickerSelectedRow(null);
    }
  }, [poPickerFilteredRows, poPickerSelectedRow]);

  const poPickerColumns = useMemo(() => {
    const b = datasetBinding;
    if (!b?.purchase_order_column?.trim()) return [];
    const po = b.purchase_order_column.trim();
    const sc = (b.supplier_column || '').trim();
    const mc = (b.mold_code_column || '').trim();
    const mn = (b.mold_name_column || '').trim();
    return [
      {
        title: '采购订单号',
        dataIndex: po,
        key: 'po',
        ellipsis: true,
        width: 240,
        render: (_: unknown, row: Record<string, unknown>) => {
          const no = String(row[po] ?? '').trim();
          const trialCount = no ? trialCountByPoNo.get(no) ?? 0 : 0;
          return (
            <Space size={6} wrap>
              <span>{no || '—'}</span>
              {trialCount > 0 ? (
                <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                  试模{trialCount}次
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      { title: '供应商', dataIndex: sc, key: 'sup', ellipsis: true, width: 160 },
      { title: '模具代号', dataIndex: mc, key: 'code', ellipsis: true, width: 120 },
      { title: '模具名称', dataIndex: mn, key: 'name', ellipsis: true },
    ];
  }, [datasetBinding, trialCountByPoNo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await supplierApi.list({ limit: 1000, isActive: true });
        const list = unwrapSupplyPagedList<Supplier>(res);
        if (cancelled) return;
        setSupplierOptions(
          list.map((s) => ({
            key: s.uuid,
            value: s.name,
            label: s.code ? `${s.code} · ${s.name}` : s.name,
          })),
        );
      } catch {
        if (!cancelled) setSupplierOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listMoldWarehouses()
      .then((rows) => {
        if (cancelled) return;
        setWarehouseRows(rows);
        setWarehouseOptions(rows.map((w) => ({ value: w.id, label: formatMoldWarehouseLabel(w) })));
      })
      .catch(() => {
        if (!cancelled) {
          setWarehouseRows([]);
          setWarehouseOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalVisible || isDetailView || warehouseRows.length === 0) return;
    const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
    if (!sn) return;
    if (parseMoldWarehouseIdForForm(formRef.current?.getFieldValue('repair_warehouse_id')) != null) return;

    const trialFail = formRef.current?.getFieldValue('trial_result') === '不合格';
    const prodFail = formRef.current?.getFieldValue('production_trial_result') === '不合格';
    if (trialFail) {
      applyDefaultRepairWarehouseForSupplier(sn);
      return;
    }
    if (prodFail && formRef.current?.getFieldValue('failure_handling') === TRIAL_FAILURE_REPAIR) {
      applyDefaultRepairWarehouseForSupplier(sn);
    }
  }, [
    applyDefaultRepairWarehouseForSupplier,
    isDetailView,
    modalVisible,
    warehouseRows,
  ]);

  const openSheetForm = async (record: MoldTrialSheetRow, detailOnly: boolean) => {
    try {
      const detail = await getMoldTrialSheet(record.id);
      let ledgerMold: MoldRow | undefined;
      if (canReadMoldLedger && detail.mold_code) {
        try {
          ledgerMold = await findMoldByCode(detail.mold_code);
        } catch {
          ledgerMold = undefined;
        }
      }
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(detail.id);
      setAuditSheetStatus(detail.sheet_status);
      setSkipPurchaseOrder(!String(detail.purchase_order_no ?? '').trim());
      setFormWorkflowPhase(sheetWorkflowPhase(detail));
      setTrialUserPresets(buildTrialUserPresets(detail));
      setProductionTrialUserPresets(buildProductionTrialUserPresets(detail));
      const notifyOptions = (detail.pending_notify_users || [])
        .map((u) => ({
          value: u.id,
          label: u.name,
        }))
        .filter((x) => x.value > 0 && x.label.trim());
      notifyOptions.forEach((o) => pendingNotifyLabelRef.set(o.value, o.label));
      setPendingNotifyPresetOptions(notifyOptions);
      setFormInitialValues({
        purchase_order_no: detail.purchase_order_no,
        supplier_name: detail.supplier_name ?? undefined,
        mold_code: detail.mold_code ?? undefined,
        mold_name: detail.mold_name ?? undefined,
        mold_warehouse_id: ledgerMold?.mold_warehouse_id ?? undefined,
        trial_user_id: detail.trial_user_id ?? getDefaultTrialUserId(),
        trial_user_name: detail.trial_user_name ?? undefined,
        trial_times: detail.trial_times ?? undefined,
        result_attachments: await uuidsToSecureUploadFileList(detail.result_attachment_file_uuids),
        inspection_attachments: await uuidsToSecureUploadFileList(detail.inspection_attachment_file_uuids),
        trial_result: detail.trial_result,
        production_trial_user_id: detail.production_trial_user_id ?? getDefaultTrialUserId(),
        production_trial_result: detail.production_trial_result ?? undefined,
        failure_handling: detail.failure_handling ?? undefined,
        pending_notify_user_ids: detail.pending_notify_user_ids ?? [],
        submitted_notify_user_ids:
          (detail.submitted_notify_user_ids?.length
            ? detail.submitted_notify_user_ids
            : trialSubmittedNotifyDefaults) ?? [],
        repair_warehouse_id: detail.repair_warehouse_id ?? undefined,
        adjustment_points: detail.adjustment_points ?? undefined,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载试模单失败');
    }
  };

  const handleEdit = (record: MoldTrialSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldTrialSheetRow) => void openSheetForm(record, true);

  const handleDeleteOne = (record: MoldTrialSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除试模单「${record.sheet_no || record.purchase_order_no || record.mold_code || record.id}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldTrialSheet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const parseAdjustmentPoints = (values: Record<string, unknown>): string | null => {
    const s = String(values.adjustment_points ?? '').trim();
    return s || null;
  };

  const buildPayload = (
    values: Record<string, unknown>,
    phase: string,
  ): MoldTrialSheetCreatePayload => {
    const parseUserId = (key: string) => {
      const v = values[key];
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
    };

    if (isProductionTrialPhase(phase)) {
      const prodResult = values.production_trial_result === '不合格' ? '不合格' : '合格';
      const submittedNotifyIds = trialSubmittedNeedsFormNotifyUsers
        ? parsePendingNotifyUserIds(values.submitted_notify_user_ids)
        : [];
      const base: MoldTrialSheetCreatePayload = {
        production_trial_result: prodResult,
        production_trial_user_id: parseUserId('production_trial_user_id'),
        inspection_attachment_file_uuids: normUploadUuids(values.inspection_attachments),
        ...(trialSubmittedNeedsFormNotifyUsers
          ? { submitted_notify_user_ids: submittedNotifyIds }
          : {}),
      };
      if (prodResult !== '不合格') {
        return {
          ...base,
          failure_handling: null,
          pending_notify_user_ids: [],
          repair_warehouse_id: null,
        };
      }
      const mode = String(values.failure_handling ?? '').trim();
      if (mode === TRIAL_FAILURE_REPAIR) {
        return {
          ...base,
          failure_handling: TRIAL_FAILURE_REPAIR,
          pending_notify_user_ids: [],
          repair_warehouse_id: parseMoldWarehouseIdForForm(values.repair_warehouse_id) ?? undefined,
          adjustment_points: parseAdjustmentPoints(values),
        };
      }
      return {
        ...base,
        failure_handling: TRIAL_FAILURE_PENDING,
        pending_notify_user_ids: parsePendingNotifyUserIds(values.pending_notify_user_ids),
        repair_warehouse_id: null,
        adjustment_points: parseAdjustmentPoints(values),
      };
    }

    const trialResult = values.trial_result === '不合格' ? '不合格' : '合格';
    const submittedNotifyIds = trialSubmittedNeedsFormNotifyUsers
      ? parsePendingNotifyUserIds(values.submitted_notify_user_ids)
      : [];
    const base: MoldTrialSheetCreatePayload = {
      purchase_order_no: (() => {
        const s = String(values.purchase_order_no ?? '').trim();
        return s || null;
      })(),
      supplier_name: String(values.supplier_name ?? '').trim() || null,
      mold_code: String(values.mold_code ?? '').trim() || null,
      mold_name: String(values.mold_name ?? '').trim() || null,
      result_attachment_file_uuids: normUploadUuids(values.result_attachments),
      trial_result: trialResult,
      trial_user_id: parseUserId('trial_user_id'),
      ...(trialSubmittedNeedsFormNotifyUsers
        ? { submitted_notify_user_ids: submittedNotifyIds }
        : {}),
    };
    if (trialResult === '不合格') {
      return {
        ...base,
        failure_handling: TRIAL_FAILURE_REPAIR,
        pending_notify_user_ids: [],
        repair_warehouse_id: parseMoldWarehouseIdForForm(values.repair_warehouse_id) ?? undefined,
        adjustment_points: parseAdjustmentPoints(values),
      };
    }
    const prodResult = values.production_trial_result;
    if (prodResult === '合格' || prodResult === '不合格') {
      const prodPayload: MoldTrialSheetCreatePayload = {
        ...base,
        production_trial_result: prodResult,
        production_trial_user_id: parseUserId('production_trial_user_id'),
        inspection_attachment_file_uuids: normUploadUuids(values.inspection_attachments),
      };
      if (prodResult === '不合格') {
        const mode = String(values.failure_handling ?? '').trim();
        if (mode === TRIAL_FAILURE_REPAIR) {
          return {
            ...prodPayload,
            failure_handling: TRIAL_FAILURE_REPAIR,
            pending_notify_user_ids: [],
            repair_warehouse_id: parseMoldWarehouseIdForForm(values.repair_warehouse_id) ?? undefined,
            adjustment_points: parseAdjustmentPoints(values),
          };
        }
        return {
          ...prodPayload,
          failure_handling: TRIAL_FAILURE_PENDING,
          pending_notify_user_ids: parsePendingNotifyUserIds(values.pending_notify_user_ids),
          repair_warehouse_id: null,
          adjustment_points: parseAdjustmentPoints(values),
        };
      }
      return {
        ...prodPayload,
        failure_handling: null,
        pending_notify_user_ids: [],
        repair_warehouse_id: null,
      };
    }
    return {
      ...base,
      failure_handling: null,
      pending_notify_user_ids: [],
      repair_warehouse_id: null,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const po = String(values.purchase_order_no ?? '').trim();
    const mc = String(values.mold_code ?? '').trim();
    if (!skipPurchaseOrder && !po) {
      messageApi.warning('请输入采购订单号');
      throw new Error('validation');
    }
    if (skipPurchaseOrder && !mc) {
      messageApi.warning('请选择或填写模具代号');
      throw new Error('validation');
    }
    if (!isProductionTrialPhase(formWorkflowPhase)) {
      const trialUserRaw = values.trial_user_id;
      const trialUserId =
        typeof trialUserRaw === 'number' ? trialUserRaw : Number(trialUserRaw);
      if (!Number.isFinite(trialUserId) || trialUserId <= 0) {
        messageApi.warning('请选择试模人员');
        throw new Error('validation');
      }
      if (values.trial_result !== '合格' && values.trial_result !== '不合格') {
        messageApi.warning('请选择试模结果');
        throw new Error('validation');
      }
      if (values.trial_result === '不合格') {
        if (!parseAdjustmentPoints(values)) {
          messageApi.warning('试模不合格时请填写需要调整的点');
          throw new Error('validation');
        }
        const whId = parseMoldWarehouseIdForForm(values.repair_warehouse_id);
        if (whId == null) {
          messageApi.warning('试模不合格须立即送修，请选择送修仓库');
          throw new Error('validation');
        }
      }
      if (values.trial_result === '合格' && values.production_trial_result) {
        const prodUserRaw = values.production_trial_user_id;
        const prodUserId = typeof prodUserRaw === 'number' ? prodUserRaw : Number(prodUserRaw);
        if (!Number.isFinite(prodUserId) || prodUserId <= 0) {
          messageApi.warning('填写试产检验结果时请选择试产检验人员');
          throw new Error('validation');
        }
        if (values.production_trial_result === '不合格') {
          if (!parseAdjustmentPoints(values)) {
            messageApi.warning('试产不合格时请填写需要调整的点');
            throw new Error('validation');
          }
          const mode = String(values.failure_handling ?? '').trim() || TRIAL_FAILURE_REPAIR;
          if (!mode) {
            messageApi.warning('试产不合格时请选择处理方式');
            throw new Error('validation');
          }
          if (mode === TRIAL_FAILURE_REPAIR) {
            const whId = parseMoldWarehouseIdForForm(values.repair_warehouse_id);
            if (whId == null) {
              messageApi.warning('试产不合格须立即送修，请选择送修仓库');
              throw new Error('validation');
            }
          }
        }
      }
    }
    if (isProductionTrialPhase(formWorkflowPhase)) {
      const prodUserRaw = values.production_trial_user_id;
      const prodUserId = typeof prodUserRaw === 'number' ? prodUserRaw : Number(prodUserRaw);
      if (!Number.isFinite(prodUserId) || prodUserId <= 0) {
        messageApi.warning('请选择试产检验人员');
        throw new Error('validation');
      }
      if (!values.production_trial_result) {
        messageApi.warning('请选择试产检验结果');
        throw new Error('validation');
      }
      if (values.production_trial_result === '不合格') {
        if (!parseAdjustmentPoints(values)) {
          messageApi.warning('试产不合格时请填写需要调整的点');
          throw new Error('validation');
        }
        const mode = String(values.failure_handling ?? '').trim() || TRIAL_FAILURE_REPAIR;
        if (mode === TRIAL_FAILURE_REPAIR) {
          const whId = parseMoldWarehouseIdForForm(values.repair_warehouse_id);
          if (whId == null) {
            messageApi.warning('试产不合格须立即送修，请选择送修仓库');
            throw new Error('validation');
          }
        }
      }
    }
    if (!isEdit && (mc || po)) {
      try {
        const preview = await getNextMoldTrialTimes({
          mold_code: mc || undefined,
          purchase_order_no: po || undefined,
        });
        if (!preview.can_create) {
          const sn = preview.blocking_sheet_no?.trim();
          messageApi.error(
            sn
              ? `该模具/订单仍有未完结的试模流程（试模单 ${sn}），不可新建`
              : '该模具/订单仍有未完结的试模流程，不可新建',
          );
          throw new Error('validation');
        }
      } catch (e) {
        if ((e as Error).message === 'validation') throw e;
      }
    }
    setFormLoading(true);
    try {
      const payload = buildPayload(values, formWorkflowPhase);
      if (isEdit && editId != null) {
        await updateMoldTrialSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldTrialSheet(payload);
        messageApi.success('已创建');
      }

      if (!isProductionTrialPhase(formWorkflowPhase) && payload.mold_code) {
        try {
          const target = await findMoldByCode(payload.mold_code);
          if (target) {
            const whId = parseMoldWarehouseIdForForm(values.mold_warehouse_id);
            if (whId != null) {
              await updateMold(target.id, { mold_warehouse_id: whId });
              messageApi.success('所在仓库已同步至台账');
            }
          }
        } catch {
          messageApi.warning('同步模具台账仓库失败');
        }
      }

      setModalVisible(false);
      bumpMoldLedgerTableCache();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const applyFromDatasetByPurchaseOrder = useCallback(
    async (purchaseOrderNo: string) => {
      const b = datasetBinding;
      if (!b?.dataset_uuid || !(b.order_param_key || '').trim()) return;
      const po = (purchaseOrderNo || '').trim();
      if (!po) return;
      const supK = (b.supplier_column || '').trim();
      const codeK = (b.mold_code_column || '').trim();
      const nameK = (b.mold_name_column || '').trim();
      if (!supK || !codeK || !nameK) return;
      try {
        const res = await executeDatasetQuery(b.dataset_uuid, {
          parameters: { [String(b.order_param_key).trim()]: po },
          limit: 10,
          offset: 0,
        });
        if (!res.success) {
          messageApi.warning(res.error || '按采购订单号查询失败');
          return;
        }
        const rows = res.data ?? [];
        if (rows.length === 0) {
          messageApi.info('未查到与该采购订单号匹配的记录');
          return;
        }
        if (rows.length > 1) {
          messageApi.info(`查询到 ${rows.length} 条，已取第一条填入供应商与模具信息`);
        }
        const row = rows[0] as Record<string, unknown>;
        const pick = (key: string) => {
          const v = row[key];
          return v == null ? undefined : String(v);
        };
        const moldCode = pick(codeK);
        formRef.current?.setFieldsValue({
          supplier_name: pick(supK),
          mold_code: moldCode,
          mold_name: pick(nameK),
        });
        if (moldCode) void applyPendingNotifyMemoryForMoldCode(moldCode);
      } catch (e) {
        messageApi.error((e as Error).message || '查询失败');
      }
    },
    [applyPendingNotifyMemoryForMoldCode, datasetBinding, messageApi],
  );

  useEffect(() => {
    if (!modalVisible || isEdit || isDetailView) return;
    setPendingNotifyPresetOptions([]);
  }, [isDetailView, isEdit, modalVisible]);

  const handleDatasetConfig = useCallback(() => {
    setBindingTestResult(null);
    setBindingModalOpen(true);
  }, []);

  useEffect(() => {
    if (!bindingModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const pageSize = 100;
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const maxPages = 50;
        while (page <= maxPages) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          if (cancelled) return;
          for (const d of res.items) {
            options.push({ label: `${d.name}（${d.code}）`, value: d.uuid });
          }
          if (res.items.length < pageSize || options.length >= res.total) break;
          page += 1;
        }
        setDatasetSelectOptions(options);
      } catch (e) {
        if (!cancelled) {
          setDatasetSelectOptions([]);
          messageApi.error((e as Error).message || '加载数据集列表失败');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, messageApi]);

  useEffect(() => {
    if (!bindingModalOpen) return;
    bindingCfgForm.resetFields();
    const d = datasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      purchase_order_column: d?.purchase_order_column ?? undefined,
      supplier_column: d?.supplier_column ?? undefined,
      mold_code_column: d?.mold_code_column ?? undefined,
      mold_name_column: d?.mold_name_column ?? undefined,
      order_param_key: d?.order_param_key ?? '',
      test_po: '',
    });
    setBindingTestResult(null);
    setBindingColumnOptions([]);
  }, [bindingModalOpen, datasetBinding, bindingCfgForm]);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putMoldTrialDatasetBinding({ dataset_uuid: '' });
        setDatasetBinding(saved.dataset_uuid ? saved : null);
        messageApi.success('已清除关联');
        setBindingModalOpen(false);
      } catch (e) {
        messageApi.error((e as Error).message || '保存失败');
      } finally {
        setBindingModalBusy(false);
      }
      return;
    }
    let v: Record<string, unknown>;
    try {
      v = await bindingCfgForm.validateFields([
        'purchase_order_column',
        'supplier_column',
        'mold_code_column',
        'mold_name_column',
      ]);
    } catch {
      return;
    }
    const opk = String(bindingCfgForm.getFieldValue('order_param_key') ?? '').trim();
    const sc = String(v.supplier_column ?? '').trim();
    const mc = String(v.mold_code_column ?? '').trim();
    const mn = String(v.mold_name_column ?? '').trim();
    const poCol = String(v.purchase_order_column ?? '').trim();
    if (!poCol || !sc || !mc || !mn) {
      messageApi.warning('请填写采购订单号、供应商、模具代号、模具名称对应的结果列名');
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putMoldTrialDatasetBinding({
        dataset_uuid: ds,
        order_param_key: opk || null,
        supplier_column: sc,
        mold_code_column: mc,
        mold_name_column: mn,
        purchase_order_column: poCol,
      });
      setDatasetBinding(saved);
      messageApi.success('关联已保存');
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const handleBindingTestQuery = async () => {
    let v: Record<string, unknown>;
    try {
      v = await bindingCfgForm.validateFields([
        'dataset_uuid',
        'purchase_order_column',
        'supplier_column',
        'mold_code_column',
        'mold_name_column',
        'test_po',
      ]);
    } catch {
      return;
    }
    const testPo = String(v.test_po ?? '').trim();
    if (!testPo) {
      messageApi.warning('请输入测试用采购订单号');
      return;
    }
    const ds = String(v.dataset_uuid ?? '').trim();
    const opk = String(bindingCfgForm.getFieldValue('order_param_key') ?? '').trim();
    if (!ds || !opk) {
      messageApi.warning('测试时请填写「订单号参数名」');
      return;
    }
    setBindingModalBusy(true);
    setBindingTestResult(null);
    try {
      const res = await executeDatasetQuery(ds, {
        parameters: { [opk]: testPo },
        limit: 10,
        offset: 0,
      });
      if (!res.success) {
        setBindingTestResult(res.error || '查询失败');
        return;
      }
      const rows = res.data ?? [];
      if (rows.length === 0) {
        setBindingTestResult('查询成功，但无数据行');
        return;
      }
      const row = rows[0] as Record<string, unknown>;
      const sc = String(v.supplier_column ?? '').trim();
      const mc = String(v.mold_code_column ?? '').trim();
      const mn = String(v.mold_name_column ?? '').trim();
      const parts = [
        `供应商: ${String(row[sc] ?? '') || '（列名不匹配或为空）'}`,
        `模具代号: ${String(row[mc] ?? '') || '（列名不匹配或为空）'}`,
        `模具名称: ${String(row[mn] ?? '') || '（列名不匹配或为空）'}`,
      ];
      setBindingTestResult(`${parts.join('；')}（共 ${rows.length} 行，预览首行）`);
    } catch (e) {
      setBindingTestResult((e as Error).message || '请求失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> =>
      withMoldPictureCardUploadClass({
        listType: 'picture-card',
        accept: '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar',
        beforeUpload: (file) => {
          const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
          if (!isLt30M) {
            messageApi.error('单个文件需小于 30MB');
            return Upload.LIST_IGNORE;
          }
          return true;
        },
        customRequest: async (options, _info) => {
          try {
            const file = options.file as Parameters<typeof uploadFile>[0];
            const res = await uploadFile(file, { category: 'haoligo_mold_trial' });
            options.onSuccess?.(res, options.file);
          } catch (err) {
            options.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        },
      }),
    [messageApi],
  );

  const columns: ProColumns<MoldTrialSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/订单号/模具代号/名称' },
    },
    {
      title: '试模单单号',
      dataIndex: 'sheet_no',
      key: 'sheet_no',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      hideInSearch: true,
      render: (_, r) => <TrialSheetDocStackedCell row={r} />,
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_no',
      key: 'purchase_order_no',
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: '模具',
      dataIndex: 'mold_code',
      key: 'mold_code',
      minWidth: 168,
      width: 168,
      resizable: false,
      ellipsis: false,
      hideInSearch: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.mold_name ?? '').trim() || '—'}
          secondary={String(r.mold_code ?? '').trim() || '—'}
        />
      ),
    },
    {
      title: '模具名称',
      dataIndex: 'mold_name',
      key: 'mold_name',
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: '试模次数',
      dataIndex: 'trial_times',
      key: 'trial_times',
      width: 96,
      hideInSearch: true,
    },
    {
      title: '试模人员',
      dataIndex: 'trial_user_name',
      key: 'trial_user_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.trial_user_name || '—',
    },
    {
      title: '处理方式',
      dataIndex: 'failure_handling',
      key: 'failure_handling',
      width: 96,
      hideInSearch: true,
      render: (_, r) => {
        const show =
          isProductionTrialUnqualified(r) ||
          (r.trial_result === '不合格' && Boolean((r.failure_handling || '').trim()));
        return show ? renderFailureHandlingCell(r.failure_handling) : '—';
      },
    },
    {
      title: '流程阶段',
      dataIndex: 'workflow_phase',
      key: 'workflow_phase',
      width: 128,
      hideInSearch: true,
      render: (_, r) => {
        const p = displayWorkflowPhaseLabel(r);
        const color =
          p === '送修处理中'
            ? 'warning'
            : p === WORKFLOW_PHASE_PENDING_PRODUCTION
              ? 'processing'
              : p === WORKFLOW_PHASE_CLOSED
                ? 'default'
                : 'blue';
        return <Tag color={color}>{p}</Tag>;
      },
    },
    {
      title: '试模结果',
      dataIndex: 'trial_result',
      key: 'trial_result',
      width: 100,
      valueType: 'select',
      valueEnum: trialResultEnum,
      fieldProps: { allowClear: true },
      render: (_, r) => (
        <Tag color={r.trial_result === '合格' ? 'success' : 'error'}>{r.trial_result}</Tag>
      ),
    },
    {
      title: '试产检验结果',
      dataIndex: 'production_trial_result',
      key: 'production_trial_result',
      width: 100,
      hideInSearch: true,
      render: (_, r) => {
        const pr = (r.production_trial_result || '').trim();
        if (!pr) return '—';
        return <Tag color={pr === '合格' ? 'success' : 'error'}>{pr}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      key: 'sheet_status',
      width: 100,
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      fieldProps: { allowClear: true },
      render: (_, r) => moldSheetAuditStatusTag(r.sheet_status),
    },
    moldDocumentCreatedAtColumn<MoldTrialSheetRow>(),
    {
      title: '操作',
      key: 'option',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      uniActionRenderOptions: { ...MOLD_SHEET_TABLE_ACTION_OPTIONS, directMax: 8 },
      render: (_, record) => {
        const approved = isMoldSheetApproved(record.sheet_status);
        const canShowMarkAdjustment = canConfirmAdjustmentTrial && canMarkAdjustmentComplete(record);
        const auditHandlers = {
          onApprove: () => approveMoldTrialSheet(record.id),
          onReject: () => rejectMoldTrialSheet(record.id),
          onRevoke: () => revokeMoldTrialSheetApproval(record.id),
        };
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>
            详情
          </Button>,
        ];
        if (trialPerms.canUpdate) {
          actions.push(
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={approved}
              onClick={() => void handleEdit(record)}
            >
              编辑
            </Button>,
          );
        }
        if (trialPerms.canDelete) {
          actions.push(
            <Button {...rowActionKind('delete')}
              key="delete"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={approved}
              onClick={() => handleDeleteOne(record)}
            >
              删除
            </Button>,
          );
        }
        if (canAuditMoldSheet(currentUser, HAOLIGO_TRIAL_RESOURCE)) {
          actions.push(
            ...buildMoldSheetAuditActionElements({
              canAudit: true,
              sheetStatus: record.sheet_status,
              handlers: auditHandlers,
              messageApi,
              reload: () => actionRef.current?.reload(),
              revokeOnly: isTrialSheetHandlingClosed(record),
            }),
          );
        }
        if (canDispatchTrial && canDispatchTrialSheet(record)) {
          actions.push(
            <Button {...rowActionKind('dispatch')}
              key="dispatch"
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => void openDispatchModal(record)}
            >
              发出
            </Button>,
          );
        }
        if (canShowMarkAdjustment) {
          actions.push(
            <Button {...rowActionKind('confirm_adjustment')}
              key="adjustment-done"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              loading={adjustmentSubmittingId === record.id}
              onClick={() => {
                Modal.confirm({
                  title: '确认调整完成？',
                  content: isExternalPartner
                    ? '确认维修/调整已完成；模具仍在外协仓，待本公司到厂后由本公司人员确认收回。'
                    : '表示维修/调整已完成（立即送修或已发出后），模具仍在外部仓；本公司到厂后由本公司人员确认收回。',
                  okText: '确认',
                  cancelText: '取消',
                  onOk: () => handleMarkAdjustmentComplete(record),
                });
              }}
            >
              调整完成
            </Button>,
          );
        }
        if (canRecallTrial && canConfirmRecallTrialSheet(record)) {
          actions.push(
            <Button {...rowActionKind('recall')}
              key="recall"
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => void openRecallModal(record)}
            >
              确认收回
            </Button>,
          );
        }
        return actions;
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldTrialSheetRow>
          headerTitle="模具试模单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.trial"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          toolBarActionsBeforeCreate={createToolbarActions}
          showDatasetConfigButton
          onDatasetConfig={handleDatasetConfig}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listMoldTrialSheets({
                skip,
                limit: pageSize,
                sheet_status:
                  typeof searchFormValues?.sheet_status === 'string' && searchFormValues.sheet_status
                    ? searchFormValues.sheet_status
                    : undefined,
                trial_result:
                  typeof searchFormValues?.trial_result === 'string' ? searchFormValues.trial_result : undefined,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return {
                data: res.items,
                success: true,
                total: res.total,
              };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isDetailView ? '试模单详情' : isEdit ? '编辑试模单' : '新增试模单'}
        open={modalVisible}
        readOnly={isDetailView}
        extraFooter={
          isDetailView && editId != null ? (
            <MoldSheetAuditActions
              resource={HAOLIGO_TRIAL_RESOURCE}
              sheetStatus={auditSheetStatus}
              reload={() => {
                actionRef.current?.reload();
                void getMoldTrialSheet(editId).then((d) => setAuditSheetStatus(d.sheet_status));
              }}
              handlers={{
                onApprove: () => approveMoldTrialSheet(editId),
                onReject: () => rejectMoldTrialSheet(editId),
                onRevoke: () => revokeMoldTrialSheetApproval(editId),
              }}
            />
          ) : undefined
        }
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
          setSkipPurchaseOrder(false);
          setFormWorkflowPhase(WORKFLOW_PHASE_TRIAL);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <Row gutter={16}>
          {!isEdit && !isDetailView ? (
            <MoldTrialTimesPreview
              active={modalVisible}
              initialKey={
                modalVisible
                  ? `${String(formInitialValues?.mold_code ?? '')}|${String(formInitialValues?.purchase_order_no ?? '')}`
                  : ''
              }
            />
          ) : null}
          {isEdit || isDetailView ? (
            <Col span={12}>
              <ProFormDigit
                name="trial_times"
                label="试模次数"
                readonly
                disabled
                fieldProps={{ precision: 0, style: { width: '100%' } }}
                extra="按模具代号自动累计，每张试模单计 1 次"
              />
            </Col>
          ) : null}
          <Col span={12}>
            <ProFormText
              name="purchase_order_no"
              label="采购订单号"
              placeholder={skipPurchaseOrder ? '无采购单时可留空' : '请输入采购订单号'}
              rules={skipPurchaseOrder ? [] : [{ required: true, message: '请输入采购订单号' }]}
              fieldProps={{
                onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                  void applyFromDatasetByPurchaseOrder(e.target.value);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="supplier_name"
              label="供应商"
              placeholder="请选择或输入供应商"
              showSearch
              allowClear
              options={supplierOptions}
              fieldProps={{
                optionFilterProp: 'label',
                style: { width: '100%' },
                onChange: (v: string) => {
                  applyDefaultRepairWarehouseForSupplier(String(v ?? ''));
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="mold_code"
              label="模具代号"
              placeholder="请输入模具代号"
              rules={skipPurchaseOrder ? [{ required: true, message: '请填写模具代号' }] : []}
              fieldProps={{
                onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  if (skipPurchaseOrder) {
                    void applyLedgerFieldsByMoldCode(v);
                  } else {
                    void applyPendingNotifyMemoryForMoldCode(v);
                  }
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="mold_name" label="模具名称" placeholder="请输入模具名称" />
          </Col>
          {!showProductionSection ? (
            <Col span={12}>
              <ProFormSelect
                name="mold_warehouse_id"
                label="所在仓库"
                placeholder="请选择模具仓库"
                allowClear
                showSearch
                options={warehouseOptions}
                fieldProps={{ optionFilterProp: 'label' }}
                disabled={showProductionSection || isDetailView}
              />
            </Col>
          ) : null}
          {showProductionSection && isProductionTrialPhase(formWorkflowPhase) ? (
            <>
              <Col span={24} style={{ marginBottom: 24 }}>
                <Alert
                  type="info"
                  showIcon
                  message={`流程阶段：${formWorkflowPhase}`}
                  description="试模已合格，请完成试产检验（上传试产检验附件、填写试产检验结果）；试产检验合格后审核通过将把模具台账状态更新为「待用」。"
                />
              </Col>
              {lockedTrialMoldSummaryCols(
                formInitialValues?.trial_user_id as number | undefined,
                formInitialValues?.trial_user_name as string | undefined,
                trialUserPresets,
              )}
            </>
          ) : null}
          {!showProductionSection ? (
            <>
              <Col span={24}>
                <ProFormUploadButton
                  name="result_attachments"
                  label="试模结果附件"
                  max={10}
                  fieldProps={{ ...uploadFieldProps, disabled: isDetailView }}
                />
              </Col>
              <Col span={12}>
                <UniUserIdSelect
                  name="trial_user_id"
                  label="试模人员"
                  placeholder="请选择试模人员"
                  required
                  readonly={isDetailView}
                  disabled={isDetailView}
                  presetUsers={trialUserPresets}
                  searchUsers={searchTrialOperatorUsers}
                />
              </Col>
              {!isDetailView &&
              trialSubmittedNeedsFormNotifyUsers &&
              (auditSheetStatus === '待审核' || auditSheetStatus === '已驳回' || !isEdit) ? (
                <Col span={24}>
                  <FormNotifyUsersSelect
                    name="submitted_notify_user_ids"
                    label="待审核通知人员"
                    seedUserIds={trialSubmittedNotifyDefaults}
                    placeholder={
                      trialSubmittedNotifyDefaults.length > 0
                        ? '已按配置预填默认人员；可改选，留空则仍按默认发送'
                        : '请选择待审核通知人员（可在配置中心为该规则设置默认人员）'
                    }
                    searchUsers={searchSubmittedNotifyUsers}
                  />
                </Col>
              ) : null}
              <Col span={12}>
                <ProFormRadio.Group
                  name="trial_result"
                  label="试模结果"
                  rules={[{ required: true, message: '请选择试模结果' }]}
                  disabled={isDetailView}
                  options={[
                    { label: '合格', value: '合格' },
                    { label: '不合格', value: '不合格' },
                  ]}
                  fieldProps={{
                    onChange: (e) => {
                      const v = e.target.value;
                      if (v === '合格') {
                        const trialUid = formRef.current?.getFieldValue('trial_user_id');
                        const prod = formRef.current?.getFieldValue('production_trial_result');
                        formRef.current?.setFieldsValue({
                          failure_handling: undefined,
                          pending_notify_user_ids: [],
                          repair_warehouse_id: undefined,
                          production_trial_result: undefined,
                          production_trial_user_id:
                            formRef.current?.getFieldValue('production_trial_user_id') ?? trialUid,
                          ...(prod !== '不合格' ? { adjustment_points: undefined } : {}),
                        });
                        return;
                      }
                      if (v === '不合格') {
                        formRef.current?.setFieldsValue({
                          failure_handling: TRIAL_FAILURE_REPAIR,
                          production_trial_result: undefined,
                          production_trial_user_id: undefined,
                          inspection_attachments: [],
                          adjustment_points: undefined,
                        });
                        const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
                        applyDefaultRepairWarehouseForSupplier(sn);
                      }
                    },
                  }}
                />
              </Col>
              <ProFormDependency name={['trial_result']}>
                {({ trial_result }) => {
                  if (trial_result !== '合格') return null;
                  return (
                    <Col span={24} style={{ marginBottom: 24 }}>
                      <Alert
                        type="info"
                        showIcon
                        message="试产阶段"
                        description="试模合格后填写试产检验附件与试产检验结果；可先保存试模信息，试产检验内容也可后续补填。试产检验合格并审核通过后模具台账将更新为「待用」。"
                      />
                    </Col>
                  );
                }}
              </ProFormDependency>
              <ProFormDependency name={['trial_result', 'supplier_name', 'production_trial_user_id']}>
                {({ trial_result, supplier_name, production_trial_user_id }) => {
                  if (trial_result !== '合格') return null;
                  const supplierNameStr =
                    typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '');
                  return (
                    <>
                      <Col span={24}>
                        <ProFormUploadButton
                          name="inspection_attachments"
                          label="试产检验附件"
                          max={10}
                          fieldProps={{ ...uploadFieldProps, disabled: isDetailView }}
                        />
                      </Col>
                      <Col span={12}>
                        <UniUserIdSelect
                          name="production_trial_user_id"
                          label="试产检验人员"
                          placeholder="请选择试产检验人员"
                          readonly={isDetailView}
                          disabled={isDetailView}
                          presetUsers={productionTrialUserPresets}
                          searchUsers={searchTrialOperatorUsers}
                        />
                      </Col>
                      <Col span={12}>
                        <ProFormRadio.Group
                          name="production_trial_result"
                          label="试产检验结果"
                          disabled={isDetailView}
                          options={[
                            { label: '合格', value: '合格' },
                            { label: '不合格', value: '不合格' },
                          ]}
                          fieldProps={{
                            onChange: (e) => {
                              const v = e.target.value;
                              if (v === '合格') {
                                formRef.current?.setFieldsValue({
                                  failure_handling: undefined,
                                  pending_notify_user_ids: [],
                                  repair_warehouse_id: undefined,
                                  adjustment_points: undefined,
                                });
                                return;
                              }
                              if (v === '不合格') {
                                formRef.current?.setFieldsValue({
                                  failure_handling: TRIAL_FAILURE_REPAIR,
                                  pending_notify_user_ids: [],
                                  adjustment_points: undefined,
                                });
                                const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
                                applyDefaultRepairWarehouseForSupplier(sn);
                                const mc = String(formRef.current?.getFieldValue('mold_code') ?? '').trim();
                                if (mc) void applyPendingNotifyMemoryForMoldCode(mc);
                              }
                            },
                          }}
                        />
                      </Col>
                      <ProFormDependency name={['production_trial_result']}>
                        {({ production_trial_result }) => {
                          if (production_trial_result !== '不合格') return null;
                          return <TrialAdjustmentPointsField readonly={isDetailView} />;
                        }}
                      </ProFormDependency>
                      <ProFormDependency
                        name={[
                          'production_trial_result',
                          'supplier_name',
                          'failure_handling',
                          'production_trial_user_id',
                        ]}
                      >
                        {({
                          production_trial_result,
                          supplier_name,
                          failure_handling,
                          production_trial_user_id,
                        }) => {
                          if (production_trial_result !== '不合格') return null;
                          const supplierNameStr =
                            typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '');
                          const repairOptions = filterRepairWarehousesForSupplier(
                            warehouseRows,
                            supplierNameStr,
                          );
                          const notifyUserId =
                            typeof production_trial_user_id === 'number'
                              ? production_trial_user_id
                              : production_trial_user_id != null
                                ? Number(production_trial_user_id)
                                : null;
                          return (
                            <>
                              <Col span={12}>
                                <ProFormRadio.Group
                                  name="failure_handling"
                                  label="处理方式"
                                  rules={[{ required: true, message: '请选择处理方式' }]}
                                  options={[
                                    { label: TRIAL_FAILURE_PENDING, value: TRIAL_FAILURE_PENDING },
                                    { label: TRIAL_FAILURE_REPAIR, value: TRIAL_FAILURE_REPAIR },
                                  ]}
                                  fieldProps={{
                                    onChange: (e) => {
                                      const mode = e.target.value;
                                      if (mode === TRIAL_FAILURE_PENDING) {
                                        const mc = String(
                                          formRef.current?.getFieldValue('mold_code') ?? '',
                                        ).trim();
                                        if (mc) void applyPendingNotifyMemoryForMoldCode(mc);
                                        formRef.current?.setFieldsValue({ repair_warehouse_id: undefined });
                                        return;
                                      }
                                      if (mode === TRIAL_FAILURE_REPAIR) {
                                        const sn = String(
                                          formRef.current?.getFieldValue('supplier_name') ?? '',
                                        ).trim();
                                        applyDefaultRepairWarehouseForSupplier(sn);
                                      }
                                    },
                                  }}
                                />
                              </Col>
                              {failure_handling === TRIAL_FAILURE_PENDING ? (
                                <Col span={24}>
                                  <FormNotifyUsersSelect
                                    name="pending_notify_user_ids"
                                    label={t('app.haoligo.molds.trial.pendingNotifyUsers')}
                                    readonly={isDetailView}
                                    searchUsers={searchPendingNotifyUsers}
                                  />
                                  <TrialSupplierCcHint supplierName={supplierNameStr} />
                                </Col>
                              ) : null}
                              {failure_handling === TRIAL_FAILURE_REPAIR ? (
                                <TrialImmediateRepairWarehouseFields
                                  supplierNameStr={supplierNameStr}
                                  repairOptions={repairOptions}
                                  notifyUserId={notifyUserId}
                                  unqualifiedLabel="试产不合格"
                                  notifyPersonLabel="试产检验人员"
                                  onQuickCreateWarehouse={openRepairWarehouseQuickCreate}
                                />
                              ) : null}
                            </>
                          );
                        }}
                      </ProFormDependency>
                    </>
                  );
                }}
              </ProFormDependency>
              <ProFormDependency name={['trial_result', 'supplier_name', 'trial_user_id']}>
                {({ trial_result, supplier_name, trial_user_id }) => {
                  if (trial_result !== '不合格') return null;
                  const supplierNameStr =
                    typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '');
                  const repairOptions = filterRepairWarehousesForSupplier(warehouseRows, supplierNameStr);
                  const notifyUserId =
                    typeof trial_user_id === 'number'
                      ? trial_user_id
                      : trial_user_id != null
                        ? Number(trial_user_id)
                        : null;
                  return (
                    <>
                      <TrialAdjustmentPointsField readonly={isDetailView} />
                      <TrialImmediateRepairWarehouseFields
                        supplierNameStr={supplierNameStr}
                        repairOptions={repairOptions}
                        notifyUserId={notifyUserId}
                        unqualifiedLabel="试模不合格"
                        notifyPersonLabel="试模人员"
                        onQuickCreateWarehouse={openRepairWarehouseQuickCreate}
                      />
                    </>
                  );
                }}
              </ProFormDependency>
            </>
          ) : null}
          {showProductionSection ? (
            <>
              <Col span={24}>
                <ProFormUploadButton
                  name="inspection_attachments"
                  label="试产检验附件"
                  max={10}
                  fieldProps={{ ...uploadFieldProps, disabled: isDetailView }}
                />
              </Col>
              <Col span={12}>
                <UniUserIdSelect
                  name="production_trial_user_id"
                  label="试产检验人员"
                  placeholder="请选择试产检验人员"
                  required
                  readonly={isDetailView}
                  disabled={isDetailView}
                  presetUsers={productionTrialUserPresets}
                  searchUsers={searchTrialOperatorUsers}
                />
              </Col>
              <Col span={12}>
                <ProFormRadio.Group
                  name="production_trial_result"
                  label="试产检验结果"
                  rules={[{ required: true, message: '请选择试产检验结果' }]}
                  disabled={isDetailView}
                  options={[
                    { label: '合格', value: '合格' },
                    { label: '不合格', value: '不合格' },
                  ]}
                  fieldProps={{
                    onChange: (e) => {
                      const v = e.target.value;
                      if (v === '合格') {
                        formRef.current?.setFieldsValue({
                          failure_handling: undefined,
                          pending_notify_user_ids: [],
                          repair_warehouse_id: undefined,
                          adjustment_points: undefined,
                        });
                        return;
                      }
                      if (v === '不合格') {
                        formRef.current?.setFieldsValue({
                          failure_handling: TRIAL_FAILURE_REPAIR,
                          pending_notify_user_ids: [],
                          adjustment_points: undefined,
                        });
                        const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
                        applyDefaultRepairWarehouseForSupplier(sn);
                        const mc = String(formRef.current?.getFieldValue('mold_code') ?? '').trim();
                        if (mc) void applyPendingNotifyMemoryForMoldCode(mc);
                      }
                    },
                  }}
                />
              </Col>
              <ProFormDependency name={['production_trial_result']}>
                {({ production_trial_result }) => {
                  if (production_trial_result !== '不合格') return null;
                  return <TrialAdjustmentPointsField readonly={isDetailView} />;
                }}
              </ProFormDependency>
              <ProFormDependency
                name={['production_trial_result', 'supplier_name', 'failure_handling', 'production_trial_user_id']}
              >
                {({ production_trial_result, supplier_name, failure_handling, production_trial_user_id }) => {
                  if (production_trial_result !== '不合格') return null;
                  const supplierNameStr =
                    typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '');
                  const repairOptions = filterRepairWarehousesForSupplier(warehouseRows, supplierNameStr);
                  return (
                    <>
                      <Col span={12}>
                        <ProFormRadio.Group
                          name="failure_handling"
                          label="处理方式"
                          rules={[{ required: true, message: '请选择处理方式' }]}
                          options={[
                            { label: TRIAL_FAILURE_PENDING, value: TRIAL_FAILURE_PENDING },
                            { label: TRIAL_FAILURE_REPAIR, value: TRIAL_FAILURE_REPAIR },
                          ]}
                          fieldProps={{
                            onChange: (e) => {
                              const mode = e.target.value;
                              if (mode === TRIAL_FAILURE_PENDING) {
                                const mc = String(formRef.current?.getFieldValue('mold_code') ?? '').trim();
                                if (mc) void applyPendingNotifyMemoryForMoldCode(mc);
                                formRef.current?.setFieldsValue({ repair_warehouse_id: undefined });
                                return;
                              }
                              if (mode === TRIAL_FAILURE_REPAIR) {
                                const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
                                applyDefaultRepairWarehouseForSupplier(sn);
                              }
                            },
                          }}
                        />
                      </Col>
                      {failure_handling === TRIAL_FAILURE_PENDING ? (
                        <Col span={24}>
                          <FormNotifyUsersSelect
                            name="pending_notify_user_ids"
                            label={t('app.haoligo.molds.trial.pendingNotifyUsers')}
                            readonly={isDetailView}
                            searchUsers={searchPendingNotifyUsers}
                          />
                          <TrialSupplierCcHint
                            supplierName={
                              typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '')
                            }
                          />
                        </Col>
                      ) : null}
                      {failure_handling === TRIAL_FAILURE_REPAIR ? (
                        <TrialImmediateRepairWarehouseFields
                          supplierNameStr={supplierNameStr}
                          repairOptions={repairOptions}
                          notifyUserId={
                            typeof production_trial_user_id === 'number'
                              ? production_trial_user_id
                              : production_trial_user_id != null
                                ? Number(production_trial_user_id)
                                : null
                          }
                          unqualifiedLabel="试产不合格"
                          notifyPersonLabel="试产检验人员"
                          onQuickCreateWarehouse={openRepairWarehouseQuickCreate}
                        />
                      ) : null}
                    </>
                  );
                }}
              </ProFormDependency>
            </>
          ) : null}
          {showProductionSection && !isProductionTrialPhase(formWorkflowPhase)
            ? lockedTrialMoldSummaryCols(
                formInitialValues?.trial_user_id as number | undefined,
                formInitialValues?.trial_user_name as string | undefined,
                trialUserPresets,
              )
            : null}
        </Row>
      </FormModalTemplate>

      <FormModalTemplate
        title="新建外部模具仓库"
        open={repairWhCreateOpen}
        onClose={() => setRepairWhCreateOpen(false)}
        onFinish={handleRepairWarehouseQuickCreate}
        formRef={repairWhCreateFormRef}
        loading={repairWhCreateLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
        grid={false}
        destroyOnHidden
        initialValues={{ warehouse_type: '外部' }}
      >
        <Form.Item label="供应商">
          <Input disabled value={repairWhCreateSupplierName} />
        </Form.Item>
        <ProFormText name="supplier_uuid" hidden />
        <ProFormText
          name="warehouse_code"
          label="仓库编号"
          placeholder="请输入仓库编号"
          rules={[{ required: true, message: '请输入仓库编号' }]}
        />
        <ProFormText
          name="warehouse_name"
          label="仓库名称"
          placeholder="请输入仓库名称"
          rules={[{ required: true, message: '请输入仓库名称' }]}
        />
      </FormModalTemplate>

      <Modal
        title="试模单发出"
        open={dispatchModalOpen}
        onCancel={() => setDispatchModalOpen(false)}
        onOk={() => void handleDispatchConfirm()}
        confirmLoading={dispatchSubmitting}
        okText="确认发出"
        cancelText="取消"
        width={MODAL_CONFIG.SMALL_WIDTH}
        destroyOnHidden
        okButtonProps={{ disabled: dispatchModalLoading || dispatchTargetOptions.length === 0 }}
      >
        {dispatchModalLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中…</div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              单号：{dispatchRecord?.sheet_no || '—'}
              {dispatchRecord?.mold_code ? ` · 模具 ${dispatchRecord.mold_code}` : ''}
              {dispatchRecord?.supplier_name ? ` · ${dispatchRecord.supplier_name}` : ''}
            </Typography.Text>
            {dispatchTargetOptions.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="该供应商暂无外部模具仓库"
                description="请先在「模具仓库」中维护该供应商的外部仓，或使用表单内「新建模具仓库」。"
              />
            ) : null}
            <Form layout="vertical">
              <Form.Item label="发出仓库（模具当前所在）">
                <Input readOnly value={dispatchFromLabel} />
              </Form.Item>
              <Form.Item label="接收仓库" required>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择供应商外部仓库"
                  options={dispatchTargetOptions}
                  value={dispatchTargetWhId}
                  onChange={(v) => setDispatchTargetWhId(v)}
                />
              </Form.Item>
            </Form>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              确认后将模具台账「所在仓库」调整为接收仓库，处理方式变为「已发出」。
            </Typography.Text>
          </Space>
        )}
      </Modal>

      <Modal
        title="试模单确认收回"
        open={recallModalOpen}
        onCancel={() => setRecallModalOpen(false)}
        width={MODAL_CONFIG.SMALL_WIDTH}
        destroyOnHidden
        footer={[
          <Button
            {...rowActionKind('revoke')}
            key="cancel"
            onClick={() => setRecallModalOpen(false)}
            disabled={recallSubmitting}
          >
            取消
          </Button>,
          <Button
            {...rowActionKind('recall')}
            key="recall"
            type="primary"
            loading={recallSubmitting}
            disabled={recallModalLoading || recallTargetOptions.length === 0}
            onClick={() => void handleRecallConfirm()}
          >
            确认收回
          </Button>,
        ]}
      >
        {recallModalLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中…</div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              单号：{recallRecord?.sheet_no || '—'}
              {recallRecord?.mold_code ? ` · 模具 ${recallRecord.mold_code}` : ''}
            </Typography.Text>
            <Form layout="vertical">
              <Form.Item label={recallFromWarehouseLabel(recallRecord)}>
                <Input readOnly value={recallFromLabel} />
              </Form.Item>
              <Form.Item label="收回目标仓库（厂内）" required>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="默认带出发出前仓库，可改选"
                  options={recallTargetOptions}
                  value={recallTargetWhId}
                  onChange={(v) => setRecallTargetWhId(v)}
                />
              </Form.Item>
            </Form>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              外协已确认调整完成后，模具到厂时选择厂内目标仓库并确认收回；本单变为「已收回」并结束。
            </Typography.Text>
          </Space>
        )}
      </Modal>

      <Modal
        title="试模单 · ERP 数据集"
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={640}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setBindingModalOpen(false)}>
            取消
          </Button>,
          <Button {...rowActionKind('skip')} key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
            保存
          </Button>,
        ]}
      >
        <Form<MoldTrialDatasetBindingPayload & { test_po?: string }> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label="数据集">
            <Select
              allowClear
              showSearch
              placeholder="选模具采购单相关 SQL 数据集"
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  purchase_order_column: undefined,
                  supplier_column: undefined,
                  mold_code_column: undefined,
                  mold_name_column: undefined,
                });
                setBindingColumnOptions([]);
              }}
            />
          </Form.Item>
          <div style={{ marginBottom: 16 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              loading={bindingColumnsLoading}
              disabled={!bindingDatasetUuidWatched}
              onClick={() => {
                const u = bindingDatasetUuidWatched as string | undefined;
                void loadBindingDatasetColumns(typeof u === 'string' ? u : undefined, { silent: false });
              }}
            >
              加载列名（执行一次无参查询）
            </Button>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="purchase_order_column"
                label="订单号列"
                rules={[{ required: true, message: '请填写' }]}
                extra="从下拉选列名，或与 SQL 结果别名一致"
              >
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_column" label="供应商列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_code_column" label="模具代号列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_name_column" label="模具名称列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="order_param_key"
            label="订单号参数（选填）"
            extra="与 SQL 里 :os_no 的 os_no 一致；不填则不在输入框失焦时查库"
          >
            <Input placeholder="如 os_no" allowClear />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="test_po" label="试一条订单号" style={{ marginBottom: 0, minWidth: 200 }}>
              <Input placeholder="输入订单号" />
            </Form.Item>
            <Button style={{ marginTop: 30 }} onClick={() => void handleBindingTestQuery()} loading={bindingModalBusy}>
              测试
            </Button>
          </Space>
          {bindingTestResult ? (
            <Alert type="info" title={bindingTestResult} style={{ marginTop: 12 }} />
          ) : null}
        </Form>
      </Modal>

      <Modal
        title="从模具采购单创建试模单"
        open={poPickerOpen}
        onCancel={() => {
          setPoPickerOpen(false);
          setPoPickerSelectedKeys([]);
          setPoPickerSelectedRow(null);
          setPoPickerKw('');
        }}
        width={960}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')}
            key="cancel"
            onClick={() => {
              setPoPickerOpen(false);
              setPoPickerSelectedKeys([]);
              setPoPickerSelectedRow(null);
              setPoPickerKw('');
            }}
          >
            取消
          </Button>,
          <Button {...rowActionKind('skip')} key="ok" type="primary" onClick={() => void handlePoPickerConfirm()}>
            使用该采购单
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          点选一行后点「使用该采购单」，会打开新建试模单并预填订单号与模具信息。本系统已有试模单的采购订单号旁显示试模次数（按试模单条数统计）。
        </p>
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={poPickerTrialFilter}
              onChange={(e) => setPoPickerTrialFilter(e.target.value as PoPickerTrialFilter)}
              options={[
                { label: '全部', value: 'all' },
                { label: '待试模', value: 'pending' },
                { label: '已试模', value: 'trialed' },
              ]}
            />
            <Input
              placeholder="筛选采购订单号/供应商/模具代号/名称"
              value={poPickerKw}
              onChange={(e) => setPoPickerKw(e.target.value)}
              allowClear
              style={{ width: 300, maxWidth: '100%' }}
            />
          </Space>
          <Table
          size="small"
          loading={poPickerLoading}
          rowKey={getPoPickerRowKey}
          dataSource={poPickerFilteredRows}
          columns={poPickerColumns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 720 }}
          locale={{
            emptyText: poPickerKw.trim() ? '无匹配采购单，请调整筛选条件' : '暂无采购单数据',
          }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: poPickerSelectedKeys,
            onChange: (keys, rows) => {
              setPoPickerSelectedKeys(keys);
              setPoPickerSelectedRow((rows[0] as Record<string, unknown>) ?? null);
            },
          }}
        />
        </Space>
      </Modal>

      <Modal
        title="从待启用模具创建试模单"
        open={moldPickerOpen}
        onCancel={() => setMoldPickerOpen(false)}
        width={960}
        footer={null}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          选择状态为「待启用」的模具，将自动带出台账中的购买厂商、所在仓库等信息。仍有未完结试模流程（含送修处理中）的模具不可选用。
        </p>
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="筛选模具代号/名称" value={moldKw} onChange={(e) => setMoldKw(e.target.value)} allowClear />
          <Table<MoldRow>
            size="small"
            rowKey="id"
            loading={moldPickerLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={filteredPendingMolds}
            locale={{ emptyText: '暂无待启用模具' }}
            onRow={(record) => {
              const blocked = isMoldBlockedForNewTrial(record.mold_code);
              return {
                onClick: () => {
                  if (blocked) {
                    messageApi.error(
                      trialBlockedMessage(record.mold_code, trialBlockedByMoldCode.get(record.mold_code.trim())),
                    );
                    return;
                  }
                  void handleUsePendingMold(record);
                },
                style: { cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.55 : 1 },
              };
            }}
            columns={[
              { title: '模具代号', dataIndex: 'mold_code', width: 120 },
              { title: '模具名称', dataIndex: 'name', ellipsis: true, width: 140 },
              {
                title: '购买厂商',
                dataIndex: 'purchase_vendor_name',
                width: 120,
                ellipsis: true,
                render: (_, r) => ledgerSupplierName(r) || '—',
              },
              {
                title: '所在仓库',
                dataIndex: 'mold_warehouse_name',
                width: 120,
                ellipsis: true,
                render: (_, r) => ledgerWarehouseName(r) || '—',
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 96,
                render: (_, r) => {
                  if (isMoldBlockedForNewTrial(r.mold_code)) {
                    return <Tag color="warning">送修中</Tag>;
                  }
                  const st = (r.status || '').trim();
                  return st ? <Tag>{st}</Tag> : '—';
                },
              },
              {
                title: '操作',
                key: 'op',
                width: 120,
                render: (_, r) => {
                  const blocked = isMoldBlockedForNewTrial(r.mold_code);
                  const sn = trialBlockedByMoldCode.get(r.mold_code.trim());
                  if (blocked) {
                    return (
                      <Tooltip title={trialBlockedMessage(r.mold_code, sn)}>
                        <Typography.Text type="secondary">不可选用</Typography.Text>
                      </Tooltip>
                    );
                  }
                  return <Typography.Link>选用</Typography.Link>;
                },
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
};

export default MoldTrialSheetsPage;
