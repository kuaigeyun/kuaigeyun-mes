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

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Row, Col, Table, Input, InputNumber, Alert, Spin, Form as AntForm, DatePicker, Typography, Tooltip, Dropdown, Empty, theme as AntdTheme, Switch } from 'antd';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  listDemands,
  getDemand,
  createDemand,
  updateDemand,
  deleteDemand,
  pushDemandToComputation,
  previewPushDemandToComputation,
  withdrawDemandFromComputation,
  type DemandPushPreviewResponse,
  getDemandStatistics,
  Demand,
  DemandStatus,
  ReviewStatus,
} from '../../../services/demand';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { demandPushCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import {
  EyeOutlined,
  EditOutlined,
  ArrowDownOutlined,
  RollbackOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_BADGE_DATE_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { MarkerTag } from '../../../../../constants/statusBadges';
import {
  getDemandLifecycle,
  buildDemandPlanLifecycleValueEnum,
  resolveDemandPlanListLifecycleParams,
  LIST_LIFECYCLE_STAGE_FIELD,
} from '../../../utils/demandLifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../../sales-management/shared/documentLineMaterialsPreview';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import {
  collectComputationPushDocuments,
  demandComputationPushPercent,
} from '../../sales-management/shared/pushProgress';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { buildDemandBusinessModeValueEnum, translateDemandBusinessMode, renderDemandBusinessModeMarkerTag } from '../../../utils/businessMode';
import { getDemandTypeTagProps, translateDemandType } from '../../../utils/demandType';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { formatDateTime as formatDateTimeValue, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { DemandDetailDrawer, DEMAND_WORKFLOW_PROPS } from './components/DemandDetailDrawer';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
const DEMAND_RESOURCE = 'kuaizhizao:demand';

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
  const { message: messageApi, modal: modalApi } = App.useApp();

  const formatDemandTypeLabel = useCallback(
    (v: string | undefined | null) => translateDemandType(t, v),
    [t]
  );

  const formatBusinessModeLabel = useCallback(
    (mode: string | undefined | null) => translateDemandBusinessMode(t, mode),
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
  /** 列表当前页数据（唯一源：UniTable onTableDataChange，与表格展示一致） */
  const [tableDemands, setTableDemands] = useState<Demand[]>([]);
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
  const [demandTrackingRefreshKey, setDemandTrackingRefreshKey] = useState(0);

  // 需求计划页仅管理手工需求计划（demand_plan）
  const demandType = 'demand_plan' as const;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);
  const [pushPreviewData, setPushPreviewData] = useState<DemandPushPreviewResponse | null>(null);
  const [pushPreviewDemandId, setPushPreviewDemandId] = useState<number | null>(null);
  const [pushSelectedItemIds, setPushSelectedItemIds] = useState<number[]>([]);
  useNewShortcut(() => setCreatePlanModalVisible(true));

  const selectedDemandsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableDemands.find((row) => Number(row.id) === Number(key)))
        .filter((row): row is Demand => row != null),
    [selectedRowKeys, tableDemands],
  );
  const selectedDemandForPush = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    return selectedDemandsForBatch[0] ?? null;
  }, [selectedDemandsForBatch, selectedRowKeys.length]);

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
      const row = tableDemands.find((d) => Number(d.id) === id);
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

  const resetPushPreviewModal = useCallback(() => {
    setPushPreviewOpen(false);
    setPushPreviewData(null);
    setPushPreviewDemandId(null);
    setPushSelectedItemIds([]);
  }, []);

  const refreshDemandAfterPush = useCallback(
    (id: number) => {
      invalidateStatistics();
      actionRef.current?.reload();
      if (currentDemand?.id === id) {
        void getDemand(id)
          .then((updated) => setCurrentDemand(updated))
          .catch(() => {});
        setDemandTrackingRefreshKey((k) => k + 1);
      }
    },
    [currentDemand?.id],
  );

  const showDemandPushPreview = useCallback(
    (id: number) => {
      setPushPreviewOpen(true);
      setPushPreviewLoading(true);
      setPushPreviewConfirming(false);
      setPushPreviewData(null);
      setPushPreviewDemandId(id);
      setPushSelectedItemIds([]);
      previewPushDemandToComputation(id)
        .then((res) => {
          setPushPreviewData(res);
          const ids = (res.items || [])
            .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
            .map((row) => Number(row.item_id));
          setPushSelectedItemIds(ids);
        })
        .catch((error: any) => {
          messageApi.error(error?.message || error?.detail || t('app.kuaizhizao.demandManagement.pushPreviewFailed'));
          resetPushPreviewModal();
        })
        .finally(() => setPushPreviewLoading(false));
    },
    [messageApi, resetPushPreviewModal, t],
  );

  const handlePushPreviewConfirm = useCallback(async () => {
    if (!pushPreviewDemandId || !pushPreviewData) return;
    if (pushPreviewData.has_blocking_issues) return;
    const pushableIds = (pushPreviewData.items || [])
      .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
      .map((row) => Number(row.item_id));
    if (!pushableIds.length) {
      messageApi.warning(t('app.kuaizhizao.demandManagement.pushPreviewNoLines'));
      return;
    }
    setPushPreviewConfirming(true);
    try {
      const result = await pushDemandToComputation(pushPreviewDemandId);
      messageApi.success(result.message || t('app.kuaizhizao.demandManagement.pushSuccess'));
      refreshDemandAfterPush(pushPreviewDemandId);
      resetPushPreviewModal();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.pushFailed'));
    } finally {
      setPushPreviewConfirming(false);
    }
  }, [
    messageApi,
    pushPreviewData,
    pushPreviewDemandId,
    refreshDemandAfterPush,
    resetPushPreviewModal,
    t,
  ]);

  const handlePushToComputation = useCallback(
    (id: number) => {
      showDemandPushPreview(id);
    },
    [showDemandPushPreview],
  );

  const executeWithdrawFromComputation = async (id: number) => {
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
  };

  const handleWithdrawFromComputation = (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.demandManagement.withdrawTitle'),
      content: t('app.kuaizhizao.demandManagement.withdrawConfirm'),
      onOk: () => executeWithdrawFromComputation(id),
    });
  };

  const demandCanPushToComputation = useCallback((record: Demand) => {
    return !record.pushed_to_computation && isDemandAuditedAndApproved(record);
  }, []);

  const demandCanWithdrawComputation = useCallback((record: Demand) => {
    return record.pushed_to_computation === true;
  }, []);
  const demandToolbarPushMenuItems = useMemo(
    () => {
      const pushDisabledReason =
        selectedDemandForPush && !demandCanPushToComputation(selectedDemandForPush)
          ? selectedDemandForPush.pushed_to_computation
            ? t('app.kuaizhizao.demandManagement.alreadyPushed')
            : t('components.uniPush.disabled.unavailable')
          : undefined;
      const withdrawDisabledReason =
        selectedDemandForPush && !demandCanWithdrawComputation(selectedDemandForPush)
          ? t('app.kuaizhizao.demandManagement.notPushedYet')
          : undefined;
      return buildUniPushMenuItems([
        {
          key: 'push-to-computation',
          label: pushToComputationAction.label,
          disabled: !selectedDemandForPush || !demandCanPushToComputation(selectedDemandForPush),
          title: pushDisabledReason,
          onClick: () => {
            if (selectedDemandForPush?.id != null && demandCanPushToComputation(selectedDemandForPush)) {
              void handlePushToComputation(selectedDemandForPush.id);
            }
          },
        },
        { type: 'divider' as const },
        {
          key: 'withdraw-computation',
          label: t('app.kuaizhizao.demandManagement.withdrawPush'),
          disabled: !selectedDemandForPush || !demandCanWithdrawComputation(selectedDemandForPush),
          title: withdrawDisabledReason,
          onClick: () => {
            if (selectedDemandForPush?.id != null && demandCanWithdrawComputation(selectedDemandForPush)) {
              void handleWithdrawFromComputation(selectedDemandForPush.id);
            }
          },
        },
      ]);
    },
    [
      demandCanPushToComputation,
      demandCanWithdrawComputation,
      handlePushToComputation,
      handleWithdrawFromComputation,
      pushToComputationAction.label,
      selectedDemandForPush,
      t,
    ],
  );
  const demandToolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) return t('app.kuaizhizao.demandComputation.selectOneFirst');
    if (selectedRowKeys.length > 1) return t('app.kuaizhizao.demandComputation.pushSingleOnly');
    if (!selectedDemandForPush) return t('app.kuaizhizao.demandComputation.selectedNotInList');
    return undefined;
  }, [selectedDemandForPush, selectedRowKeys.length, t]);
  const createPlanButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.demandManagement.createPlan')),
    [t],
  );
  const demandAuditEnabled = useAuditRequired('demand', false);
  const demandPerms = useResourcePermissions(DEMAND_RESOURCE);
  const demandAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('demand'),
    [],
  );
  const handleDemandAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateStatistics();
    actionRef.current?.reload();
  }, [invalidateStatistics]);
  const demandAuditColumn = useMemo(
    () => createListAuditPhaseColumn<Demand>({ t, auditEnabled: demandAuditEnabled }),
    [t, demandAuditEnabled],
  );
  const demandPlanLifecycleValueEnum = useMemo(
    () => buildDemandPlanLifecycleValueEnum(t),
    [t],
  );

  const columns: ProColumns<Demand>[] = useMemo(
    () => alignProColumns<Demand>([
    {
      title: t('app.kuaizhizao.salesForecast.startDate'),
      dataIndex: 'start_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
      search: {
        transform: (value: unknown) => {
          if (!value || !Array.isArray(value)) return {};
          const [a, b] = value;
          return {
            start_date_from: a ? formatDateTimeValue(a, 'YYYY-MM-DD') : undefined,
            start_date_to: b ? formatDateTimeValue(b, 'YYYY-MM-DD') : undefined,
          };
        },
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.demandManagement.colDemandPrimary'),
      key: 'demand_code',
      dataIndex: 'demand_code',
      width: 240,
      minWidth: 240,
      uniTableKeepWidth: true,
      uniTablePrimaryFlex: false,
      resizable: false,
      fixed: 'left',
      sorter: true,
      hideInSearch: false,
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
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.demandManagement.demandName'),
      dataIndex: 'demand_name',
      hideInTable: true,
      hideInSearch: false,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.demandManagement.demandType'),
      dataIndex: 'demand_type',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      hideInTable: true,
      hideInSearch: true,
      sorter: true,
      render: (_: unknown, record: Demand) => (
        <MarkerTag {...getDemandTypeTagProps(record.demand_type)}>
          {formatDemandTypeLabel(record.demand_type)}
        </MarkerTag>
      ),
    },
    {
      title: t('app.kuaizhizao.demandManagement.businessMode'),
      dataIndex: 'business_mode',
      // 「按库存生产 (MTS)」等长文案，勿用 80px Marker 定宽
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: false,
      sorter: true,
      hideInSearch: false,
      valueEnum: buildDemandBusinessModeValueEnum((mode) => {
        if (mode === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMts');
        if (mode === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMto');
        return t('app.kuaizhizao.demandManagement.businessModeAto');
      }),
      render: (_: unknown, record: Demand) =>
        renderDemandBusinessModeMarkerTag(t, record.business_mode),
    },
    {
      title: t('app.kuaizhizao.common.colLineMaterials'),
      ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
      render: (_: unknown, record: Demand) =>
        renderDocumentLineMaterialsPreview(record.items, t),
    },
    {
      title: t('app.kuaizhizao.salesOrder.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: formatQuantity,
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'computation_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_: unknown, record: Demand) => {
        const percent = demandComputationPushPercent(record.pushed_to_computation);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.computationTooltip', {
              percent,
              status: percent >= 100
                ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
            })}
            documents={collectComputationPushDocuments(
              record.computation_code,
              t('components.documentTrackingPanel.docType.demand_computation'),
            )}
            formatMoreDocs={(count) =>
              t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
            }
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.salesForecast.startDate'),
      key: 'start_end_date_stacked',
      dataIndex: 'start_date',
      ...UNI_TABLE_STACKED_BADGE_DATE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_: unknown, record: Demand) => {
        const startDateText = record.start_date ? formatDateTimeValue(record.start_date, 'YYYY-MM-DD') : '-';
        const endDateText = record.end_date ? formatDateTimeValue(record.end_date, 'YYYY-MM-DD') : '-';
        return (
          <UniTableStackedPrimaryCell
            primary={startDateText}
            secondary={endDateText}
            secondaryCopyable={false}
            uniformText
            primaryBadge={t('common.start')}
            secondaryBadge={t('common.end')}
          />
        );
      },
    },
    ...buildDocumentAuditColumns<Demand>(t),
    ...(demandAuditColumn ? [demandAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      key: 'lifecycle',
      fixed: 'right' as const,
      hideInSearch: false,
      valueEnum: demandPlanLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getDemandLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
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
            <ActionConfirmPopconfirm title={t('app.kuaizhizao.demandManagement.withdrawTitle')} description={t('app.kuaizhizao.demandManagement.withdrawConfirm')} onConfirm={() => executeWithdrawFromComputation(record.id!)}>
              <Button {...rowActionKind('revoke')}
              key="withdraw-push"
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={(e) => e.stopPropagation()}
            >
              {t('app.kuaizhizao.demandManagement.withdrawPush')}
            </Button>
            </ActionConfirmPopconfirm>
          );
        }
        parts.push(
          <UniWorkflowActions {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.demandManagement.entityName')}
            {...DEMAND_WORKFLOW_PROPS}
            theme="link"
            size="small"
            onSuccess={() => {
              invalidateStatistics();
    actionRef.current?.reload();
              if (drawerVisible && currentDemand?.id === record.id && record.id != null) {
                void getDemand(record.id, true, false)
                  .then((updated) => {
                    setCurrentDemand(updated);
                    setDemandTrackingRefreshKey((k) => k + 1);
                  })
                  .catch(() => {});
              }
            }}
          />
        );
        return parts;
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, formatDemandTypeLabel, handleDelete, handleDetail, handleEdit, demandCanWithdrawComputation, executeWithdrawFromComputation, demandAuditColumn, demandPlanLifecycleValueEnum, drawerVisible, currentDemand?.id]
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
                  tableSearchFormRef.current?.setFieldsValue?.({
                    [LIST_LIFECYCLE_STAGE_FIELD]: '待审核',
                  });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        { title: t('app.kuaizhizao.salesOrder.lifecycleAudited'), value: statistics.audited_count },
        { title: t('app.kuaizhizao.demandManagement.statPushed'), value: statistics.pushed_count },
      ]
    : [
        { title: t('app.kuaizhizao.demandManagement.statActive'), value: 0 },
        { title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'), value: 0 },
        { title: t('app.kuaizhizao.salesOrder.lifecycleAudited'), value: 0 },
        { title: t('app.kuaizhizao.demandManagement.statPushed'), value: 0 },
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

  const createPlanItemColumns = [
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
        title: t('common.quantity'),
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
            <InputNumber placeholder={t('common.quantity')} min={0} precision={4} style={{ width: '100%' }} size="small" />
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
    ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<Demand>
          columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-management-width-v2"
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.demandManagement)}
          headerTitle={t('app.kuaizhizao.demandManagement.title')}
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const s = (searchFormValues ?? {}) as Record<string, unknown>;
            const lifecycleParams = resolveDemandPlanListLifecycleParams(s, params as Record<string, unknown>);
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

            const apiParams: Parameters<typeof listDemands>[0] = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              demand_type: 'demand_plan',
              ...lifecycleParams,
              order_by: orderBy,
              business_mode: s.business_mode as Demand['business_mode'],
              start_date_from: s.start_date_from as string | undefined,
              start_date_to: s.start_date_to as string | undefined,
              include_items: true,
            };

            if (fuzzyKeyword) {
              apiParams.keyword = fuzzyKeyword;
            } else {
              if (s.demand_code != null && String(s.demand_code).trim()) {
                apiParams.demand_code = String(s.demand_code).trim();
              }
              if (s.demand_name != null && String(s.demand_name).trim()) {
                apiParams.demand_name = String(s.demand_name).trim();
              }
            }

            const createdRange = s.created_at_range as [unknown, unknown] | undefined;
            if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
              apiParams.created_start_date = formatDateTimeValue(
                createdRange[0] as string | Date,
                'YYYY-MM-DD',
              );
              apiParams.created_end_date = createdRange[1]
                ? formatDateTimeValue(createdRange[1] as string | Date, 'YYYY-MM-DD')
                : apiParams.created_start_date;
            }

            try {
              const response = await listDemands(apiParams);
              // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
              const rows = response.data || [];
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
          onTableDataChange={setTableDemands}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={demandPlanLifecycleValueEnum}
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
              disabled={selectedRowKeys.length !== 1 || !selectedDemandForPush}
              disabledReason={demandToolbarPushDisabledReason}
            />,
          ]}
          showEditButton={false}
          showDeleteButton={true}
          onDelete={handleDelete}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="demand-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedDemandsForBatch}
              auditEnabled={demandAuditEnabled}
              permGates={demandPerms}
              handlers={demandAuditBatchHandlers}
              onSuccess={handleDemandAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items = await fetchAllListItems((p) => listDemands({ ...p, demand_type: 'demand_plan' }));
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Demand) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `demands-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
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
            <ProFormTextArea name="notes" label={t('common.remark')} fieldProps={{ rows: 2 }} />
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
                  label={t('common.remark')}
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
                  label={t('common.remark')}
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
        </ProForm>
      </Modal>

      <DemandDetailDrawer
        open={drawerVisible}
        zIndex={demandDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
        }}
        demand={currentDemand}
        trackingRefreshKey={demandTrackingRefreshKey}
        extra={
          currentDemand && (
            <Space size="small">
              {demandCanWithdrawComputation(currentDemand) ? (
                <ActionConfirmPopconfirm
                  title={t('app.kuaizhizao.demandManagement.withdrawTitle')}
                  description={t('app.kuaizhizao.demandManagement.withdrawConfirm')}
                  onConfirm={() => executeWithdrawFromComputation(currentDemand.id!)}
                >
                  <Button icon={<RollbackOutlined />} onClick={(e) => e.stopPropagation()}>
                    {t('app.kuaizhizao.demandManagement.withdrawPush')}
                  </Button>
                </ActionConfirmPopconfirm>
              ) : null}
              {(isDemandDraft(currentDemand) || isDemandPendingReview(currentDemand)) ? (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDrawerVisible(false);
                    handleEdit([currentDemand.id!]);
                  }}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
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
              <UniWorkflowActions
                {...rowActionKind('skip')}
                record={currentDemand}
                entityName={t('app.kuaizhizao.demandManagement.entityName')}
                {...DEMAND_WORKFLOW_PROPS}
                theme="default"
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
            </Space>
          )
        }
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
        onWorkflowSuccess={() => {
          invalidateStatistics();
    actionRef.current?.reload();
          setDemandTrackingRefreshKey((k) => k + 1);
          if (currentDemand?.id) {
            void getDemand(currentDemand.id, true, false).then(setCurrentDemand);
          }
        }}
      />

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPreviewOpen}
        width={1100}
        onCancel={resetPushPreviewModal}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        confirmLoading={pushPreviewConfirming}
        onOk={handlePushPreviewConfirm}
        okButtonProps={{ disabled: pushPreviewLoading || !pushPreviewData || !!pushPreviewData?.has_blocking_issues }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.has_blocking_issues ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                title={
                  demandPushCapabilityReasonMessage(pushPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.demandManagement.pushBlockedStatus')
                }
              />
            ) : null}
            {pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  { title: t('app.kuaizhizao.quotation.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.quotation.colMaterialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.demandComputation.colRequiredQty'), dataIndex: 'quantity', width: 88, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 88, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 88, align: 'right' , render: formatQuantity },
                  {
                    title: t('app.kuaizhizao.quotation.colDeliveryDate'),
                    dataIndex: 'delivery_date',
                    width: 112,
                    render: (v: string) => (v ? v.slice(0, 10) : '-'),
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.demandManagement.pushPreviewNoLines')} />
            )}
            {pushPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default DemandManagementPage;
