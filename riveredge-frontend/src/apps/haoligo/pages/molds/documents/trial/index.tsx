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
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  RollbackOutlined,
  SendOutlined,
  CodeSandboxOutlined,
  PlusOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateHaoligoMoldLedgerTableCache } from '../../../../utils/moldLedgerTableCache';
import { UniUserIdSelect, type UniUserIdSelectPreset } from '../../../../../../components/uni-user-id-select';
import { useGlobalStore } from '../../../../../../stores';
import { formatUserDisplayLabel, searchUserIdOptions } from '../../../../../../utils/userDisplay';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { uploadFile } from '../../../../../../services/file';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { supplierApi, unwrapSupplyPagedList } from '../../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../../apps/master-data/types/supply-chain';
import {
  approveMoldTrialSheet,
  createMoldWarehouse,
  createMoldTrialSheet,
  deleteMoldTrialSheet,
  getMoldTrialDatasetBinding,
  getMoldTrialSheet,
  getNextMoldTrialTimes,
  previewTrialRepairNotifyUsers,
  previewTrialSupplierNotifyUsers,
  listMoldTrialSheets,
  listMoldWarehouses,
  listMolds,
  putMoldTrialDatasetBinding,
  rejectMoldTrialSheet,
  dispatchMoldTrialSheet,
  recallMoldTrialSheet,
  recallMoldTrialSheetAndRetrial,
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
import { renderRowActionsOverflow } from '../../../../../../components/uni-action';
import { canAuditMoldSheet } from '../../../../utils/moldSheetStatus';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { isMoldSheetApproved, moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { hasPermission } from '../../../../../../utils/permission';
import { buildPermissionCode } from '../../../../../../utils/permissionResource';

const HAOLIGO_TRIAL_RESOURCE = 'haoligo:molds-documents-trial';

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};
import { executeDatasetQuery, getDatasetList } from '../../../../../../services/dataset';

const trialResultEnum: Record<string, { text: string }> = {
  合格: { text: '合格' },
  不合格: { text: '不合格' },
};

type PoPickerTrialFilter = 'all' | 'pending' | 'trialed';

/** 分页拉取当前租户已有试模单的采购订单号（用于采购单选择器标记） */
async function fetchAllTrialPurchaseOrderNosForPoPicker(): Promise<string[]> {
  const limit = 200;
  let skip = 0;
  const set = new Set<string>();
  for (;;) {
    const res = await listMoldTrialSheets({ skip, limit });
    const total = typeof res.total === 'number' ? res.total : 0;
    for (const row of res.items) {
      const n = String(row.purchase_order_no ?? '').trim();
      if (n) set.add(n);
    }
    skip += res.items.length;
    if (res.items.length === 0 || res.items.length < limit || skip >= total) break;
  }
  return [...set];
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
const TRIAL_FAILURE_RECALLED = '已收回';

function renderFailureHandlingCell(value: string | null | undefined): React.ReactNode {
  const s = (value || '').trim();
  if (!s) return '—';
  const color =
    s === TRIAL_FAILURE_DISPATCHED
      ? 'processing'
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

function canDispatchTrialSheet(record: MoldTrialSheetRow): boolean {
  return (
    record.trial_result === '不合格' &&
    (record.failure_handling || '').trim() === TRIAL_FAILURE_PENDING &&
    isMoldSheetApproved(record.sheet_status)
  );
}

function canRecallTrialSheet(record: MoldTrialSheetRow): boolean {
  const fh = (record.failure_handling || '').trim();
  return (
    record.trial_result === '不合格' &&
    (fh === TRIAL_FAILURE_DISPATCHED || fh === TRIAL_FAILURE_REPAIR) &&
    isMoldSheetApproved(record.sheet_status)
  );
}

function recallFromWarehouseLabel(record: MoldTrialSheetRow | null): string {
  if (!record) return '当前所在仓库（供应商侧）';
  return (record.failure_handling || '').trim() === TRIAL_FAILURE_REPAIR
    ? '送修仓库（当前所在，供应商侧）'
    : '发出仓库（当前所在，供应商侧）';
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

const TrialRepairNotifyHint: React.FC<{
  supplierName?: string;
  trialUserId?: number | null;
}> = ({ supplierName, trialUserId }) => {
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
        保存后将向试模人员及供应商绑定用户发送站内信（请填写供应商或试模人员以预览）
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
  const [loading, setLoading] = useState(false);

  const [seedMc, seedPo] = (initialKey ?? '').split('|');

  useEffect(() => {
    if (!active) {
      setTrialTimes(null);
      setLoading(false);
      return;
    }
    const mc = String(moldCodeWatched ?? form?.getFieldValue?.('mold_code') ?? seedMc ?? '').trim();
    const po = String(
      purchaseOrderNoWatched ?? form?.getFieldValue?.('purchase_order_no') ?? seedPo ?? '',
    ).trim();
    if (!mc && !po) {
      setTrialTimes(null);
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
        if (!cancelled) setTrialTimes(res.trial_times);
      })
      .catch(() => {
        if (!cancelled) setTrialTimes(null);
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
                color: token.colorPrimary,
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
  );
};

const MoldTrialSheetsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const [poPickerLoading, setPoPickerLoading] = useState(false);
  /** 已有试模单的采购订单号（与弹窗内 ERP 行比对） */
  const [existingTrialPoNos, setExistingTrialPoNos] = useState<string[]>([]);
  const [poPickerRows, setPoPickerRows] = useState<Record<string, unknown>[]>([]);
  const [poPickerSelectedKeys, setPoPickerSelectedKeys] = useState<React.Key[]>([]);
  const [poPickerSelectedRow, setPoPickerSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [poPickerTrialFilter, setPoPickerTrialFilter] = useState<PoPickerTrialFilter>('all');

  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldPickerLoading, setMoldPickerLoading] = useState(false);
  const [moldKw, setMoldKw] = useState('');
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  /** 从待启用模具创建时跳过采购订单号必填 */
  const [skipPurchaseOrder, setSkipPurchaseOrder] = useState(false);
  const canReadMoldLedger = useMemo(
    () => hasPermission(currentUser, buildPermissionCode('haoligo:molds-ledger', 'read')),
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
    setPoPickerOpen(true);
  }, [canCreateFromPo, messageApi]);

  useEffect(() => {
    if (!poPickerOpen || !datasetBinding) return;
    let cancelled = false;
    (async () => {
      setPoPickerLoading(true);
      setPoPickerRows([]);
      setExistingTrialPoNos([]);
      setPoPickerTrialFilter('all');
      try {
        const uuid = String(datasetBinding.dataset_uuid || '').trim();
        const [res, trialNos] = await Promise.all([
          executeDatasetQuery(uuid, { parameters: {}, limit: 2000, offset: 0 }),
          fetchAllTrialPurchaseOrderNosForPoPicker(),
        ]);
        if (cancelled) return;
        if (!res.success) {
          messageApi.error(res.error || '加载模具采购单列表失败');
          return;
        }
        setPoPickerRows((res.data ?? []) as Record<string, unknown>[]);
        setExistingTrialPoNos(trialNos);
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
    setTrialUserPresets(buildTrialUserPresets());
    setFormInitialValues({
      purchase_order_no,
      supplier_name: pick(supK),
      mold_code: pick(codeK),
      mold_name: pick(nameK),
      trial_user_id: getDefaultTrialUserId(),
      trial_result: '合格',
      failure_handling: undefined,
      pending_notify_user_ids: [],
      repair_warehouse_id: undefined,
      sync_mold_status: true,
      result_attachments: [],
      inspection_attachments: [],
    });
    setModalVisible(true);
    setPoPickerSelectedKeys([]);
    setPoPickerSelectedRow(null);
  }, [datasetBinding, poPickerSelectedRow, messageApi]);

  const loadPendingEnableMolds = useCallback(async () => {
    setMoldPickerLoading(true);
    try {
      const res = await listMolds({ limit: 200, skip: 0, status: '待启用' });
      setMoldRows(res.items ?? []);
    } catch {
      setMoldRows([]);
      messageApi.error('加载待启用模具失败');
    } finally {
      setMoldPickerLoading(false);
    }
  }, [messageApi]);

  const handleOpenMoldPicker = useCallback(() => {
    setMoldKw('');
    setMoldPickerOpen(true);
    void loadPendingEnableMolds();
  }, [loadPendingEnableMolds]);

  const searchPendingNotifyUsers = useCallback(
    async (keyword?: string) => {
      const selIds = (formRef.current?.getFieldValue('pending_notify_user_ids') as number[] | undefined) || [];
      const opts = await searchUserIdOptions({
        keyword,
        pageSize: 50,
        selectedIds: selIds,
        labelById: pendingNotifyLabelRef,
        currentUser,
      });
      for (const o of opts) {
        pendingNotifyLabelRef.set(o.value, o.label);
      }
      return opts;
    },
    [currentUser, pendingNotifyLabelRef],
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
        const opts = await searchUserIdOptions({
          pageSize: 50,
          selectedIds: ids,
          labelById: pendingNotifyLabelRef,
          currentUser,
        });
        for (const o of opts) {
          pendingNotifyLabelRef.set(o.value, o.label);
        }
        formRef.current?.setFieldsValue({ pending_notify_user_ids: ids });
      } catch {
        /* 记忆查询失败不阻断填单 */
      }
    },
    [currentUser, isDetailView, isEdit, pendingNotifyLabelRef],
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
      messageApi.success('已收回');
      setRecallModalOpen(false);
      bumpMoldLedgerTableCache();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '收回失败');
    } finally {
      setRecallSubmitting(false);
    }
  }, [recallRecord, recallTargetWhId, messageApi, bumpMoldLedgerTableCache]);

  const applyDefaultRepairWarehouseForSupplier = useCallback(
    (supplierName: string) => {
      if (isEdit || isDetailView) return;
      if (formRef.current?.getFieldValue('trial_result') !== '不合格') return;
      if (formRef.current?.getFieldValue('failure_handling') !== TRIAL_FAILURE_REPAIR) return;
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
    (row: MoldRow) => {
      setIsDetailView(false);
      setIsEdit(false);
      setEditId(null);
      setSkipPurchaseOrder(true);
      setTrialUserPresets(buildTrialUserPresets());
      setFormInitialValues({
        purchase_order_no: undefined,
        supplier_name: ledgerSupplierName(row),
        mold_code: row.mold_code,
        mold_name: row.name,
        mold_warehouse_id: row.mold_warehouse_id ?? undefined,
        trial_user_id: getDefaultTrialUserId(),
        trial_result: '合格',
        failure_handling: undefined,
        pending_notify_user_ids: [],
        repair_warehouse_id: undefined,
        sync_mold_status: true,
        result_attachments: [],
        inspection_attachments: [],
      });
      setMoldPickerOpen(false);
      setModalVisible(true);
      messageApi.success(`已选择模具 ${row.mold_code}`);
    },
    [messageApi],
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

  const createToolbarActions = useMemo(
    () => [
      <Tooltip
        key="from-po-tip"
        title={
          canCreateFromPo
            ? '从当前数据集拉列表，选一行带出订单与模具信息'
            : '请完成「数据集」配置：一个数据集 + 四个列名'
        }
      >
        <span>
          <Button
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
      <Button key="from-pending-mold" icon={<CodeSandboxOutlined />} onClick={handleOpenMoldPicker}>
        从待启用模具创建
      </Button>,
    ],
    [canCreateFromPo, handleOpenPoFromErp, handleOpenMoldPicker],
  );

  const poPickerFilteredRows = useMemo(() => {
    const b = datasetBinding;
    const poCol = b?.purchase_order_column?.trim();
    if (!poCol) return poPickerRows;
    const trialPoSet = new Set(existingTrialPoNos.map((s) => s.trim()).filter(Boolean));
    if (poPickerTrialFilter === 'all') return poPickerRows;
    return poPickerRows.filter((row) => {
      const no = String(row[poCol] ?? '').trim();
      const hasTrial = Boolean(no && trialPoSet.has(no));
      if (poPickerTrialFilter === 'pending') return !hasTrial;
      return hasTrial;
    });
  }, [poPickerRows, datasetBinding, existingTrialPoNos, poPickerTrialFilter]);

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
    const trialPoSet = new Set(existingTrialPoNos.map((s) => s.trim()).filter(Boolean));
    return [
      {
        title: '采购订单号',
        dataIndex: po,
        key: 'po',
        ellipsis: true,
        width: 240,
        render: (_: unknown, row: Record<string, unknown>) => {
          const no = String(row[po] ?? '').trim();
          const hasTrial = no && trialPoSet.has(no);
          return (
            <Space size={6} wrap>
              <span>{no || '—'}</span>
              {hasTrial ? (
                <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                  已建试模单
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
  }, [datasetBinding, existingTrialPoNos]);

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
    if (!modalVisible || isEdit || isDetailView || warehouseRows.length === 0) return;
    if (formRef.current?.getFieldValue('trial_result') !== '不合格') return;
    if (formRef.current?.getFieldValue('failure_handling') !== TRIAL_FAILURE_REPAIR) return;
    const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
    if (!sn) return;
    if (parseMoldWarehouseIdForForm(formRef.current?.getFieldValue('repair_warehouse_id')) != null) return;
    applyDefaultRepairWarehouseForSupplier(sn);
  }, [
    applyDefaultRepairWarehouseForSupplier,
    isDetailView,
    isEdit,
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
      setTrialUserPresets(buildTrialUserPresets(detail));
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
        trial_times: detail.trial_times ?? undefined,
        result_attachments: await uuidsToSecureUploadFileList(detail.result_attachment_file_uuids),
        inspection_attachments: await uuidsToSecureUploadFileList(detail.inspection_attachment_file_uuids),
        trial_result: detail.trial_result,
        failure_handling: detail.failure_handling ?? undefined,
        pending_notify_user_ids: detail.pending_notify_user_ids ?? [],
        repair_warehouse_id: detail.repair_warehouse_id ?? undefined,
        sync_mold_status: true,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载试模单失败');
    }
  };

  const handleEdit = (record: MoldTrialSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldTrialSheetRow) => void openSheetForm(record, true);

  const handleRecallAndRetrial = async () => {
    if (!recallRecord) return;
    if (recallTargetWhId == null || recallTargetWhId < 1) {
      messageApi.warning('请选择收回目标仓库');
      return;
    }
    setRecallSubmitting(true);
    try {
      const res = await recallMoldTrialSheetAndRetrial(recallRecord.id, {
        target_warehouse_id: recallTargetWhId,
      });
      setRecallModalOpen(false);
      bumpMoldLedgerTableCache();
      actionRef.current?.reload();
      messageApi.success(
        `原单已标记「已收回」；已生成第 ${res.new_sheet.trial_times ?? ''} 次试模单 ${res.new_sheet.sheet_no || ''}，请填写试模结果后保存`,
      );
      await openSheetForm(res.new_sheet, false);
    } catch (e) {
      messageApi.error((e as Error).message || '收回并重新试模失败');
    } finally {
      setRecallSubmitting(false);
    }
  };

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

  const buildPayload = (values: Record<string, unknown>): MoldTrialSheetCreatePayload => {
    const trialResult = values.trial_result === '不合格' ? '不合格' : '合格';
    const base: MoldTrialSheetCreatePayload = {
      purchase_order_no: (() => {
        const s = String(values.purchase_order_no ?? '').trim();
        return s || null;
      })(),
      supplier_name: String(values.supplier_name ?? '').trim() || null,
      mold_code: String(values.mold_code ?? '').trim() || null,
      mold_name: String(values.mold_name ?? '').trim() || null,
      result_attachment_file_uuids: normUploadUuids(values.result_attachments),
      inspection_attachment_file_uuids: normUploadUuids(values.inspection_attachments),
      trial_result: trialResult,
      trial_user_id: (() => {
        const v = values.trial_user_id;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
      })(),
    };
    if (trialResult !== '不合格') {
      return {
        ...base,
        failure_handling: null,
        pending_notify_user_ids: [],
        repair_warehouse_id: null,
      };
    }
    const mode = String(values.failure_handling ?? '').trim();
    return {
      ...base,
      failure_handling: mode === TRIAL_FAILURE_REPAIR ? TRIAL_FAILURE_REPAIR : TRIAL_FAILURE_PENDING,
      pending_notify_user_ids:
        mode === TRIAL_FAILURE_PENDING ? parsePendingNotifyUserIds(values.pending_notify_user_ids) : [],
      repair_warehouse_id:
        mode === TRIAL_FAILURE_REPAIR ? parseMoldWarehouseIdForForm(values.repair_warehouse_id) ?? undefined : null,
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
    const trialUserRaw = values.trial_user_id;
    const trialUserId =
      typeof trialUserRaw === 'number' ? trialUserRaw : Number(trialUserRaw);
    if (!Number.isFinite(trialUserId) || trialUserId <= 0) {
      messageApi.warning('请选择试模人员');
      throw new Error('validation');
    }
    if (values.trial_result === '不合格') {
      const mode = String(values.failure_handling ?? '').trim();
      if (!mode) {
        messageApi.warning('试模不合格时请选择处理方式');
        throw new Error('validation');
      }
      if (mode === TRIAL_FAILURE_PENDING) {
        const notifyIds = parsePendingNotifyUserIds(values.pending_notify_user_ids);
        if (notifyIds.length === 0) {
          messageApi.warning('待处理时请至少指定一名消息提醒接收人');
          throw new Error('validation');
        }
      }
      if (mode === TRIAL_FAILURE_REPAIR) {
        const whId = parseMoldWarehouseIdForForm(values.repair_warehouse_id);
        if (whId == null) {
          messageApi.warning('立即送修请选择送修仓库');
          throw new Error('validation');
        }
      }
    }
    setFormLoading(true);
    try {
      const payload = buildPayload(values);
      if (isEdit && editId != null) {
        await updateMoldTrialSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldTrialSheet(payload);
        messageApi.success('已创建');
      }

      if (payload.mold_code) {
        try {
          const target = await findMoldByCode(payload.mold_code);
          if (target) {
            const ledgerPatch: { mold_warehouse_id?: number | null; status?: string } = {
              mold_warehouse_id: parseMoldWarehouseIdForForm(values.mold_warehouse_id),
            };
            if (payload.trial_result === '合格' && values.sync_mold_status) {
              ledgerPatch.status = '待用';
            }
            await updateMold(target.id, ledgerPatch);
            const hints: string[] = [];
            if (ledgerPatch.status) hints.push('模具状态已更新为「待用」');
            if ('mold_warehouse_id' in ledgerPatch) hints.push('所在仓库已同步至台账');
            if (hints.length) messageApi.success(hints.join('；'));
          } else {
            messageApi.warning('未找到对应模具代号，无法同步台账');
          }
        } catch {
          messageApi.warning('同步模具台账失败');
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
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_no',
      key: 'purchase_order_no',
      width: 160,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
      render: (_, r) => r.purchase_order_no?.trim() || '—',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具代号',
      dataIndex: 'mold_code',
      key: 'mold_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具名称',
      dataIndex: 'mold_name',
      key: 'mold_name',
      width: 160,
      ellipsis: true,
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
      render: (_, r) =>
        r.trial_result === '不合格' ? renderFailureHandlingCell(r.failure_handling) : '—',
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
      width: 360,
      fixed: 'right',
      uniActionRenderOptions: { ...MOLD_SHEET_TABLE_ACTION_OPTIONS, directMax: 8 },
      render: (_, record) => {
        const approved = isMoldSheetApproved(record.sheet_status);
        const canUpdateTrial = hasPermission(currentUser, buildPermissionCode(HAOLIGO_TRIAL_RESOURCE, 'update'));
        const auditHandlers = {
          onApprove: () => approveMoldTrialSheet(record.id),
          onReject: () => rejectMoldTrialSheet(record.id),
          onRevoke: () => revokeMoldTrialSheetApproval(record.id),
        };
        const actions: React.ReactNode[] = [
          <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>,
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={approved}
            onClick={() => void handleEdit(record)}
          >
            编辑
          </Button>,
          <Button
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
          ...buildMoldSheetAuditActionElements({
            canAudit: canAuditMoldSheet(currentUser, HAOLIGO_TRIAL_RESOURCE),
            sheetStatus: record.sheet_status,
            handlers: auditHandlers,
            messageApi,
            reload: () => actionRef.current?.reload(),
            revokeOnly: isTrialSheetHandlingClosed(record),
          }),
        ];
        if (canUpdateTrial && canDispatchTrialSheet(record)) {
          actions.push(
            <Button
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
        if (canUpdateTrial && canRecallTrialSheet(record)) {
          actions.push(
            <Button
              key="recall"
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => void openRecallModal(record)}
            >
              收回
            </Button>,
          );
        }
        return renderRowActionsOverflow(actions, `trial-${record.id}`, MOLD_SHEET_TABLE_ACTION_OPTIONS);
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
          <Col span={12}>
            <ProFormSelect
              name="mold_warehouse_id"
              label="所在仓库"
              placeholder="请选择模具仓库"
              allowClear
              showSearch
              options={warehouseOptions}
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormUploadButton
              name="result_attachments"
              label="试模结果附件"
              max={10}
              fieldProps={uploadFieldProps}
            />
          </Col>
          <Col span={12}>
            <ProFormUploadButton
              name="inspection_attachments"
              label="试模检验附件"
              max={10}
              fieldProps={uploadFieldProps}
            />
          </Col>
          <Col span={6}>
            <UniUserIdSelect
              name="trial_user_id"
              label="试模人员"
              placeholder="请选择试模人员"
              required
              readonly={isDetailView}
              disabled={isDetailView}
              presetUsers={trialUserPresets}
            />
          </Col>
          <Col span={6}>
            <ProFormRadio.Group
              name="trial_result"
              label="试模结果"
              rules={[{ required: true, message: '请选择试模结果' }]}
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
                    });
                    return;
                  }
                  if (v === '不合格') {
                    const mc = String(formRef.current?.getFieldValue('mold_code') ?? '').trim();
                    if (mc) void applyPendingNotifyMemoryForMoldCode(mc);
                    if (formRef.current?.getFieldValue('failure_handling') === TRIAL_FAILURE_REPAIR) {
                      const sn = String(formRef.current?.getFieldValue('supplier_name') ?? '').trim();
                      applyDefaultRepairWarehouseForSupplier(sn);
                    }
                  }
                },
              }}
            />
          </Col>
          <ProFormDependency name={['trial_result']}>
            {({ trial_result }) => {
              if (trial_result !== '合格' || isDetailView) return null;
              return (
                <Col span={6}>
                  <ProFormRadio.Group
                    name="sync_mold_status"
                    label="模具状态"
                    tooltip="保存成功后，按模具代号匹配台账"
                    options={[
                      { label: '待用', value: true },
                      { label: '不变', value: false },
                    ]}
                  />
                </Col>
              );
            }}
          </ProFormDependency>
          <ProFormDependency name={['trial_result', 'supplier_name', 'failure_handling', 'trial_user_id']}>
            {({ trial_result, supplier_name, failure_handling, trial_user_id }) => {
              if (trial_result !== '不合格') return null;
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
                    <>
                      <Col span={12}>
                        <ProFormSelect
                          name="pending_notify_user_ids"
                          label="消息提醒人员"
                          mode="multiple"
                          showSearch
                          debounceTime={300}
                          rules={[{ required: true, message: '请至少选择一名提醒接收人' }]}
                          request={async ({ keyWords }) => searchPendingNotifyUsers(keyWords)}
                          options={pendingNotifyPresetOptions}
                          fieldProps={{
                            style: { width: '100%' },
                            placeholder: '搜索并选择接收站内信的人员',
                            filterOption: false,
                          }}
                        />
                      </Col>
                      <Col span={24}>
                        <TrialSupplierCcHint
                          supplierName={
                            typeof supplier_name === 'string' ? supplier_name : String(supplier_name ?? '')
                          }
                        />
                      </Col>
                    </>
                  ) : null}
                  {failure_handling === TRIAL_FAILURE_REPAIR ? (
                    <>
                      <Col span={12}>
                        <ProFormSelect
                          name="repair_warehouse_id"
                          label="送修仓库"
                          showSearch
                          allowClear={false}
                          rules={[{ required: true, message: '请选择送修仓库' }]}
                          options={repairOptions}
                          placeholder={
                            repairOptions.length > 0
                              ? '已带出供应商外部模具仓库，可改选'
                              : '该供应商暂无外部模具仓库'
                          }
                          extra="保存后将把模具台账「所在仓库」转移至所选外部仓库"
                          fieldProps={{ optionFilterProp: 'label' }}
                        />
                      </Col>
                      <Col span={24}>
                        <TrialRepairNotifyHint
                          supplierName={supplierNameStr}
                          trialUserId={
                            typeof trial_user_id === 'number'
                              ? trial_user_id
                              : trial_user_id != null
                                ? Number(trial_user_id)
                                : null
                          }
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
                                onClick={() => openRepairWarehouseQuickCreate(supplierNameStr)}
                              >
                                新建模具仓库
                              </Button>
                            }
                          />
                        </Col>
                      ) : null}
                    </>
                  ) : null}
                </>
              );
            }}
          </ProFormDependency>
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
        destroyOnClose
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
        destroyOnClose
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
        title="试模单收回"
        open={recallModalOpen}
        onCancel={() => setRecallModalOpen(false)}
        width={MODAL_CONFIG.SMALL_WIDTH}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setRecallModalOpen(false)} disabled={recallSubmitting}>
            取消
          </Button>,
          <Button
            key="recall"
            loading={recallSubmitting}
            disabled={recallModalLoading || recallTargetOptions.length === 0}
            onClick={() => void handleRecallConfirm()}
          >
            确认收回
          </Button>,
          <Button
            key="recall-retrial"
            type="primary"
            loading={recallSubmitting}
            disabled={recallModalLoading || recallTargetOptions.length === 0}
            onClick={() => void handleRecallAndRetrial()}
          >
            收回并重新试模
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
              收回后本单处理方式变为「已收回」并结束；「收回并重新试模」会另生成下一次试模单（如第 2 次试模）供后续发出/收回。
            </Typography.Text>
          </Space>
        )}
      </Modal>

      <Modal
        title="试模单 · ERP 数据集"
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={640}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setBindingModalOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
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
            <Alert type="info" message={bindingTestResult} style={{ marginTop: 12 }} />
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
        }}
        width={960}
        destroyOnClose
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setPoPickerOpen(false);
              setPoPickerSelectedKeys([]);
              setPoPickerSelectedRow(null);
            }}
          >
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => void handlePoPickerConfirm()}>
            使用该采购单
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          点选一行后点「使用该采购单」，会打开新建试模单并预填订单号与模具信息。已在本系统建过试模单的采购单号旁会显示「已建试模单」。
        </p>
        <div style={{ marginBottom: 12 }}>
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
        </div>
        <Table
          size="small"
          loading={poPickerLoading}
          rowKey={getPoPickerRowKey}
          dataSource={poPickerFilteredRows}
          columns={poPickerColumns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 720 }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: poPickerSelectedKeys,
            onChange: (keys, rows) => {
              setPoPickerSelectedKeys(keys);
              setPoPickerSelectedRow((rows[0] as Record<string, unknown>) ?? null);
            },
          }}
        />
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
          选择状态为「待启用」的模具，将自动带出台账中的购买厂商、所在仓库等信息。
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
              { title: '状态', dataIndex: 'status', width: 88 },
              {
                title: '操作',
                key: 'op',
                width: 88,
                render: (_, r) => (
                  <Button type="link" size="small" onClick={() => handleUsePendingMold(r)}>
                    选用
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
};

export default MoldTrialSheetsPage;
