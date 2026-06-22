/**
 * 好力 GO — 模具台账
 *
 * 列表页模板对齐快制造模具页：ListPageTemplate + UniTable + FormModalTemplate。
 * 表单字段对齐产品「新增」模具台账弹窗。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  HAOLIGO_MOLD_LEDGER_TANSTACK_QUERY,
  useHaoligoMoldLedgerTableLiveRefresh,
} from '../../../utils/moldLedgerTableCache';
import {
  DetailDrawerSection,
  DRAWER_CONFIG,
  flushDrawerOpen,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  PAGE_SPACING,
} from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  batchMoldsLifecycle,
  createMold,
  deleteMold,
  getMold,
  getMoldLedgerDatasetBinding,
  listMoldOperationRecords,
  listMoldUpkeepParamSets,
  listMoldWarehouses,
  listMolds,
  putMoldLedgerDatasetBinding,
  syncMoldLedgerFromDataset,
  updateMold,
  type MoldBatchLifecyclePayload,
  type MoldBatchLifecycleScope,
  type MoldCreatePayload,
  type MoldLedgerDatasetBindingPayload,
  type MoldOperationRecordRow,
  type MoldRow,
  type MoldUpkeepParamSetRow,
  type MoldWarehouseRow,
  type MoldUpdatePayload,
} from '../../../services/haoligo';
import { executeDatasetQuery, getDatasetList } from '../../../../../services/dataset';
import { supplierApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import type { Supplier } from '../../../../master-data/types/supply-chain';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  MOLD_LEDGER_STATUSES,
  MOLD_LEDGER_STATUS_SET,
  getMoldLedgerStatusTagColor,
} from '../../../constants/moldStatus';
import {
  MOLD_LEDGER_SOURCE_LABELS,
  MOLD_LEDGER_SOURCE_VALUES,
  getMoldLedgerSourceLabel,
  getMoldLedgerSourceTagColor,
} from '../../../constants/moldLedgerSource';
import {
  computeMoldRatedUsableYield,
  moldRatedUsableYieldToPayloadValue,
  resolveUsableYieldPayload,
  shouldAutoFillRatedUsableYield,
} from '../../../utils/moldRatedYield';
import { parseMoldLedgerListSearchFilters } from '../../../utils/moldLedgerListSearch';
import { formatDateTime } from '../../../../../utils/format';

const statusValueEnum = MOLD_LEDGER_STATUSES.reduce<Record<string, { text: string }>>((acc, s) => {
  acc[s] = { text: s };
  return acc;
}, {});

const sourceValueEnum = MOLD_LEDGER_SOURCE_VALUES.reduce<Record<string, { text: string }>>((acc, s) => {
  acc[s] = { text: MOLD_LEDGER_SOURCE_LABELS[s] };
  return acc;
}, {});

function renderMoldLedgerSourceCell(source: string | null | undefined) {
  const label = getMoldLedgerSourceLabel(source);
  const color = getMoldLedgerSourceTagColor(source);
  return color !== undefined ? <Tag color={color}>{label}</Tag> : <Tag>{label}</Tag>;
}

function renderMoldLedgerStatusCell(status: string) {
  const color = getMoldLedgerStatusTagColor(status);
  return color !== undefined ? <Tag color={color}>{status}</Tag> : <Tag>{status}</Tag>;
}

const moldOperationKindColors: Record<MoldOperationRecordRow['kind'], string> = {
  borrow: 'blue',
  return: 'green',
  trial: 'gold',
  maintenance: 'orange',
  maintenance_complete: 'cyan',
  outsource_maintenance: 'purple',
  outsource_maintenance_complete: 'magenta',
};

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function omitMoldLedgerKeys(obj: MoldCreatePayload): Record<string, unknown> {
  const { mold_code: _code, total_manufacture_qty: _qty, ...rest } = obj;
  void _code;
  void _qty;
  return rest as Record<string, unknown>;
}

function toIsoDate(v: unknown): string | null | undefined {
  if (v == null || v === '') return null;
  if (dayjs.isDayjs(v)) return v.format('YYYY-MM-DD');
  const s = String(v).trim();
  return s ? s.slice(0, 10) : null;
}

function parseImportDateCell(v: unknown): string | null {
  const iso = toIsoDate(v);
  return iso ?? null;
}

function formatFactoryEntryAt(v: string | null | undefined): string {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

function parseBoolCell(v: unknown): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (['是', 'true', '1', 'yes', 'y'].includes(s)) return true;
  if (['否', 'false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function parseMoldDecimal(v: string | null | undefined): number {
  if (v == null || v === '') return Number.NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function formatMoldMetricNumber(n: number, fractionDigits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

function formatMoldLedgerInteger(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

function moldIntStrOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(Math.round(n));
}

function moldIntOrUndef(v: unknown): number | undefined {
  const n = numOrUndef(v);
  return n === undefined ? undefined : Math.round(n);
}

/** 剩余占比环形图颜色：与工作台模具寿命预警阈值一致（消耗 ≥95% 红、≥85% 黄、其余绿） */
function moldRemainingRingColor(remainingPct: number, token: ReturnType<typeof theme.useToken>['token']): string {
  if (remainingPct <= 5) return token.colorError;
  if (remainingPct <= 15) return token.colorWarning;
  return token.colorSuccess;
}

