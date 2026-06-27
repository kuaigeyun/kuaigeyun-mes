/**
 * 统一需求管理页面
 *
 * 提供销售预测和销售订单的统一管理功能，支持MTS/MTO两种模式。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation, type TFunction } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Row, Col, Table, Input, InputNumber, Alert, Spin, Form as AntForm, DatePicker, Typography, Tooltip, Dropdown, Empty, Tabs, theme as AntdTheme } from 'antd';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  listDemands,
  getDemand,
  createDemand,
  updateDemand,
  deleteDemand,
  submitDemand,
  approveDemand,
  rejectDemand,
  pushDemandToComputation,
  withdrawDemandFromComputation,
  listDemandRecalcHistory,
  listDemandSnapshots,
  getDemandStatistics,
  Demand,
  DemandItem,
  DemandStatus,
  ReviewStatus,
  DemandRecalcHistoryItem,
  DemandSnapshotItem,
} from '../../../services/demand';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { createDemandComputation } from '../../../services/demand-computation';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { demandBatchMergeComputationAllowed } from '../../../../../hooks/useDocumentCapabilities';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import {
  EyeOutlined,
  EditOutlined,
  ArrowDownOutlined,
  RollbackOutlined,
  MergeCellsOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { getDemandLifecycle } from '../../../utils/demandLifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { getDemandBusinessModeTagColor } from '../../../utils/businessMode';
import { getDemandTypeTagProps, normalizeDemandTypeKey } from '../../../utils/demandType';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { formatDateTime as formatDateTimeValue } from '../../../../../utils/format';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const DEMAND_ORIGIN_SUB_KEYS = new Set(['from_forecast', 'from_order', 'manual_plan']);

/** 根据字典 code 和 value 获取标签，无匹配时返回原值（支持大小写不敏感匹配） */
function getDictLabel(map: Record<string, Record<string, string>>, code: string, value: string | undefined): string {
  if (!value) return '-';
  const dict = map[code];
  if (!dict) return value;
  const label = dict[value] ?? Object.entries(dict).find(([k]) => k.toUpperCase() === value.toUpperCase())?.[1];
  return label ?? value;
}

/** 格式化时间为 YYYY-MM-DD HH:mm:ss */
function formatDateTime(t: string | undefined): string {
  if (!t) return '-';
  const d = dayjs(t);
  return d.isValid() ? formatDateTimeValue(d, 'YYYY-MM-DD HH:mm:ss') : t;
}

/** 详情「生命周期」区块标题：主标题 + 来源文案（无圆环、无单独来源子轨） */
function buildDemandLifecycleSectionTitle(record: Demand, t: TFunction) {
  const lifecycle = getDemandLifecycle(record);
  const originLabel = (lifecycle.subStages ?? []).find((s: any) => DEMAND_ORIGIN_SUB_KEYS.has(s.key))?.label;
  if (!originLabel) {
    return t('app.kuaizhizao.salesOrder.lifecycle');
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 0 }}>
      <span>{t('app.kuaizhizao.salesOrder.lifecycle')}</span>
      <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
        {originLabel}
      </Typography.Text>
    </span>
  );
}

/** 统一状态判断（兼容枚举与中文） */
function isDemandDraft(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.DRAFT || s === '草稿';
}
function isDemandPendingReview(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.PENDING_REVIEW || s === '待审核' || s === '已提交';
}
function isDemandAuditedAndApproved(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  const r = (d?.review_status ?? '').trim();
  const auditedOrConfirmed =
    s === DemandStatus.AUDITED ||
    s === DemandStatus.CONFIRMED ||
    s === '已审核' ||
    s === '已确认' ||
    s === '已生效';
  const approvedReview =
    r === '' ||
    r === ReviewStatus.APPROVED ||
    r === 'APPROVED' ||
    r === 'approved' ||
    r === '已审核' ||
    r === '审核通过' ||
    r === '通过' ||
    r === '已通过';
  return auditedOrConfirmed && approvedReview;
}

function isDemandRejected(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  const r = (d?.review_status ?? '').trim();
  return (
    s === DemandStatus.REJECTED ||
    s === '已驳回' ||
    r === ReviewStatus.REJECTED ||
    r === '审核驳回' ||
    r === '驳回'
  );
}

const DemandManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const pushToComputationAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_demand');
  const { message: messageApi } = App.useApp();

  const formatDemandTypeLabel = useCallback(
    (v: string | undefined | null) => {
      const k = normalizeDemandTypeKey(v);
      if (k === 'sales_forecast') return t('app.kuaizhizao.salesForecast.title');
      if (k === 'sales_order') return t('app.kuaizhizao.salesOrder.entityName');
      if (k === 'demand_plan') return t('app.kuaizhizao.demandManagement.demandTypePlan');
      return v?.trim() || '-';
    },
    [t]
  );

  const formatBusinessModeLabel = useCallback(
    (mode: string | undefined | null) => {
      const m = (mode ?? '').trim();
      if (m === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMtsShort');
      if (m === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMtoShort');
      if (m === 'ATO') return t('app.kuaizhizao.demandManagement.businessModeAtoShort');
      return m || '-';
    },
    [t]
  );

  const priorityOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.demandManagement.priorityHigh'), value: 1 },
      { label: t('app.kuaizhizao.demandManagement.priorityMedium'), value: 5 },
      { label: t('app.kuaizhizao.demandManagement.priorityLow'), value: 10 },
    ],
    [t]
  );

  const businessModeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.demandManagement.businessModeMts'), value: 'MTS' },
      { label: t('app.kuaizhizao.demandManagement.businessModeAto'), value: 'ATO' },
    ],
    [t]
  );

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = AntdTheme.useToken();
  const demandDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const demandRowsByIdRef = useRef<Map<number, Demand>>(new Map());
  const formRef = useRef<any>(null);
  const tableSearchFormRef = useRef<any>(null);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandStatistics'] });
  };

  const { data: statistics } = useQuery({
    queryKey: ['demandStatistics'],
    queryFn: getDemandStatistics,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [createPlanLoading, setCreatePlanLoading] = useState(false);
  const createPlanFormRef = useRef<ProFormInstance>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false); // 当前编辑的需求是否为草稿（草稿可改更多字段）

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemand, setCurrentDemand] = useState<Demand | null>(null);
  const [recalcHistory, setRecalcHistory] = useState<DemandRecalcHistoryItem[]>([]);
  const [snapshots, setSnapshots] = useState<DemandSnapshotItem[]>([]);
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [demandTrackingRefreshKey, setDemandTrackingRefreshKey] = useState(0);
  const [dictLabelMap, setDictLabelMap] = useState<Record<string, Record<string, string>>>({});

  const demandTracking = useDocumentTracking(
    drawerVisible && currentDemand?.id != null ? 'demand' : undefined,
    drawerVisible ? currentDemand?.id ?? undefined : undefined,
    demandTrackingRefreshKey
  );

  // 需求计划页仅管理手工需求计划（demand_plan）
  const demandType = 'demand_plan' as const;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const computationPerms = useResourcePermissions('plan-management-demand-computation');
  useNewShortcut(() => setCreatePlanModalVisible(true));

  const selectedDemandsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => demandRowsByIdRef.current.get(Number(key)))
        .filter((row): row is Demand => row != null),
    [selectedRowKeys],
  );
  const selectedDemandForPush = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    return selectedDemandsForBatch[0] ?? null;
  }, [selectedDemandsForBatch, selectedRowKeys.length]);

  useEffect(() => {
    const loadDicts = async () => {
      const result: Record<string, Record<string, string>> = {};
      const codes = ['SHIPPING_METHOD', 'PAYMENT_TERMS', 'MATERIAL_UNIT'];
      for (const code of codes) {
        try {
          const dict = await getDataDictionaryByCode(code);
          const items = await getDictionaryItemList(dict.uuid, true);
          const map: Record<string, string> = {};
          items.forEach((it) => {
            map[it.value] = it.label;
          });
          result[code] = map;
        } catch {
          result[code] = {};
        }
      }
      setDictLabelMap(result);
    };
    loadDicts();
  }, []);

  const handleCopy = useCallback(
    (text: string) => {
      if (!text?.trim()) return;
      void navigator.clipboard.writeText(text).then(
        () => messageApi.success(t('common.copySuccess')),
        () => messageApi.error(t('common.copyFailed'))
      );
    },
    [messageApi, t]
  );

  const handleCreatePlanSubmit = async (values: any) => {
    setCreatePlanLoading(true);
    try {
      const rawBusinessMode = String(values.business_mode ?? 'MTS').trim().toUpperCase();
      const createBusinessMode = rawBusinessMode === 'ATO' ? 'ATO' : 'MTS';
      const items = (values.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || 'PCS',
        required_quantity: Number(it.required_quantity) || 0,
        delivery_date: it.delivery_date ? formatDateTimeValue(it.delivery_date, 'YYYY-MM-DD') : undefined,
      })).filter((it: any) => it.material_id && it.required_quantity > 0);
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.demandManagement.planItemsQtyRequired'));
        return;
      }
      await createDemand({
        demand_type: 'demand_plan',
        demand_name: values.demand_name,
        business_mode: createBusinessMode,
        start_date: values.start_date ? formatDateTimeValue(values.start_date, 'YYYY-MM-DD') : formatDateTimeValue(dayjs(), 'YYYY-MM-DD'),
        end_date: values.end_date ? formatDateTimeValue(values.end_date, 'YYYY-MM-DD') : undefined,
        total_quantity: 0,
        total_amount: 0,
        status: DemandStatus.DRAFT,
        review_status: ReviewStatus.PENDING,
        priority: values.priority ?? 5,
        notes: values.notes,
        items,
      });
      messageApi.success(t('app.kuaizhizao.demandManagement.planCreated'));
      setCreatePlanModalVisible(false);
      createPlanFormRef.current?.resetFields();
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (err: any) {
      messageApi.error(getApiErrorMessage(err) || t('app.kuaizhizao.demandManagement.submitFailed'));
    } finally {
      setCreatePlanLoading(false);
    }
  };

  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getDemand(id);
        setIsEditingDraft(isDemandDraft(data));
        formRef.current?.setFieldsValue(data);
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.demandManagement.detailFailed'));
      }
    }
  };

  /**
   * 处理提交表单（仅用于编辑，如修改优先级）
   */
  const handleSubmit = async (values: any) => {
    if (!isEdit || !currentId) return;
    try {
      await updateDemand(currentId, values);
      messageApi.success(t('app.kuaizhizao.demandManagement.updated'));
      setModalVisible(false);
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  useEffect(() => {
    if (!drawerVisible || !currentDemand?.id) return;

    const loadExtraData = async () => {
      setRecalcHistoryLoading(true);
      try {
        const history = await listDemandRecalcHistory(currentDemand.id!, { limit: 50 });
        setRecalcHistory(history);
      } catch {
        messageApi.error(t('app.kuaizhizao.demandManagement.recalcHistoryFailed'));
      } finally {
        setRecalcHistoryLoading(false);
      }

      setSnapshotsLoading(true);
      try {
        const list = await listDemandSnapshots(currentDemand.id!, { limit: 20 });
        setSnapshots(list);
      } catch {
        messageApi.error(t('app.kuaizhizao.demandManagement.snapshotsFailed'));
      } finally {
        setSnapshotsLoading(false);
      }
    };

    loadExtraData();
  }, [drawerVisible, currentDemand?.id, messageApi]);

  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemand(id, true, false);
        setCurrentDemand(data);
        setDrawerVisible(true);
        setDemandTrackingRefreshKey((k) => k + 1);
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.demandManagement.detailFailed'));
      }
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.demandManagement.selectToDelete'));
      return;
    }
    const allowedKeys = keys.filter((k) => {
      const id = Number(k);
      if (isNaN(id)) return false;
      const row = demandRowsByIdRef.current.get(id);
      if (!row) return true;
      if (row.demand_type !== 'demand_plan') return false;
      return isDemandDraft(row) || isDemandPendingReview(row);
    });
    const skipped = keys.length - allowedKeys.length;
    if (skipped > 0) {
      messageApi.warning(t('app.kuaizhizao.demandManagement.deleteSkipped', { skipped }));
    }
    if (allowedKeys.length === 0) {
      if (skipped === 0) messageApi.warning(t('app.kuaizhizao.demandManagement.noDeletablePlans'));
      return;
    }
    let successCount = 0;
    const errors: string[] = [];
    for (const k of allowedKeys) {
      const id = Number(k);
      if (isNaN(id)) continue;
      try {
        await deleteDemand(id);
        successCount += 1;
      } catch (e) {
        errors.push(`ID ${id}: ${getApiErrorMessage(e)}`);
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaizhizao.demandManagement.deleteSuccess', { count: successCount }));
      invalidateStatistics();
      actionRef.current?.reload();
      setSelectedRowKeys((prev) => prev.filter((pk) => !allowedKeys.includes(pk)));
    }
    if (errors.length > 0) {
      messageApi.error(
        errors.slice(0, 3).join(t('common.listSeparator')) +
          (errors.length > 3 ? ` ${t('app.kuaizhizao.demandManagement.errorsAndMore', { count: errors.length })}` : '')
      );
    }
  };

  const handleMergeComputationBulk = useCallback(async (ids: number[]) => {
    const payload =
      ids.length === 1
        ? { demand_id: ids[0], computation_type: 'MRP' as const, computation_params: {} }
        : { demand_ids: ids, computation_type: 'MRP' as const, computation_params: {} };
    const computation = await createDemandComputation(payload);
    invalidateStatistics();
    actionRef.current?.reload();
    if (computation?.id) {
      window.location.href = `/apps/kuaizhizao/plan-management/demand-computation?highlight=${computation.id}`;
    }
    return { success_count: ids.length, failed_count: 0 };
  }, [queryClient]);

  const handlePushToComputation = async (id: number) => {
    Modal.confirm({
      title: pushToComputationAction.label,
      content: t('app.kuaizhizao.demandManagement.pushToMrpConfirm'),
      onOk: async () => {
        try {
          const result = await pushDemandToComputation(id);
          messageApi.success(result.message || t('app.kuaizhizao.demandManagement.pushSuccess'));
          invalidateStatistics();
          actionRef.current?.reload();
          if (currentDemand?.id === id) {
            void getDemand(id)
              .then((updated) => setCurrentDemand(updated))
              .catch(() => {});
            setDemandTrackingRefreshKey((k) => k + 1);
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.salesOrder.pushFailed'));
          throw error;
        }
      },
    });
  };

  const handleWithdrawFromComputation = async (id: number) => {
    Modal.confirm({
      title: t('app.kuaizhizao.demandManagement.withdrawTitle'),
      content: t('app.kuaizhizao.demandManagement.withdrawConfirm'),
      onOk: async () => {
        try {
          await withdrawDemandFromComputation(id);
          messageApi.success(t('app.kuaizhizao.salesOrder.withdrawSuccess'));
          invalidateStatistics();
          actionRef.current?.reload();
          if (currentDemand?.id === id) {
            void getDemand(id)
              .then((updated) => setCurrentDemand(updated))
              .catch(() => {});
            setDemandTrackingRefreshKey((k) => k + 1);
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.salesOrder.withdrawFailed'));
          throw error;
        }
      },
    });
  };

  const demandCanPushToComputation = useCallback((record: Demand) => {
    return !record.pushed_to_computation && isDemandAuditedAndApproved(record);
  }, []);

  const demandCanWithdrawComputation = useCallback((record: Demand) => {
    return record.pushed_to_computation === true;
  }, []);
  const demandToolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-to-computation',
          label: pushToComputationAction.label,
          disabled: !selectedDemandForPush || !demandCanPushToComputation(selectedDemandForPush),
          onClick: () => {
            if (selectedDemandForPush?.id != null) {
              void handlePushToComputation(selectedDemandForPush.id);
            }
          },
        },
      ]),
    [
      demandCanPushToComputation,
      handlePushToComputation,
      pushToComputationAction.label,
      selectedDemandForPush,
    ],
  );
  const demandToolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) return t('app.kuaizhizao.demandComputation.selectOneFirst');
    if (selectedRowKeys.length > 1) return t('app.kuaizhizao.demandComputation.pushSingleOnly');
    if (!selectedDemandForPush) return t('app.kuaizhizao.demandComputation.selectedNotInList');
    return t('components.uniPush.disabled.unavailable', { defaultValue: '当前状态不可下推' });
  }, [selectedDemandForPush, selectedRowKeys.length, t]);
  const canUseDemandToolbarPush = Boolean(
    selectedDemandForPush &&
    demandCanPushToComputation(selectedDemandForPush),
  );
  const createPlanButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.demandManagement.createPlan')),
    [t],
  );
  const demandAuditEnabled = useAuditRequired('demand', false);
  const demandAuditColumn = useMemo(
    () => createListAuditPhaseColumn<Demand>({ t, auditEnabled: demandAuditEnabled }),
    [t, demandAuditEnabled],
  );

  const columns: ProColumns<Demand>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.demandManagement.colDemandPrimary'),
      key: 'demand_code',
      dataIndex: 'demand_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_: unknown, record: Demand) => (
        <UniTableStackedPrimaryCell
          primary={String(record.demand_name ?? '')}
          secondary={String(record.demand_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.demandManagement.demandCode'),
      dataIndex: 'demand_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.demandManagement.demandName'),
      dataIndex: 'demand_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.demandManagement.demandType'),
      dataIndex: 'demand_type',
      width: 120,
      render: (_: unknown, record: Demand) => (
        <Tag {...getDemandTypeTagProps(record.demand_type)}>{formatDemandTypeLabel(record.demand_type)}</Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.demandManagement.businessMode'),
      dataIndex: 'business_mode',
      width: 100,
      valueEnum: {
        MTS: { text: t('app.kuaizhizao.demandManagement.businessModeMtsShort'), status: 'Processing' },
        MTO: { text: t('app.kuaizhizao.demandManagement.businessModeMtoShort'), status: 'Success' },
        ATO: { text: t('app.kuaizhizao.demandManagement.businessModeAtoShort'), status: 'Warning' },
      },
    },
    ...(demandAuditColumn ? [demandAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: 'lifecycle_stage',
      align: 'center' as const,
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getDemandLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      width: 240,
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_, record) => {
        const canEdit = isDemandDraft(record) || isDemandPendingReview(record);
        const canDelete =
          record.demand_type === 'demand_plan' &&
          (isDemandDraft(record) || isDemandPendingReview(record));
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')}
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            {t('common.detail')}
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit([record.id!])}
            >
              {t('common.edit')}
            </Button>
          );
        }
        if (canDelete) {
          parts.push(
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id!])}
            >
              {t('common.delete')}
            </Button>
          );
        }
        if (demandCanWithdrawComputation(record)) {
          parts.push(
            <Button {...rowActionKind('revoke')}
              key="withdraw-push"
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => void handleWithdrawFromComputation(record.id!)}
            >
              {t('app.kuaizhizao.demandManagement.withdrawPush')}
            </Button>
          );
        }
        parts.push(
          <UniWorkflowActions {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.demandManagement.entityName')}
            auditNodeKey="demand"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[DemandStatus.DRAFT, '草稿']}
            pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
            approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
            rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
            theme="link"
            size="small"
            onSuccess={() => {
              invalidateStatistics();
              actionRef.current?.reload();
            }}
          />
        );
        return parts;
      },
    },
  ],
    [t, formatDemandTypeLabel, handleDelete, handleDetail, handleEdit, demandCanWithdrawComputation, handleWithdrawFromComputation, demandAuditColumn]
  );

  const statCards: StatCard[] = useMemo(
    () =>
      statistics
    ? [
        { title: t('app.kuaizhizao.demandManagement.statActive'), value: statistics.active_count },
        {
          title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'),
          value: statistics.pending_review_count,
          valueStyle: statistics.pending_review_count > 0 ? { color: '#faad14' } : undefined,
          onClick:
            statistics.pending_review_count > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: DemandStatus.PENDING_REVIEW });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        { title: t('app.kuaizhizao.salesOrder.lifecycleAudited'), value: statistics.audited_count },
        { title: t('app.kuaizhizao.demandManagement.statPushed'), value: statistics.pushed_count },
        {
          title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
          value: statistics.total_amount ?? 0,
          prefix: '¥',
          precision: 2,
        },
      ]
    : [
        { title: t('app.kuaizhizao.demandManagement.statActive'), value: 0 },
        { title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'), value: 0 },
        { title: t('app.kuaizhizao.salesOrder.lifecycleAudited'), value: 0 },
        { title: t('app.kuaizhizao.demandManagement.statPushed'), value: 0 },
        {
          title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
          value: 0,
          prefix: '¥',
          precision: 2,
        },
      ],
    [statistics, t]
  );
 
  const appendDemandPlanItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createPlanFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
        required_quantity: 1,
        delivery_date: dayjs(),
      }));
      createPlanFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const createPlanItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesOrder.material'),
        dataIndex: 'material_id',
        width: 280,
        render: (_: unknown, __: unknown, index: number) => (
          <>
            <div className="uni-detail-material-cell" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  placeholder={t('app.kuaizhizao.salesOrder.selectMaterial')}
                  required
                  size="small"
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_unit: 'baseUnit',
                  }}
                  formItemProps={{ style: { margin: 0 } }}
                />
              </div>
            </div>
            <AntForm.Item name={[index, 'material_code']} hidden>
              <Input />
            </AntForm.Item>
            <AntForm.Item name={[index, 'material_name']} hidden>
              <Input />
            </AntForm.Item>
            <AntForm.Item name={[index, 'material_unit']} hidden>
              <Input />
            </AntForm.Item>
          </>
        ),
      },
      {
        title: t('app.kuaizhizao.salesOrder.quantity'),
        dataIndex: 'required_quantity',
        width: 110,
        align: 'right' as const,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'required_quantity']}
            rules={[
              { required: true, message: t('common.required') },
              { type: 'number', min: 0.0001, message: t('app.kuaizhizao.salesOrder.quantityMinHint') },
            ]}
            style={{ margin: 0 }}
          >
            <InputNumber placeholder={t('app.kuaizhizao.demandManagement.quantityPlaceholder')} min={0} precision={4} style={{ width: '100%' }} size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.planReports.colRequirementDate'),
        dataIndex: 'delivery_date',
        width: 130,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'delivery_date']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ margin: 0 }}
          >
            <FutureDatePicker
              size="small"
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              getForm={() => createPlanFormRef.current}
              baseFieldName="start_date"
              t={t}
            />
          </AntForm.Item>
        ),
      },
    ],
    [t]
  );

  const detailItemColumns = useMemo(
    () => (demandType: Demand['demand_type']) => [
      { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
      {
        title: t('app.kuaizhizao.salesForecast.variantAttributes'),
        dataIndex: 'variant_attributes',
        width: 140,
        ellipsis: true,
        render: (v: Record<string, unknown> | string | undefined) => {
          if (v == null) return '-';
          if (typeof v === 'string') return v || '-';
          return Object.keys(v).length > 0 ? JSON.stringify(v) : '-';
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.unit'),
        dataIndex: 'material_unit',
        width: 80,
        render: (v: string) => getDictLabel(dictLabelMap, 'MATERIAL_UNIT', v) || v || '-',
      },
      { title: t('app.kuaizhizao.planReports.colRequirementQty'), dataIndex: 'required_quantity', width: 100, align: 'right' as const },
      ...(demandType === 'sales_forecast'
        ? [
            { title: t('app.kuaizhizao.salesForecast.forecastDate'), dataIndex: 'forecast_date', width: 120 },
            { title: t('app.kuaizhizao.demandManagement.forecastMonth'), dataIndex: 'forecast_month', width: 100 },
          ]
        : [
            { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 120 },
            { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 100, align: 'right' as const },
            { title: t('app.kuaizhizao.salesOrder.remainingQty'), dataIndex: 'remaining_quantity', width: 100, align: 'right' as const },
          ]),
    ],
    [dictLabelMap, t]
  );

  const recalcHistoryColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandManagement.colRecalcAt'), dataIndex: 'recalc_at', width: 180, render: (val: string) => formatDateTime(val) },
      {
        title: t('app.kuaizhizao.demandManagement.colTriggerType'),
        dataIndex: 'trigger_type',
        width: 100,
        render: (v: string) =>
          v === 'upstream_change'
            ? t('app.kuaizhizao.demandManagement.triggerUpstreamChange')
            : v === 'manual'
              ? t('app.kuaizhizao.demandManagement.triggerManual')
              : v || '-',
      },
      {
        title: t('app.kuaizhizao.demandManagement.colSourceType'),
        dataIndex: 'source_type',
        width: 100,
        render: (v: string) =>
          v === 'sales_order'
            ? t('app.kuaizhizao.salesOrder.entityName')
            : v === 'sales_forecast'
              ? t('app.kuaizhizao.salesForecast.title')
              : v || '-',
      },
      { title: t('app.kuaizhizao.demandManagement.colChangeReason'), dataIndex: 'trigger_reason', ellipsis: true, render: (v: string) => v || '-' },
      {
        title: t('app.kuaizhizao.demandManagement.colResult'),
        dataIndex: 'result',
        width: 90,
        render: (v: string) =>
          v === 'success'
            ? t('app.kuaizhizao.demandManagement.resultSuccess')
            : v === 'failed'
              ? t('app.kuaizhizao.demandManagement.resultFailed')
              : v || '-',
      },
      { title: t('app.kuaizhizao.demandManagement.colDescription'), dataIndex: 'message', ellipsis: true, render: (v: string) => v || '-' },
    ],
    [t]
  );

  const snapshotColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandManagement.colSnapshotAt'), dataIndex: 'snapshot_at', width: 180, render: (val: string) => formatDateTime(val) },
      {
        title: t('app.kuaizhizao.demandManagement.colSnapshotType'),
        dataIndex: 'snapshot_type',
        width: 100,
        render: (v: string) => (v === 'before_recalc' ? t('app.kuaizhizao.demandManagement.snapshotBeforeRecalc') : v || '-'),
      },
      {
        title: t('app.kuaizhizao.demandManagement.colChangeReason'),
        dataIndex: 'trigger_reason',
        ellipsis: true,
        render: (v: string) => {
          if (!v) return '-';
          if (v.includes('sales_order')) return t('app.kuaizhizao.demandManagement.changeSalesOrder');
          if (v.includes('sales_forecast')) return t('app.kuaizhizao.demandManagement.changeSalesForecast');
          return v;
        },
      },
    ],
    [t]
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<Demand>
          columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-management"
          headerTitle={t('app.kuaizhizao.demandManagement.title')}
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            apiParams.demand_type = 'demand_plan';
            if (searchFormValues?.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已驳回: 'REJECTED',
                已审核: 'AUDITED',
                已下推计算: 'AUDITED',
              };
              apiParams.status = lifecycleToStatus[searchFormValues.lifecycle] ?? searchFormValues.lifecycle;
              if (searchFormValues.lifecycle === '已下推计算') {
                apiParams.pushed_to_computation = true;
              }
            } else if (searchFormValues?.status) {
              apiParams.status = searchFormValues.status;
            }

            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }

            try {
              const response = await listDemands(apiParams);
              const rows = response.data || [];
              demandRowsByIdRef.current = new Map(
                rows.filter((d: Demand) => d.id != null).map((d: Demand) => [d.id as number, d])
              );
              return {
                data: rows,
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.getListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          selectedRowKeys={selectedRowKeys}
          showCreateButton={false}
          toolBarRender={() => [
            <Button
              key="create-demand-plan"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreatePlanModalVisible(true)}
            >
              {createPlanButtonLabel}
            </Button>,
            <UniPushToolbarButton
              key={`demand-toolbar-push-${selectedDemandForPush?.id ?? 'none'}`}
              menuItems={demandToolbarPushMenuItems}
              disabled={selectedRowKeys.length !== 1 || !canUseDemandToolbarPush}
              disabledReason={demandToolbarPushDisabledReason}
            />,
          ]}
          showEditButton={false}
          showDeleteButton={true}
          onDelete={handleDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listDemands({ skip: 0, limit: 10000, demand_type: 'demand_plan' });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Demand) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new window.Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `demands-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="demand-merge-computation"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedDemandsForBatch}
              capabilityKey="merge_computation"
              permAllowed={computationPerms.canCreate}
              batchAllowed={(recs, perm) => demandBatchMergeComputationAllowed(recs, perm)}
              onRunBulk={handleMergeComputationBulk}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.demandManagement.mergeComputation'),
                batch: t('app.kuaizhizao.demandManagement.mergeComputation'),
                batchConfirmTitle: () => t('app.kuaizhizao.demandManagement.mergeTitle'),
                batchConfirmDescription: (count) => t('app.kuaizhizao.demandManagement.mergeConfirm', { count }),
              }}
              icon={<MergeCellsOutlined />}
              size="middle"
              onSuccess={() => {
                setSelectedRowKeys([]);
                messageApi.success(t('app.kuaizhizao.demandManagement.mergeCreated'));
              }}
              notAllowedMessage={t('app.kuaizhizao.demandManagement.mergeSelectFirst')}
            />,
            <Tooltip {...rowActionKind('skip')}
              key="merge-computation-tip"
              title={t('app.kuaizhizao.demandManagement.mergeComputationTooltip')}
            >
              <QuestionCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
            </Tooltip>,
          ]}
        />
      </ListPageTemplate>

      {/* 新建计划：FormModalTemplate + 两栏表头 + 销售订单式明细 Table */}
      <FormModalTemplate
        title={t('app.kuaizhizao.demandManagement.createPlanTitle')}
        open={createPlanModalVisible}
        onClose={() => {
          setCreatePlanModalVisible(false);
          createPlanFormRef.current?.resetFields();
        }}
        onFinish={handleCreatePlanSubmit}
        isEdit={false}
        formRef={createPlanFormRef as React.RefObject<ProFormInstance>}
        width={MODAL_CONFIG.LARGE_WIDTH}
        loading={createPlanLoading}
        grid={false}
        initialValues={{ business_mode: 'MTS', priority: 5, items: [] }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormText
              name="demand_name"
              label={t('app.kuaizhizao.salesOrder.planName')}
              placeholder={t('app.kuaizhizao.demandManagement.planNamePlaceholder')}
              rules={[{ required: true, message: t('app.kuaizhizao.demandManagement.planNameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="start_date"
              label={t('app.kuaizhizao.salesForecast.startDate')}
              rules={[{ required: true, message: t('app.kuaizhizao.demandManagement.startDateRequired') }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="end_date"
              label={t('app.kuaizhizao.demandManagement.endDateOptional')}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => createPlanFormRef.current,
                fieldName: 'end_date',
                baseFieldName: 'start_date',
                t,
                fieldProps: { style: { width: '100%' } },
              })}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="business_mode"
              label={
                <Space size={6} align="center">
                  <span>{t('app.kuaizhizao.demandManagement.businessMode')}</span>
                  <Tooltip title={t('app.kuaizhizao.demandManagement.businessModeTooltip')}>
                    <Button type="text" size="small" icon={<QuestionCircleOutlined />} aria-label={t('app.kuaizhizao.demandManagement.businessModeAriaLabel')} style={{ padding: 0, height: 'auto', color: 'var(--ant-color-text-tertiary)' }} />
                  </Tooltip>
                </Space>
              }
              options={businessModeOptions}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="priority"
              label={t('app.kuaizhizao.demandManagement.priority')}
              options={priorityOptions}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>

        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.demandManagement.planItems')}
          required
          requiredMessage={t('app.kuaizhizao.demandManagement.planItemsRequired')}
          headerExtra={(
            <Space size={8}>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(createPlanFormRef.current?.getFieldValue('items') ?? [])];
                  items.push({
                    material_id: undefined,
                    material_code: '',
                    material_name: '',
                    material_unit: '',
                    required_quantity: 1,
                    delivery_date: dayjs(),
                  });
                  createPlanFormRef.current?.setFieldsValue({ items });
                }}
              >
                {t('app.kuaizhizao.demandManagement.addPlanItem')}
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={() => setMaterialPickerOpen(true)}
              >
                {t('app.kuaizhizao.common.materialBatchSelect')}
              </Button>
            </Space>
          )}
          columns={createPlanItemColumns}
          disabledAdd
          initialValue={{
            material_id: undefined,
            material_code: '',
            material_name: '',
            material_unit: '',
            required_quantity: 1,
            delivery_date: dayjs(),
          }}
          tableProps={{
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />

        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesOrder.notes')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendDemandPlanItemsFromMaterials}
      />

      {/* 编辑需求 Modal：非草稿仅可改优先级和备注；草稿可改更多字段 */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title={isEditingDraft ? t('app.kuaizhizao.demandManagement.editDemand') : t('app.kuaizhizao.demandManagement.modifyDemand')}
        width={MODAL_CONFIG.SMALL_WIDTH}
        footer={null}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
                  <Button type="primary" onClick={() => formRef.current?.submit()}>
                    {t('app.kuaizhizao.demandManagement.update')}
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          {/* 非草稿：仅可修改优先级和备注（与上游同步） */}
          {!isEditingDraft && (
            <Row gutter={16}>
              <Col span={24}>
                <ProFormSelect
                  name="priority"
                  label={t('app.kuaizhizao.demandManagement.priority')}
                  options={priorityOptions}
                  fieldProps={{ style: { width: 200 } }}
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label={t('app.kuaizhizao.salesOrder.notes')}
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
          {/* 草稿：可编辑必要字段 */}
          {isEditingDraft && (
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="priority"
                  label={t('app.kuaizhizao.demandManagement.priority')}
                  options={priorityOptions}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="demand_type"
                  label={t('app.kuaizhizao.demandManagement.demandType')}
                  options={[
                    { label: t('app.kuaizhizao.demandManagement.demandTypePlan'), value: 'demand_plan' },
                  ]}
                  rules={[{ required: true, message: t('app.kuaizhizao.demandManagement.selectDemandType') }]}
                  fieldProps={{
                    style: { width: '100%' },
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="demand_name"
                  label={t('app.kuaizhizao.demandManagement.demandName')}
                  placeholder={t('app.kuaizhizao.demandManagement.demandNamePlaceholder')}
                  rules={[{ required: true, message: t('app.kuaizhizao.demandManagement.demandNameRequired') }]}
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="start_date"
                  label={t('app.kuaizhizao.salesForecast.startDate')}
                  rules={[{ required: true, message: t('app.kuaizhizao.demandManagement.startDateRequired') }]}
                  width="100%"
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="end_date"
                  label={t('app.kuaizhizao.salesForecast.endDate')}
                  width="100%"
                  fieldProps={buildFutureDateShortcutFieldProps({
                    getForm: () => formRef.current,
                    fieldName: 'end_date',
                    baseFieldName: 'start_date',
                    t,
                  })}
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label={t('app.kuaizhizao.salesOrder.notes')}
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
        </ProForm>
      </Modal>

      <DetailDrawerTemplate
        title={
          currentDemand?.demand_code ? (
            <Space align="center" size={8}>
              <span>{t('app.kuaizhizao.demandManagement.detailTitleWithCode', { code: currentDemand.demand_code })}</span>
              <Tooltip title={t('field.invitationCode.copy')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(currentDemand.demand_code!)}
                />
              </Tooltip>
            </Space>
          ) : (
            t('app.kuaizhizao.demandManagement.detailTitle')
          )
        }
        open={drawerVisible}
        zIndex={demandDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentDemand && (
            <Space>
              <UniWorkflowActions {...rowActionKind('skip')}
                record={currentDemand}
                entityName={t('app.kuaizhizao.demandManagement.entityName')}
                auditNodeKey="demand"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[DemandStatus.DRAFT, '草稿']}
                pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
                approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
                rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
                theme="default"
                size="middle"
                onSuccess={async () => {
                  invalidateStatistics();
                  actionRef.current?.reload();
                  setDemandTrackingRefreshKey((k) => k + 1);
                  if (currentDemand?.id) {
                    const updated = await getDemand(currentDemand.id, true, false);
                    setCurrentDemand(updated);
                  }
                }}
              />
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDrawerVisible(false);
                  handleEdit([currentDemand.id!]);
                }}
              >
                {t('common.edit')}
              </Button>
              {currentDemand.demand_type === 'demand_plan' &&
                (isDemandDraft(currentDemand) || isDemandPendingReview(currentDemand)) && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setDrawerVisible(false);
                      void handleDelete([currentDemand.id!]);
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                )}
              {currentDemand.pushed_to_computation ? (
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => handleWithdrawFromComputation(currentDemand.id!)}
                >
                  {t('app.kuaizhizao.demandManagement.withdrawPush')}
                </Button>
              ) : (
                isDemandAuditedAndApproved(currentDemand) && (
                  <Button
                    type="primary"
                    icon={<ArrowDownOutlined />}
                    onClick={() => handlePushToComputation(currentDemand.id!)}
                  >
                    {pushToComputationAction.label}
                  </Button>
                )
              )}
            </Space>
          )
        }
      >
        {currentDemand && (
          <div style={{ padding: '0 0 16px 0' }}>
            {currentDemand.pushed_to_computation && currentDemand.computation_id && (
              <Alert
                type="info"
                showIcon
                message={t('app.kuaizhizao.demandManagement.alertChangedMessage')}
                description={
                  <span>
                    {t('app.kuaizhizao.demandManagement.alertPushedDescription')}
                    {currentDemand.computation_code && `（${currentDemand.computation_code}）`}
                    {t('app.kuaizhizao.demandManagement.alertPushedMiddle')}
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      onClick={() => {
                        setDrawerVisible(false);
                        navigate(`/apps/kuaizhizao/plan-management/demand-computation?highlight=${currentDemand.computation_id}`);
                      }}
                    >
                      {t('app.kuaizhizao.demandManagement.goToComputation')}
                    </Button>
                    {t('app.kuaizhizao.demandManagement.recomputeSuffix')}
                  </span>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
              <ProDescriptions column={3} dataSource={currentDemand}>
                <ProDescriptions.Item label={t('app.kuaizhizao.demandManagement.demandCode')} dataIndex="demand_code">
                  <Space size={4}>
                    <span>{currentDemand.demand_code ?? '-'}</span>
                    {currentDemand.demand_code ? (
                      <Tooltip title={t('field.invitationCode.copy')}>
                        <Button
                          type="link"
                          size="small"
                          icon={<CopyOutlined style={{ fontSize: 12 }} />}
                          onClick={() => handleCopy(currentDemand.demand_code!)}
                        />
                      </Tooltip>
                    ) : null}
                  </Space>
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaizhizao.demandManagement.demandType')}>
                  <Tag {...getDemandTypeTagProps(currentDemand.demand_type)}>{formatDemandTypeLabel(currentDemand.demand_type)}</Tag>
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaizhizao.demandManagement.demandName')} dataIndex="demand_name" />
                <ProDescriptions.Item label={t('app.kuaizhizao.demandManagement.businessMode')} dataIndex="business_mode">
                  <Tag color={getDemandBusinessModeTagColor(currentDemand.business_mode)}>
                    {formatBusinessModeLabel(currentDemand.business_mode)}
                  </Tag>
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaizhizao.salesForecast.startDate')} dataIndex="start_date" valueType="date" />
                <ProDescriptions.Item label={t('app.kuaizhizao.salesForecast.endDate')} dataIndex="end_date" valueType="date" />
                {currentDemand.demand_type === 'sales_forecast' && (
                  <ProDescriptions.Item label={t('app.kuaizhizao.salesForecast.forecastPeriod')} dataIndex="forecast_period" />
                )}
                {currentDemand.demand_type === 'sales_order' && (
                  <>
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.orderDate')} dataIndex="order_date" valueType="date" />
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.deliveryDate')} dataIndex="delivery_date" valueType="date" />
                  </>
                )}
                <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.customerName')} dataIndex="customer_name" />
                {currentDemand.demand_type === 'sales_order' && (
                  <>
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.salesman')} dataIndex="salesman_name" />
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.shippingAddress')} dataIndex="shipping_address" span={3} />
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.shippingMethod')}>
                      {getDictLabel(dictLabelMap, 'SHIPPING_METHOD', currentDemand.shipping_method)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.paymentTerms')}>
                      {getDictLabel(dictLabelMap, 'PAYMENT_TERMS', currentDemand.payment_terms)}
                    </ProDescriptions.Item>
                  </>
                )}
                <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.totalQuantity')} dataIndex="total_quantity" />
                <ProDescriptions.Item label={t('common.status')}>
                  {(() => {
                    const lifecycle = getDemandLifecycle(currentDemand);
                    return (
                      <Tag {...getDocumentLifecycleStageTagProps(lifecycle.stageName)}>
                        {lifecycle.stageName}
                      </Tag>
                    );
                  })()}
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaizhizao.salesOrder.notes')} dataIndex="notes" span={3} />
              </ProDescriptions>
            </DetailDrawerSection>

            <DetailDrawerSection title={buildDemandLifecycleSectionTitle(currentDemand, t)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lifecycle = getDemandLifecycle(currentDemand);
                  const mainStages = lifecycle.mainStages ?? [];
                  const hasStepper = mainStages.length > 0;
                  return (
                    <>
                      {mainStages.length > 0 && (
                        <UniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                          hideNextStepSuggestions
                        />
                      )}
                      {!hasStepper && (
                        <Typography.Text type="secondary">{t('app.kuaizhizao.demandManagement.lifecycleEmpty')}</Typography.Text>
                      )}
                    </>
                  );
                })()}
                {currentDemand.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="demand"
                    documentId={currentDemand.id}
                    active={drawerVisible}
                    selfDocumentId={currentDemand.id}
                    renderBriefActions={(doc) => (
                      <WarehouseTraceBriefPrimaryActions
                        doc={doc}
                        t={t}
                        navigate={navigate}
                        closeDrawer={() => {
                          setDrawerVisible(false);
                        }}
                      />
                    )}
                  />
                ) : null}
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
              <style>{`
                .demand-detail-items .ant-table-wrapper .ant-table-body,
                .demand-detail-items .ant-table-wrapper .ant-table-content {
                  overflow: visible !important;
                }
                .demand-detail-items .ant-table-thead > tr > th {
                  white-space: nowrap !important;
                }
              `}</style>
              {currentDemand.items && currentDemand.items.length > 0 ? (
                <div
                  className="demand-detail-items"
                  style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                >
                  <Table<DemandItem>
                    size="small"
                    tableLayout="fixed"
                    style={{ minWidth: 1100 }}
                    columns={detailItemColumns(currentDemand.demand_type)}
                    dataSource={currentDemand.items}
                    pagination={false}
                    bordered
                    rowKey="id"
                  />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
              <Tabs
                tabPosition="left"
                size="small"
                style={{ minHeight: 120 }}
                items={[
                  {
                    key: 'timeline',
                    label: t('app.uniDetail.sectionTimeline'),
                    children: (
                      <div style={{ paddingLeft: 8, minHeight: 80 }}>
                        {demandTracking.loading && <Spin size="small" />}
                        {demandTracking.error && <Typography.Text type="danger">{demandTracking.error}</Typography.Text>}
                        {demandTracking.data && <DocumentTrackingTimelineBody data={demandTracking.data} />}
                      </div>
                    ),
                  },
                  {
                    key: 'recalc',
                    label: t('app.kuaizhizao.demandManagement.recalcHistory'),
                    children: (
                      <div style={{ paddingLeft: 8, overflowX: 'auto' }}>
                        <Table<DemandRecalcHistoryItem>
                          size="small"
                          loading={recalcHistoryLoading}
                          dataSource={recalcHistory}
                          rowKey="id"
                          columns={recalcHistoryColumns}
                          pagination={false}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'snapshots',
                    label: t('app.kuaizhizao.demandManagement.changeSnapshots'),
                    children: (
                      <div style={{ paddingLeft: 8, overflowX: 'auto' }}>
                        <Table<DemandSnapshotItem>
                          size="small"
                          loading={snapshotsLoading}
                          dataSource={snapshots}
                          rowKey="id"
                          expandable={{
                            expandedRowRender: (record) => (
                              <div style={{ padding: 8 }}>
                                {record.demand_snapshot && (
                                  <div style={{ marginBottom: 12 }}>
                                    <strong>{t('app.kuaizhizao.demandManagement.snapshotBeforeDemand')}</strong>
                                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                      {JSON.stringify(record.demand_snapshot, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {record.demand_items_snapshot && record.demand_items_snapshot.length > 0 && (
                                  <>
                                    <strong>{t('app.kuaizhizao.demandManagement.snapshotBeforeItems')}</strong>
                                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                      {JSON.stringify(record.demand_items_snapshot, null, 2)}
                                    </pre>
                                  </>
                                )}
                                {!record.demand_snapshot && (!record.demand_items_snapshot || record.demand_items_snapshot.length === 0) && (
                                  <span style={{ color: '#999' }}>{t('app.kuaizhizao.demandManagement.noDetailData')}</span>
                                )}
                              </div>
                            ),
                          }}
                          columns={snapshotColumns}
                          pagination={false}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>
          </div>
        )}
      </DetailDrawerTemplate>
    </>
  );
};

export default DemandManagementPage;