function MoldLifecycleMetricCards({ row, loading }: { row: MoldRow; loading: boolean }) {
  const { token } = theme.useToken();

  if (loading) {
    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[0, 1].map((i) => (
          <Col xs={24} md={12} key={i}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillQuaternary }}>
              <div style={{ minHeight: 132, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  const ratedYield = parseMoldDecimal(row.usable_yield);
  const usedYield = parseMoldDecimal(row.used_yield ?? '');
  const pctYieldRemaining =
    !Number.isNaN(ratedYield) && ratedYield > 0 && !Number.isNaN(usedYield)
      ? Math.round((Math.max(0, ratedYield - usedYield) / ratedYield) * 1000) / 10
      : undefined;

  const lifeCap = parseMoldDecimal(row.service_life_years != null ? String(row.service_life_years) : '');
  const totalQty = parseMoldDecimal(row.total_manufacture_qty ?? '');
  const pctLifeRemaining =
    !Number.isNaN(lifeCap) && lifeCap > 0 && !Number.isNaN(totalQty)
      ? Math.round((Math.max(0, lifeCap - totalQty) / lifeCap) * 1000) / 10
      : undefined;

  const ringPlaceholder = (
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        border: `1px dashed ${token.colorBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: token.colorTextQuaternary,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      —
    </div>
  );

  const cardBodyMetric = (
    title: string,
    helpText: string,
    ratedLabel: string,
    usedLabel: string,
    rated: string,
    used: string,
    pct: number | undefined,
  ) => {
    const ringColor = pct != null ? moldRemainingRingColor(pct, token) : undefined;
    return (
      <Card size="small" variant="borderless" style={{ background: token.colorFillQuaternary }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Typography.Text strong>{title}</Typography.Text>
              <Tooltip title={helpText} placement="topLeft" overlayStyle={{ maxWidth: 380 }}>
                <QuestionCircleOutlined
                  aria-label="指标说明"
                  style={{ color: token.colorTextTertiary, cursor: 'help', fontSize: 14 }}
                />
              </Tooltip>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>
                <Typography.Text type="secondary">{ratedLabel}</Typography.Text>
                <Typography.Text style={{ marginLeft: 8 }}>{rated}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">{usedLabel}</Typography.Text>
                <Typography.Text style={{ marginLeft: 8 }}>{used}</Typography.Text>
              </div>
            </div>
          </div>
          {pct != null && ringColor != null ? (
            <Progress
              type="circle"
              percent={Math.min(100, Math.max(0, pct))}
              width={88}
              format={(p) => <span style={{ color: ringColor, fontSize: 14 }}>{p}%</span>}
              strokeColor={ringColor}
            />
          ) : (
            ringPlaceholder
          )}
        </div>
      </Card>
    );
  };

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={12}>
        {cardBodyMetric(
          '额定可用产量 / 保养后制造数量',
          '环形图：剩余产量占比 =（额定可用产量 − 保养后制造数量）÷ 额定可用产量；保养以产量为依据',
          '额定可用产量',
          '保养后制造数量',
          !Number.isNaN(ratedYield) ? formatMoldMetricNumber(ratedYield) : '—',
          !Number.isNaN(usedYield) ? formatMoldMetricNumber(usedYield) : '—',
          pctYieldRemaining,
        )}
      </Col>
      <Col xs={24} md={12}>
        {cardBodyMetric(
          '模具寿命 / 总制造数量',
          '模具寿命为累计产量上限；环形图为剩余寿命占比 =（上限 − 总制造数量）÷ 上限',
          '累计产量上限',
          '总制造数量',
          !Number.isNaN(lifeCap) ? formatMoldMetricNumber(lifeCap) : '—',
          !Number.isNaN(totalQty) ? formatMoldMetricNumber(totalQty, 0) : '—',
          pctLifeRemaining,
        )}
      </Col>
    </Row>
  );
}

/** 批量修改：选择此项表示清空所在仓库 */
const MOLD_WAREHOUSE_BATCH_CLEAR = '__clear_mold_warehouse__';

function parseMoldWarehouseIdForForm(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseMoldWarehouseIdForBatch(value: unknown): number | null | undefined {
  if (value === MOLD_WAREHOUSE_BATCH_CLEAR) return null;
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

function formatMoldWarehouseLabel(row: MoldWarehouseRow): string {
  const name = (row.warehouse_name || '').trim();
  return name || String(row.id);
}

function renderMoldWarehouseCell(row: Pick<MoldRow, 'mold_warehouse_name'>): string {
  const name = (row.mold_warehouse_name || '').trim();
  return name || '—';
}

/** 批量修改弹窗：仅把已填写的项加入 PATCH（留空表示不改动该字段）。 */
function buildMoldLifecycleBatchPatch(values: Record<string, unknown>): MoldBatchLifecyclePayload | null {
  const patch: MoldBatchLifecyclePayload = {};
  const lifeCap = moldIntStrOrUndef(values.service_life_years);
  if (lifeCap !== undefined) patch.service_life_years = lifeCap;
  const t = numOrUndef(values.usable_times);
  if (t !== undefined) patch.usable_times = t;
  const my = moldIntStrOrUndef(values.maintenance_cycle_by_yield);
  if (my !== undefined) patch.maintenance_cycle_by_yield = my;
  const statusRaw = values.status;
  if (statusRaw != null && statusRaw !== '') {
    const status = String(statusRaw).trim();
    if (!MOLD_LEDGER_STATUS_SET.has(status)) {
      throw new Error(`状态无效，须为：${MOLD_LEDGER_STATUSES.join('、')}`);
    }
    patch.status = status;
  }
  if (values.mold_warehouse_id === MOLD_WAREHOUSE_BATCH_CLEAR) {
    patch.mold_warehouse_id = null;
  } else {
    const whId = parseMoldWarehouseIdForBatch(values.mold_warehouse_id);
    if (whId !== undefined) {
      patch.mold_warehouse_id = whId;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

const MoldLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  useHaoligoMoldLedgerTableLiveRefresh(actionRef);
  const formRef = useRef<ProFormInstance>(null);
  /** 上次由产能×次数写入的额定可用产量；与当前值相等时才随产能/次数自动更新 */
  const lastAutoRatedYieldRef = useRef<number | undefined>(undefined);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ value: number; label: string }[]>([]);
  const [upkeepSetOptions, setUpkeepSetOptions] = useState<{ value: number; label: string }[]>([]);
  const [datasetBinding, setDatasetBinding] = useState<MoldLedgerDatasetBindingPayload | null>(null);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingCfgForm] = Form.useForm<MoldLedgerDatasetBindingPayload>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchModalBusy, setBatchModalBusy] = useState(false);
  const [batchForm] = Form.useForm();
  const [syncIntroModalOpen, setSyncIntroModalOpen] = useState(false);
  const [batchScope, setBatchScope] = useState<MoldBatchLifecycleScope>('selected');
  const [listMatchTotal, setListMatchTotal] = useState(0);
  const listSnapshotRef = useRef<{ total: number; keyword?: string; status?: string }>({ total: 0 });
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [moldDetail, setMoldDetail] = useState<MoldRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [moldOperationRecords, setMoldOperationRecords] = useState<MoldOperationRecordRow[]>([]);
  const moldDetailReqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getMoldLedgerDatasetBinding();
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
            messageApi.warning(res.error || '无法加载列名：请确认该 SQL 支持无参数执行');
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
    if (!bindingModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const pageSize = 100;
        for (;;) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          const items = res.items ?? [];
          for (const d of items) {
            options.push({ label: `${d.name} (${d.code})`, value: d.uuid });
          }
          if (items.length < pageSize) break;
          page += 1;
        }
        if (!cancelled) setDatasetSelectOptions(options);
      } catch (e) {
        if (!cancelled) {
          setDatasetSelectOptions([]);
          messageApi.error((e as Error).message || '加载数据集列表失败');
        }
      }
    })();
    bindingCfgForm.resetFields();
    const d = datasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      mold_code_column: d?.mold_code_column ?? undefined,
      mold_name_column: d?.mold_name_column ?? undefined,
      unit_column: d?.unit_column ?? undefined,
      mold_capacity_column: d?.mold_capacity_column ?? undefined,
      factory_entry_at_column: d?.factory_entry_at_column ?? undefined,
    });
    setBindingColumnOptions([]);
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, datasetBinding, bindingCfgForm, messageApi]);

  const handleDatasetConfig = useCallback(() => {
    setBindingModalOpen(true);
  }, []);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putMoldLedgerDatasetBinding({ dataset_uuid: '' });
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
    let v: MoldLedgerDatasetBindingPayload;
    try {
      v = await bindingCfgForm.validateFields();
    } catch {
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putMoldLedgerDatasetBinding({
        dataset_uuid: ds,
        mold_code_column: String(v.mold_code_column ?? '').trim(),
        mold_name_column: String(v.mold_name_column ?? '').trim(),
        unit_column: String(v.unit_column ?? '').trim(),
        mold_capacity_column: String(v.mold_capacity_column ?? '').trim() || undefined,
        factory_entry_at_column: String(v.factory_entry_at_column ?? '').trim() || undefined,
      });
      setDatasetBinding(saved);
      messageApi.success('已保存');
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const canSyncFromDataset = useMemo(() => {
    const b = datasetBinding;
    return Boolean(
      b?.dataset_uuid?.trim() &&
        b.mold_code_column?.trim() &&
        b.mold_name_column?.trim() &&
        b.unit_column?.trim(),
    );
  }, [datasetBinding]);

  const loadSuppliers = useCallback(async (keyword?: string) => {
    try {
      const res = await supplierApi.list({ limit: 100, isActive: true, keyword });
      const list = unwrapSupplyPagedList<Supplier>(res);
      setSupplierOptions(
        list.map((s) => ({
          key: s.uuid,
          value: s.name,
          label: s.code ? `${s.code} · ${s.name}` : s.name,
        })),
      );
    } catch {
      setSupplierOptions([]);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const loadWarehouses = useCallback(async () => {
    try {
      const rows = await listMoldWarehouses();
      setWarehouseOptions(
        rows.map((w) => ({
          value: w.id,
          label: formatMoldWarehouseLabel(w),
        })),
      );
    } catch {
      setWarehouseOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const loadUpkeepSets = useCallback(async () => {
    try {
      const rows = await listMoldUpkeepParamSets();
      setUpkeepSetOptions(
        rows.map((s: MoldUpkeepParamSetRow) => ({
          value: s.id,
          label: `${s.code} · ${s.name}`,
        })),
      );
    } catch {
      setUpkeepSetOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadUpkeepSets();
  }, [loadUpkeepSets]);

  const handleOpenBatchModal = useCallback(() => {
    batchForm.resetFields();
    setBatchScope('selected');
    setBatchModalOpen(true);
  }, [batchForm]);

  /** 关闭说明弹窗后在浏览器内继续等待单次同步请求；非服务端队列任务。 */
  const handleStartDatasetSync = useCallback(() => {
    setSyncIntroModalOpen(false);
    const hideLoading = messageApi.loading(
      '正在从数据集同步… 数据量大时可能需数分钟，请勿关闭或刷新本页直至完成。',
      0,
    );
    void syncMoldLedgerFromDataset()
      .then((r) => {
        hideLoading();
        messageApi.success(
          `同步完成：新增 ${r.created} 条，更新 ${r.updated} 条，跳过 ${r.skipped} 行（无代号）；数据集内记录来源已标记为「同步」`,
        );
        actionRef.current?.reload();
      })
      .catch((e) => {
        hideLoading();
        messageApi.error((e as Error).message || '同步失败');
      });
  }, [messageApi]);

  const handleBatchSubmit = async () => {
    const values = batchForm.getFieldsValue();
    let patch: MoldBatchLifecyclePayload | null;
    try {
      patch = buildMoldLifecycleBatchPatch(values);
    } catch (e) {
      messageApi.error((e as Error).message || '请检查填写内容');
      return;
    }
    if (!patch) {
      messageApi.warning('请至少填写一项要修改的字段');
      return;
    }
    if (batchScope === 'selected') {
      const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n));
      if (ids.length === 0) {
        messageApi.warning('选择「仅已勾选」时请先在表格中勾选至少一行');
        return;
      }
    } else if (listMatchTotal <= 0) {
      messageApi.warning('当前列表无数据，请调整筛选或改用「仅已勾选」');
      return;
    }

    const run = async () => {
      setBatchModalOpen(false);
      setBatchModalBusy(true);
      try {
        const snap = listSnapshotRef.current;
        const r = await batchMoldsLifecycle({
          scope: batchScope,
          ...(batchScope === 'selected'
            ? {
                mold_ids: selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n)),
              }
            : {
                filter_status: snap.status,
                filter_keyword: snap.keyword,
              }),
          ...patch,
        } as MoldBatchLifecyclePayload);
        messageApi.success(`已更新 ${r.updated} 条`);
        if (batchScope === 'selected' && r.updated > 0) {
          setSelectedRowKeys([]);
        }
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error((e as Error).message || '批量更新失败');
      } finally {
        setBatchModalBusy(false);
      }
    };

    if (batchScope === 'all_filtered' && listMatchTotal > 50) {
      await new Promise<void>((resolve) => {
        Modal.confirm({
          title: '确认批量更新',
          content: `将更新当前筛选条件下的全部 ${listMatchTotal} 条模具（与列表底部「共 ${listMatchTotal} 条」汇总一致）。是否继续？`,
          okText: '确认更新',
          cancelText: '取消',
          onOk: async () => {
            await run();
            resolve();
          },
          onCancel: () => resolve(),
        });
      });
      return;
    }
    await run();
  };

  const syncRatedUsableYieldInForm = useCallback((allValues: Record<string, unknown>) => {
    const derived = computeMoldRatedUsableYield(allValues.mold_capacity, allValues.usable_times);
    if (derived === undefined) return;
    if (!shouldAutoFillRatedUsableYield(allValues.usable_yield, lastAutoRatedYieldRef.current)) return;
    formRef.current?.setFieldsValue({ usable_yield: derived });
    lastAutoRatedYieldRef.current = derived;
  }, []);

  const handleMoldFormValuesChange = useCallback(
    (changed: Record<string, unknown>, allValues: Record<string, unknown>) => {
      if ('usable_yield' in changed) return;
      if ('mold_capacity' in changed || 'usable_times' in changed) {
        syncRatedUsableYieldInForm(allValues);
      }
    },
    [syncRatedUsableYieldInForm],
  );

  const handleCreate = () => {
    lastAutoRatedYieldRef.current = undefined;
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      status: '待启用',
      allow_repeated_borrow: true,
      mold_capacity: undefined,
      unit: '副',
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldRow) => {
    try {
      const detail = await getMold(record.id);
      const storedYield = detail.usable_yield != null ? Number(detail.usable_yield) : undefined;
      const autoYield = computeMoldRatedUsableYield(detail.mold_capacity, detail.usable_times);
      lastAutoRatedYieldRef.current =
        autoYield !== undefined && storedYield !== undefined && storedYield === autoYield
          ? autoYield
          : undefined;
      setIsEdit(true);
      setEditId(detail.id);
      setFormInitialValues({
        mold_code: detail.mold_code,
        name: detail.name,
        unit: detail.unit || '',
        mold_capacity: moldIntOrUndef(detail.mold_capacity),
        service_life_years: moldIntOrUndef(detail.service_life_years),
        usable_times: detail.usable_times ?? undefined,
        usable_yield: storedYield != null ? Math.round(storedYield) : undefined,
        maintenance_cycle_by_yield: moldIntOrUndef(detail.maintenance_cycle_by_yield),
        allow_repeated_borrow: detail.allow_repeated_borrow ?? true,
        purchase_vendor_name: detail.purchase_vendor_name ?? undefined,
        factory_entry_at: detail.factory_entry_at ? dayjs(detail.factory_entry_at) : undefined,
        mold_warehouse_id: detail.mold_warehouse_id ?? undefined,
        upkeep_param_set_id: detail.upkeep_param_set_id ?? undefined,
        status: detail.status,
        remark: detail.remark ?? undefined,
        used_times: detail.used_times ?? 0,
        used_yield: moldIntOrUndef(detail.used_yield) ?? 0,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载模具失败');
    }
  };

  const handleDeleteOne = (record: MoldRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除模具「${record.name}」（${record.mold_code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMold(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const handleOpenMoldDetail = async (record: MoldRow) => {
    const req = ++moldDetailReqRef.current;
    flushDrawerOpen(() => {
      setMoldDetail(record);
      setMoldOperationRecords([]);
      setDetailDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const [detailRes, opsRes] = await Promise.allSettled([
        getMold(record.id),
        listMoldOperationRecords(record.id),
      ]);
      if (moldDetailReqRef.current !== req) return;
      if (detailRes.status === 'fulfilled') {
        setMoldDetail(detailRes.value);
      } else {
        messageApi.error((detailRes.reason as Error)?.message || '加载详情失败');
      }
      if (opsRes.status === 'fulfilled') {
        setMoldOperationRecords(opsRes.value.items ?? []);
      } else {
        setMoldOperationRecords([]);
        messageApi.warning((opsRes.reason as Error)?.message || '操作记录加载失败');
      }
    } finally {
      if (moldDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const handleCloseMoldDetail = () => {
    setDetailDrawerVisible(false);
    setMoldDetail(null);
    setMoldOperationRecords([]);
  };

  const moldDetailColumnsBasic: ProDescriptionsItemProps<MoldRow>[] = [
    { title: '模具代号', dataIndex: 'mold_code', copyable: true },
    { title: '模具名称', dataIndex: 'name' },
    { title: '来源', dataIndex: 'ledger_source', render: (_, r) => renderMoldLedgerSourceCell(r.ledger_source) },
    { title: '单位', dataIndex: 'unit', render: (_, r) => r.unit || '—' },
    { title: '单模产能', dataIndex: 'mold_capacity', render: (_, r) => formatMoldLedgerInteger(r.mold_capacity) },
    { title: '额定可用次数', dataIndex: 'usable_times', render: (_, r) => r.usable_times ?? '—' },
    {
      title: '额定可用产量',
      dataIndex: 'usable_yield',
      render: (_, r) => {
        const derived = moldRatedUsableYieldToPayloadValue(r.mold_capacity, r.usable_times);
        return formatMoldLedgerInteger(derived ?? r.usable_yield);
      },
    },
    {
      title: '维修周期(依产量)',
      dataIndex: 'maintenance_cycle_by_yield',
      render: (_, r) => formatMoldLedgerInteger(r.maintenance_cycle_by_yield),
    },
    {
      title: '模具寿命（累计产量上限）',
      dataIndex: 'service_life_years',
      render: (_, r) => formatMoldLedgerInteger(r.service_life_years),
    },
    { title: '总制造数量', dataIndex: 'total_manufacture_qty', render: (_, r) => formatMoldLedgerInteger(r.total_manufacture_qty) },
    { title: '已使用次数', dataIndex: 'used_times', render: (_, r) => r.used_times ?? 0 },
    { title: '保养后制造数量', dataIndex: 'used_yield', render: (_, r) => formatMoldLedgerInteger(r.used_yield) },
    {
      title: '允许重复领用',
      dataIndex: 'allow_repeated_borrow',
      render: (_, r) => <Tag color={r.allow_repeated_borrow ? 'blue' : 'default'}>{r.allow_repeated_borrow ? '是' : '否'}</Tag>,
    },
    { title: '购买厂商', dataIndex: 'purchase_vendor_name', render: (_, r) => r.purchase_vendor_name || '—' },
    { title: '入厂时间', dataIndex: 'factory_entry_at', render: (_, r) => formatFactoryEntryAt(r.factory_entry_at) },
    {
      title: '加工时间(分钟)',
      dataIndex: 'processing_time_min',
      render: (_, r) => (
        <span title="领用单与对应还入单的创建时间之差的累计（分钟）；保存领用单或还入单后自动重算">
          {r.processing_time_min ?? '—'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => renderMoldLedgerStatusCell(r.status),
    },
    {
      title: '所在仓库',
      dataIndex: 'mold_warehouse_name',
      render: (_, r) => renderMoldWarehouseCell(r),
    },
    {
      title: '保养方案',
      dataIndex: 'upkeep_param_set_id',
      render: (_, r) => {
        if (r.upkeep_param_set_id == null) return '—';
        const s = upkeepSetOptions.find((o) => o.value === r.upkeep_param_set_id);
        return s ? s.label : r.upkeep_param_set_id;
      },
    },
    { title: '备注', dataIndex: 'remark', span: 2, render: (_, r) => r.remark || '—' },
  ];

  const buildPayload = (values: Record<string, unknown>): MoldCreatePayload => {
    void values.used_times;
    void values.used_yield;
    const statusRaw = String(values.status ?? '').trim();
    const status = statusRaw || '待用';
    if (!MOLD_LEDGER_STATUS_SET.has(status)) {
      throw new Error(`状态无效：${statusRaw || '(空)'}，须为：${MOLD_LEDGER_STATUSES.join('、')}`);
    }
    return {
    mold_code: String(values.mold_code ?? '').trim(),
    name: String(values.name ?? '').trim(),
    unit: String(values.unit ?? '').trim(),
    mold_capacity:
      values.mold_capacity != null && values.mold_capacity !== ''
        ? Math.round(Number(values.mold_capacity))
        : 0,
    service_life_years: moldIntStrOrUndef(values.service_life_years),
    usable_times: numOrUndef(values.usable_times),
    usable_yield: resolveUsableYieldPayload(values.mold_capacity, values.usable_times, values.usable_yield),
    maintenance_cycle_by_yield: moldIntStrOrUndef(values.maintenance_cycle_by_yield),
    allow_repeated_borrow: Boolean(values.allow_repeated_borrow),
    purchase_vendor_name: String(values.purchase_vendor_name ?? '').trim() || null,
    factory_entry_at: toIsoDate(values.factory_entry_at) ?? null,
    mold_warehouse_id: parseMoldWarehouseIdForForm(values.mold_warehouse_id),
    upkeep_param_set_id: parseMoldWarehouseIdForForm(values.upkeep_param_set_id),
    status,
    total_manufacture_qty: 0,
    remark: String(values.remark ?? '').trim() || null,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        const full = buildPayload(values);
        await updateMold(editId, omitMoldLedgerKeys(full));
        messageApi.success('已保存');
      } else {
        await createMold(buildPayload(values));
        messageApi.success('已创建');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<MoldRow>[] = [
    {
      title: '模具',
      dataIndex: 'mold_code',
      key: 'mold_code',
      fixed: 'left',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fieldProps: { placeholder: '请输入模具代号' },
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={(r.name || '').trim() || '—'}
          secondary={(r.mold_code || '').trim() || '—'}
        />
      ),
    },
    {
      title: '模具名称',
      dataIndex: 'name',
      hideInTable: true,
      fieldProps: { placeholder: '请输入模具名称' },
    },
    {
      title: '来源',
      dataIndex: 'ledger_source',
      width: 96,
      valueType: 'select',
      valueEnum: sourceValueEnum,
      fieldProps: { allowClear: true, placeholder: '请选择来源' },
      render: (_, r) => renderMoldLedgerSourceCell(r.ledger_source),
    },
    { title: '单位', dataIndex: 'unit', width: 72, hideInSearch: true, render: (_, r) => r.unit || '—' },
    {
      title: '单模产能',
      dataIndex: 'mold_capacity',
      width: 100,
      hideInSearch: true,
      render: (_, r) => formatMoldLedgerInteger(r.mold_capacity),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      valueType: 'select',
      valueEnum: statusValueEnum,
      fieldProps: { allowClear: true, placeholder: '请选择状态' },
      render: (_, r) => renderMoldLedgerStatusCell(r.status),
    },
    {
      title: '所在仓库',
      dataIndex: 'mold_warehouse_name',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => renderMoldWarehouseCell(r),
    },
    {
      title: '允许重复领用',
      dataIndex: 'allow_repeated_borrow',
      width: 120,
      hideInSearch: true,
      render: (_, r) => <Tag color={r.allow_repeated_borrow ? 'blue' : 'default'}>{r.allow_repeated_borrow ? '是' : '否'}</Tag>,
    },
    {
      title: '额定可用次数',
      dataIndex: 'usable_times',
      width: 108,
      hideInSearch: true,
      render: (_, r) => (r.usable_times != null ? r.usable_times : '—'),
    },
    {
      title: '额定可用产量',
      dataIndex: 'usable_yield',
      width: 112,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) =>
        formatMoldLedgerInteger(
          moldRatedUsableYieldToPayloadValue(r.mold_capacity, r.usable_times) ?? r.usable_yield,
        ),
    },
    {
      title: '模具寿命',
      dataIndex: 'service_life_years',
      width: 120,
      hideInSearch: true,
      render: (_, r) => formatMoldLedgerInteger(r.service_life_years),
    },
    {
      title: '总制造数量',
      dataIndex: 'total_manufacture_qty',
      width: 100,
      hideInSearch: true,
      render: (_, r) => formatMoldLedgerInteger(r.total_manufacture_qty),
    },
    { title: '已使用次数', dataIndex: 'used_times', width: 96, hideInSearch: true, render: (_, r) => r.used_times ?? 0 },
    {
      title: '保养后制造数量',
      dataIndex: 'used_yield',
      width: 108,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => formatMoldLedgerInteger(r.used_yield),
    },
    {
      title: '加工(分)',
      dataIndex: 'processing_time_min',
      width: 88,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => (
        <span title="领用单与对应还入单创建时间之差的累计（分钟），自动重算">
          {r.processing_time_min ?? '—'}
        </span>
      ),
    },
    { title: '购买厂商', dataIndex: 'purchase_vendor_name', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '入厂时间',
      dataIndex: 'factory_entry_at',
      width: 110,
      hideInSearch: true,
      render: (_, r) => formatFactoryEntryAt(r.factory_entry_at),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <Button key="detail" {...rowActionKind('read')} onClick={() => void handleOpenMoldDetail(record)} />,
        <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)} />,
        <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)} />,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldRow>
          headerTitle="模具台账"
          columnPersistenceId="apps.haoligo.pages.molds.ledger"
          tanstackQuery={HAOLIGO_MOLD_LEDGER_TANSTACK_QUERY}
          loadingDelay={0}
          skipFuzzyPinyinClientFilter
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('update')}
              key="mold-batch-lifecycle"
              disabled={selectedRowKeys.length === 0 && listMatchTotal <= 0}
              onClick={handleOpenBatchModal}
            >
              批量修改
            </Button>,
          ]}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            '*模具代号',
            '*模具名称',
            '*单位',
            '*单模产能',
            '状态',
            '允许重复领用',
            '模具寿命（累计产量上限）',
            '额定可用次数',
            '维修周期(依产量)',
            '购买厂商',
            '入厂时间',
            '备注',
          ]}
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入数据为空或格式不正确');
              return;
            }
            const headers = (data[0] || []).map((h: unknown) => String(h ?? '').trim());
            const getIdx = (...keys: string[]) => {
              for (const k of keys) {
                const i = headers.findIndex(
                  (h: string) => h.includes(k) || h.replace(/\*/g, '').toLowerCase().includes(k.toLowerCase()),
                );
                if (i >= 0) return i;
              }
              return -1;
            };
            const codeIdx = getIdx('模具代号', '代号', 'code');
            const nameIdx = getIdx('模具名称', '名称', 'name');
            const unitIdx = getIdx('单位', 'unit');
            const capIdx = getIdx('单模产能', '模具产能', '产能', 'capacity');
            if (codeIdx < 0 || nameIdx < 0 || unitIdx < 0 || capIdx < 0) {
              messageApi.error('导入表头需包含：模具代号、模具名称、单位、单模产能');
              return;
            }
            const statusIdx = getIdx('状态', 'status');
            const borrowIdx = getIdx('允许重复领用', '重复领用');
            const lifeCapIdx = getIdx('模具寿命', '累计产量上限', '寿命');
            const timesIdx = getIdx('额定可用次数', '可用次数', '次数');
            const maintYIdx = getIdx('维修周期(依产量)', '依产量', 'maintenance_cycle_by_yield');
            const vendorIdx = getIdx('购买厂商', '厂商');
            const entryIdx = getIdx('入厂时间', 'factory_entry_at');
            const remarkIdx = getIdx('备注', 'remark');

            const items: MoldCreatePayload[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const mold_code = String(row[codeIdx] ?? '').trim();
              const name = String(row[nameIdx] ?? '').trim();
              const unit = String(row[unitIdx] ?? '').trim();
              const capRaw = row[capIdx];
              const mold_capacity =
                capRaw !== null && capRaw !== undefined && capRaw !== ''
                  ? Math.round(Number(capRaw))
                  : Number.NaN;
              if (!mold_code || !name || !unit || !Number.isFinite(mold_capacity)) continue;
              const allowCell = borrowIdx >= 0 ? parseBoolCell(row[borrowIdx]) : undefined;
              const rawSt = statusIdx >= 0 ? String(row[statusIdx] ?? '').trim() : '';
              const rowStatus = rawSt || '待用';
              if (!MOLD_LEDGER_STATUS_SET.has(rowStatus)) {
                messageApi.error(
                  `第 ${i + 1} 行：状态「${rawSt || '(空，默认待用)'}」无效，须为：${MOLD_LEDGER_STATUSES.join('、')}`,
                );
                return;
              }
              items.push({
                mold_code,
                name,
                unit,
                mold_capacity,
                service_life_years: lifeCapIdx >= 0 ? moldIntStrOrUndef(row[lifeCapIdx]) : undefined,
                usable_times: timesIdx >= 0 ? numOrUndef(row[timesIdx]) : undefined,
                usable_yield: moldRatedUsableYieldToPayloadValue(mold_capacity, timesIdx >= 0 ? row[timesIdx] : undefined),
                maintenance_cycle_by_yield: maintYIdx >= 0 ? moldIntStrOrUndef(row[maintYIdx]) : undefined,
                allow_repeated_borrow: allowCell ?? true,
                purchase_vendor_name:
                  vendorIdx >= 0 ? String(row[vendorIdx] ?? '').trim() || null : null,
                factory_entry_at: entryIdx >= 0 ? parseImportDateCell(row[entryIdx]) : null,
                status: rowStatus,
                total_manufacture_qty: 0,
                remark: remarkIdx >= 0 ? String(row[remarkIdx] ?? '').trim() || null : null,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据（请检查必填列是否完整）');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createMold(item),
              title: '导入模具台账',
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(`成功导入 ${result.successCount} 条`);
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(`部分失败 ${result.failureCount} 条`);
            }
          }}
          showSyncButton
          showDatasetConfigButton
          onDatasetConfig={handleDatasetConfig}
          onSync={() => {
            if (!canSyncFromDataset) {
              messageApi.warning('请先在「数据集」中选择数据集，并填齐模具代号、模具名称、单位三列映射后保存');
              return;
            }
            setSyncIntroModalOpen(true);
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            const filters = parseMoldLedgerListSearchFilters(searchFormValues, params);
            try {
              const res = await listMolds({
                skip,
                limit: pageSize,
                status: filters.status,
                mold_code: filters.mold_code,
                name: filters.name,
                ledger_source: filters.ledger_source,
                keyword: filters.keyword,
              });
              listSnapshotRef.current = {
                total: res.total,
                keyword: filters.keyword,
                status: filters.status,
              };
              setListMatchTotal(res.total);
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
          scroll={{ x: 1480 }}
        />
      </ListPageTemplate>

      <UniDetail
        title={moldDetail ? `模具详情 · ${moldDetail.mold_code}` : '模具详情'}
        open={detailDrawerVisible}
        onClose={handleCloseMoldDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.HALF_WIDTH}
        plainBody={
          moldDetail ? (
            <>
              <MoldLifecycleMetricCards row={moldDetail} loading={detailLoading} />
              <DetailDrawerSection title="基本信息" marginBottom={PAGE_SPACING.PADDING}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(moldDetailColumnsBasic, moldDetail)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录" marginBottom={0}>
                {detailLoading ? (
                  <div style={{ padding: `${PAGE_SPACING.BLOCK_GAP}px 0`, display: 'flex', justifyContent: 'center' }}>
                    <Spin />
                  </div>
                ) : moldOperationRecords.length === 0 ? (
                  <Typography.Text type="secondary">暂无关联操作记录</Typography.Text>
                ) : (
                  <Timeline
                    items={moldOperationRecords.map((e) => ({
                      color: moldOperationKindColors[e.kind] ?? 'gray',
                      children: (
                        <div style={{ paddingBottom: 4 }}>
                          <div style={{ marginBottom: 4 }}>
                            <Typography.Text type="secondary">
                              {formatDateTime(e.occurred_at, 'YYYY-MM-DD HH:mm')}
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                              {e.sheet_no?.trim()
                                ? `单号 ${e.sheet_no.trim()}`
                                : `单号 #${e.record_id}`}
                            </Typography.Text>
                          </div>
                          <Typography.Text strong>{e.title}</Typography.Text>
                          {e.detail ? (
                            <div style={{ marginTop: 4, fontSize: 13 }}>
                              <Typography.Text type="secondary">{e.detail}</Typography.Text>
                            </div>
                          ) : null}
                        </div>
                      ),
                    }))}
                  />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      <FormModalTemplate
        title={isEdit ? '编辑' : '新增'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
          lastAutoRatedYieldRef.current = undefined;
        }}
        onValuesChange={handleMoldFormValuesChange}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="mold_code"
              label="模具代号"
              placeholder="请输入模具代号"
              disabled={isEdit}
              rules={[{ required: true, message: '请输入模具代号' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="模具名称"
              placeholder="请输入模具名称"
              rules={[{ required: true, message: '请输入模具名称' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="unit" label="单位" placeholder="请输入单位" rules={[{ required: true, message: '请输入单位' }]} />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="mold_capacity"
              label="单模产能"
              placeholder="请输入单模产能"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
              rules={[{ required: true, message: '请输入单模产能' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="usable_times"
              label="额定可用次数"
              placeholder="请输入额定可用次数"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="usable_yield"
              label="额定可用产量"
              placeholder="可手工修改；默认=单模产能×额定可用次数"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
              extra="= 单模产能 × 额定可用次数（可改；改产能/次数且产量仍为自动值时会重算）"
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle_by_yield"
              label="维修周期(依产量)"
              placeholder="请输入维修周期(依产量)"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="service_life_years"
              label="模具寿命（累计产量上限）"
              placeholder="请输入累计产量上限"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          {isEdit ? (
            <>
              <Col span={12}>
                <ProFormDigit
                  name="used_times"
                  label="已使用次数"
                  disabled
                  fieldProps={{ precision: 0, style: { width: '100%' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormDigit
                  name="used_yield"
                  label="保养后制造数量"
                  disabled
                  fieldProps={{ precision: 0, style: { width: '100%' } }}
                />
              </Col>
            </>
          ) : null}
          <Col span={12}>
            <ProFormSelect
              name="mold_warehouse_id"
              label="所在仓库"
              placeholder="请选择模具仓库"
              allowClear
              showSearch
              options={warehouseOptions}
              fieldProps={{
                optionFilterProp: 'label',
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="upkeep_param_set_id"
              label="保养方案"
              placeholder="请选择保养方案"
              allowClear
              showSearch
              options={upkeepSetOptions}
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProForm.Item name="purchase_vendor_name" label="购买厂商">
              <AutoComplete
                options={supplierOptions}
                placeholder="请选择或输入购买厂商"
                allowClear
                onSearch={(kw) => loadSuppliers(kw)}
                filterOption={(input, option) => {
                  const q = input.trim().toLowerCase();
                  if (!q) return true;
                  const label = String(option?.label ?? '').toLowerCase();
                  const value = String(option?.value ?? '').toLowerCase();
                  return label.includes(q) || value.includes(q);
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="factory_entry_at"
              label="入厂时间"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label="状态"
              placeholder="请选择状态"
              rules={[{ required: true, message: '请选择状态' }]}
              options={MOLD_LEDGER_STATUSES.map((s) => ({ label: s, value: s }))}
            />
          </Col>
          <Col span={12}>
            <ProFormSwitch name="allow_repeated_borrow" label="允许重复领用" />
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        title="批量修改（状态 / 所在仓库 / 模具寿命 / 额定可用次数 / 维修周期依产量）"
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        width={560}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setBatchModalOpen(false)}>
            取消
          </Button>,
          <Button {...rowActionKind('skip')} key="ok" type="primary" loading={batchModalBusy} onClick={() => void handleBatchSubmit()}>
            {batchScope === 'selected'
              ? `应用到已选 ${selectedRowKeys.length} 条`
              : `应用到当前筛选全部（${listMatchTotal} 条）`}
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="仅更新下方已填写的字段；留空则保持各条模具原值。"
        />
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>作用范围</div>
          <Radio.Group value={batchScope} onChange={(e) => setBatchScope(e.target.value as MoldBatchLifecycleScope)}>
            <Radio value="selected">仅已勾选（{selectedRowKeys.length} 条）</Radio>
            <Radio value="all_filtered">当前筛选全部（列表共 {listMatchTotal} 条）</Radio>
          </Radio.Group>
        </div>
        {batchScope === 'all_filtered' ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="「当前筛选全部」与表格底部总条数一致，包含所有分页；不限于本页勾选。"
          />
        ) : null}
        <Form form={batchForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select
                  allowClear
                  placeholder="留空不修改"
                  style={{ width: '100%' }}
                  options={MOLD_LEDGER_STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_warehouse_id" label="所在仓库">
                <Select
                  allowClear
                  placeholder="留空不修改"
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={[
                    { label: '（清空所在仓库）', value: MOLD_WAREHOUSE_BATCH_CLEAR },
                    ...warehouseOptions,
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="usable_times" label="额定可用次数">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="留空不修改；将重算额定可用产量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_cycle_by_yield" label="维修周期(依产量)">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="留空不修改" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="service_life_years" label="模具寿命（累计产量上限）">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="留空不修改" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="从数据集同步模具台账"
        open={syncIntroModalOpen}
        onCancel={() => setSyncIntroModalOpen(false)}
        width={560}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setSyncIntroModalOpen(false)}>
            取消
          </Button>,
          <Button {...rowActionKind('update')} key="sync" type="primary" onClick={handleStartDatasetSync}>
            开始同步
          </Button>,
        ]}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            将按已保存的数据集执行无参查询，按模具代号匹配：已存在则更新名称、单位（若已配置「单模产能列」则同时更新单模产能；若已配置「入厂时间列」则同时更新入厂时间）；不存在则新增（默认状态「待用」；未配置单模产能列时新增单模产能为 0）。
          </div>
          <Alert
            type="warning"
            showIcon
            message="耗时提示"
            description="同步耗时与数据集行数、数据库与网络状况有关，可能从数十秒到数分钟不等。开始同步后本说明窗口可关闭，同步仍在当前页签后台进行；请勿关闭或刷新整个浏览器页签，否则请求会中断。"
          />
          <Alert
            type="info"
            showIcon
            message="关于「服务端异步」"
            description="当前实现为一次 HTTP 请求内完成同步，网关或浏览器可能对超长请求超时。若未来数据量达到数万级或需关闭页签仍继续跑，可再改为服务端异步任务（队列）+ 进度/结果通知。"
          />
        </Space>
      </Modal>

      <Modal
        title="模具台账 · ERP 数据集"
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
        <Form<MoldLedgerDatasetBindingPayload> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label="数据集">
            <Select
              allowClear
              showSearch
              placeholder="选择用于同步模具主数据的数据集（需支持无参查询）"
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  mold_code_column: undefined,
                  mold_name_column: undefined,
                  unit_column: undefined,
                  mold_capacity_column: undefined,
                  factory_entry_at_column: undefined,
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
                name="mold_code_column"
                label="模具代号列"
                rules={[{ required: true, message: '请填写' }]}
                extra="与 SQL 结果列别名一致"
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
            <Col span={12}>
              <Form.Item name="unit_column" label="单位列" rules={[{ required: true, message: '请填写' }]}>
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
              <Form.Item name="mold_capacity_column" label="单模产能列">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入（可选）"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="factory_entry_at_column" label="入厂时间列">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入（可选）"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            type="info"
            showIcon
            message="同步时按「模具代号」匹配本系统台账：已存在则更新名称与单位；若配置了单模产能列则同时更新单模产能；若配置了入厂时间列则同时更新入厂时间。不存在则新增（默认状态「待用」；未配置单模产能列时单模产能为 0）。请在数据集 SQL 中支持无参全量或分页拉取。"
          />
        </Form>
      </Modal>
    </>
  );
};

export default MoldLedgerPage;
