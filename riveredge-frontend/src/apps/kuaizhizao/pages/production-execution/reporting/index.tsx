import { rowActionKind } from '../../../../../components/uni-action';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能；扫码报工见移动端 kiosk。
 * 新建报工须经加载选源 → 数量预览 → 录入表单，禁止手工选工单/工序。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormRadio,
  ProFormDigit,
  ProFormTextArea,
  ProFormItem,
  ProFormDependency,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Card,
  Row,
  Col,
  Spin,
  Descriptions,
  Typography,
  Empty,
  Table,
  Alert,
  theme as AntdTheme,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  WarningOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { DefectTypeFormModal } from '../../../../master-data/components/DefectTypeFormModal';
import {
  operationApi,
  unwrapProcessPagedList,
} from '../../../../master-data/services/process';
import type { DefectType } from '../../../../master-data/types/process';
import { reportingApi, workOrderApi, materialBindingApi, getReportingStatistics } from '../../../services/production';
import { getReportingLifecycle, reportingRecordUniAuditProps, buildReportingStatusValueEnum, resolveReportingListStatusParams } from '../../../utils/reportingLifecycle';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getSessionCurrentUser } from '../../../../../utils/sessionCurrentUser';
import { hasModulePermission } from '../../../../../utils/permissionContract';
import { useGlobalStore } from '../../../../../stores';
import type { User } from '../../../../../services/user';
import { getRemainingReportableQuantity, getStatusReportingCompleteQuantity, getReportableQuantityBreakdown, resolveDefaultReportingQuantityFields } from '../../../utils/workOrderReporting';
import { coerceReportingCreateStrings } from '../../../utils/reportingPayload';
import { resolveReportingWorkTimeForSubmit } from '../../../utils/reportingWorkTime';
import ReportableQuantityPanel from '../../../components/ReportableQuantityPanel';
import type { PushPreviewResponse } from '../../../services/sales-order';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import ReportingInboundWarehouseField from '../../../components/ReportingInboundWarehouseField';
import { ReportingWorkTimeFields } from '../../../components/ReportingWorkTimeFields';
import { ReportingProducerField } from '../../../components/ReportingProducerField';
import {
  isInboundWarehouseRequiredForLastOperation,
  resolveIsLastOperation,
  resolveLastInboundHint,
} from '../../../utils/reportingLastOperation';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import {formatDateTime, formatQuantity} from '../../../../../utils/format';
import {
  convertBaseQtyToProductionDisplay,
  convertProductionInputToBaseQty,
} from '../../../../../utils/materialScenarioUnit';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

const REPORTING_RESOURCE = 'kuaizhizao:production-execution-reporting';
const REPORTING_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_reporting_records';

/** 报工记录（后端返回 snake_case） */
interface ReportingRecord {
  id: number;
  work_order_code: string;
  work_order_name: string;
  operation_name: string;
  worker_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  /** 提交报工的用户姓名（代报工时为录入人） */
  recorded_by_name?: string | null;
  reported_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  work_hours: number;
  status: 'pending' | 'approved' | 'rejected';
  reported_at: string;
  remarks?: string;
  sop_parameters?: Record<string, any>;
  capabilities?: {
    approve?: { allowed: boolean; reason?: string | null };
    revoke_approval?: { allowed: boolean; reason?: string | null };
    print?: { allowed: boolean; reason?: string | null };
  };
  audit?: {
    entity_type?: string;
    phase?: string;
    enabled?: boolean;
    allowed_actions?: string[];
  };
  [key: string]: any; // 支持索引访问
}

interface PullReportingWorkOrderCandidate {
  id: number;
  code?: string;
  name?: string;
  product_name?: string;
  quantity?: number;
  status?: string;
  planned_start_date?: string;
  planned_end_date?: string;
}
interface PullReportingOperationCandidate extends PullReportingWorkOrderCandidate {
  pull_row_key: string;
  work_order_id: number;
  operation_id: number;
  operation_code?: string;
  operation_name?: string;
  operation_sequence?: number | string;
  reportable_quantity_cap?: number;
  reportable_quantity_pushed?: number;
  reportable_quantity_max?: number;
}

type OperationDefectOption = {
  label: string;
  value: string;
  code?: string;
  name?: string;
};

function getOperationDefectTypeOptions(operation: any): OperationDefectOption[] {
  const raw = operation?.defect_types ?? operation?.defectTypes ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d: any) => {
      const uuid = String(d.uuid || '').trim();
      const code = String(d.code || '').trim();
      const name = String(d.name || '').trim();
      return {
        label: `${name || code}${code ? ` (${code})` : ''}`.trim(),
        value: uuid || code || String(d.id ?? ''),
        code: code || undefined,
        name: name || undefined,
      };
    })
    .filter((o) => Boolean(o.value));
}

function buildReportingPullPreview(
  workOrder: {
    code?: string;
    name?: string;
    quantity?: number;
    product_unit?: string;
    unit_to_base_factor?: number;
    base_unit?: string;
  },
  operation: { operation_id?: number; operation_code?: string; operation_name?: string; name?: string },
  workOrderQuantity: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): PushPreviewResponse {
  const breakdown = getReportableQuantityBreakdown(operation, workOrderQuantity);
  const toDisplay = (baseQty: number) => convertBaseQtyToProductionDisplay(baseQty, workOrder);
  const unitSuffix = workOrder.product_unit ? ` ${workOrder.product_unit}` : '';
  const items = [
    {
      item_id: Number(operation.operation_id ?? 0),
      material_code: String(operation.operation_code ?? ''),
      material_name: String(operation.operation_name ?? operation.name ?? ''),
      quantity: toDisplay(breakdown.planCap),
      pushed_quantity: toDisplay(breakdown.operationCompleted),
      max_push_quantity: toDisplay(breakdown.effectiveRemaining),
    },
  ];
  let blockingReason: string | null = null;
  if (breakdown.effectiveRemaining <= 0) {
    blockingReason = t('app.kuaizhizao.workReporting.pullPreviewNoReportable');
  }
  return {
    target_type: 'reporting_record',
    summary: t('app.kuaizhizao.workReporting.pullPreviewSummary', {
      workOrderCode: workOrder.code ?? '',
      operationName: operation.operation_name ?? operation.name ?? '',
      max: `${toDisplay(breakdown.effectiveRemaining)}${unitSuffix}`,
    }),
    items,
    tip: t('app.kuaizhizao.workReporting.pullPreviewTip'),
    has_blocking_issues: !!blockingReason,
    blocking_reason: blockingReason,
  };
}

function normalizeReportingStatus(status?: string): string {
  return String(status ?? '').trim().toLowerCase();
}

const REPORTING_PENDING_STATUSES = ['pending', 'pending_approval', 'pending_review', '待审核'];
const REPORTING_APPROVED_STATUSES = ['approved', 'audited', 'confirmed', '已审核', '审核通过'];
const REPORTING_REJECTED_STATUSES = ['rejected', '已驳回'];

function isReportingPending(status?: string): boolean {
  return REPORTING_PENDING_STATUSES.includes(normalizeReportingStatus(status));
}

function isReportingApproved(status?: string): boolean {
  return REPORTING_APPROVED_STATUSES.includes(normalizeReportingStatus(status));
}

function isReportingRejected(status?: string): boolean {
  return REPORTING_REJECTED_STATUSES.includes(normalizeReportingStatus(status));
}

const REPORTING_DETAIL_BINDINGS_MIN_WIDTH = 1100;

function getReportingWorkOrderName(record: ReportingRecord): string {
  return String(record.work_order_name ?? record.workOrderName ?? '').trim() || '-';
}

/** 工单 name 可选；展示/报工落库时回退到产品名称或编码 */
function resolveWorkOrderDisplayName(workOrder?: {
  name?: string | null;
  product_name?: string | null;
  code?: string | null;
} | null): string {
  if (!workOrder) return '';
  return (
    String(workOrder.name ?? '').trim()
    || String(workOrder.product_name ?? '').trim()
    || String(workOrder.code ?? '').trim()
  );
}

function getReportingWorkOrderCode(record: ReportingRecord): string {
  return String(record.work_order_code ?? record.workOrderCode ?? '').trim() || '-';
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

/** 获取报工员工信息：优先使用工序派工的 assigned_worker，否则使用当前登录用户 */
const getWorkerInfo = (operation?: any, translate?: (key: string) => string) => {
  const user = getSessionCurrentUser();
  if (operation?.assigned_worker_id) {
    return {
      worker_id: operation.assigned_worker_id,
      worker_name: String(
        operation.assigned_worker_name || user?.full_name || user?.username || translate?.('app.kuaizhizao.workReporting.fallbackOperator') || '操作员'
      ),
    };
  }
  return {
    worker_id: user?.id ?? 0,
    worker_name: String(user?.full_name || user?.username || translate?.('app.kuaizhizao.workReporting.fallbackCurrentUser') || '当前用户'),
  };
};

/** 代报工：若选择了「生产人员」则以其为准，否则与 getWorkerInfo 一致 */
function resolveProductionWorker(
  operation: any,
  proxyUser: Pick<User, 'id' | 'full_name' | 'username'> | null | undefined,
  translate: (key: string) => string,
): { worker_id: number; worker_name: string } {
  const base = getWorkerInfo(operation, translate);
  if (proxyUser?.id) {
    return {
      worker_id: proxyUser.id,
      worker_name: String(proxyUser.full_name || proxyUser.username || base.worker_name),
    };
  }
  return base;
}

const ReportingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { token } = AntdTheme.useToken();
  const reportingDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<ReportingRecord[]>([]);
  const reportingPerms = useResourcePermissions(REPORTING_RESOURCE);
  const reportingAuditEnabled = useAuditRequired('reporting_record', false);
  const reportingAuditColumn = useMemo(
    () => createListAuditPhaseColumn<ReportingRecord>({ t, auditEnabled: reportingAuditEnabled }),
    [t, reportingAuditEnabled],
  );
  const reportingStatusValueEnum = useMemo(() => buildReportingStatusValueEnum(t), [t]);

  const reportingAuditBatchHandlers = useMemo(
    () => ({
      approve: (id: number) => reportingApi.approve(String(id)),
      revoke: (id: number) => reportingApi.revoke(String(id)),
    }),
    [],
  );

  const reportingAuditBatchBulkHandlers = useMemo(
    () => ({
      revoke: (ids: number[]) =>
        reportingApi.batchRevoke(ids.map(String)).then((res) => ({
          success_count: res.success,
          failed_count: res.failed,
        })),
    }),
    [],
  );

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [reportingDetail, setReportingDetail] = useState<ReportingRecord | null>(null);
  const [detailMaterialBindings, setDetailMaterialBindings] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ReportingRecord => row != null),
    [selectedRowKeys],
  );

  const [rpTrackingRefreshKey, setRpTrackingRefreshKey] = useState(0);

  const reportingTracking = useDocumentTracking(
    detailDrawerVisible && reportingDetail?.id ? 'reporting_record' : undefined,
    reportingDetail?.id,
    rpTrackingRefreshKey,
  );

  const { data: stats } = useQuery({
    queryKey: ['reportingStatistics'],
    queryFn: getReportingStatistics,
    staleTime: 0,
  });

  const statCards: StatCard[] = useMemo(() => {
    if (!stats) return [];
    return [
      {
        title: t('app.kuaizhizao.reporting.statCumulativeHours'),
        value: (stats.cumulative_hours ?? 0).toFixed(1),
        unit: 'h',
        trend: stats.trends?.hours,
        icon: <ClockCircleOutlined />,
      },
      {
        title: t('app.kuaizhizao.reporting.statEstimatedWages'),
        value: (stats.estimated_wages ?? 0).toLocaleString(),
        unit: '¥',
        trend: stats.trends?.wages,
        icon: <CheckCircleOutlined />,
      },
      {
        title: t('app.kuaizhizao.reporting.statEfficiency'),
        value: ((stats.efficiency ?? 0) * 100).toFixed(1) + '%',
        trend: stats.trends?.efficiency,
        icon: <CheckCircleOutlined />,
        color: 'green',
        subValue: stats.efficiency_yoy != null ? (stats.efficiency_yoy >= 0 ? '+' : '') + stats.efficiency_yoy + '%' : undefined,
        subLabel: t('app.kuaizhizao.reporting.statYoy'),
      },
      {
        title: t('app.kuaizhizao.reporting.statExceptionReports'),
        value: stats.exception_reports ?? 0,
        unit: t('app.kuaizhizao.reporting.statUnitItems'),
        icon: <WarningOutlined />,
        color: (stats.exception_reports ?? 0) > 0 ? 'red' : 'green',
      },
    ];
  }, [stats, t]);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['reportingStatistics'] });
  };

  const handleReportingBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    invalidateStatistics();
  }, [invalidateMenuBadgeCounts, invalidateStatistics]);

  const handleReportingWorkflowSuccess = useCallback(
    (record?: ReportingRecord) => {
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      invalidateStatistics();
      if (record?.id != null && reportingDetail?.id === record.id) {
        reportingApi
          .get(record.id.toString())
          .then((d) => {
            setReportingDetail(d as ReportingRecord);
            setRpTrackingRefreshKey((k) => k + 1);
          })
          .catch(() => {});
      }
    },
    [invalidateMenuBadgeCounts, invalidateStatistics, reportingDetail?.id],
  );

  // 报工Modal状态
  const [reportingModalVisible, setReportingModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  const {
    customFields: reportingFormCustomFields,
    customFieldValues: reportingFormCustomFieldValues,
    extractFormValues: extractReportingFormValues,
    saveCustomFieldValues: saveReportingCustomFieldValues,
    resetFieldValues: resetReportingFormFieldValues,
  } = useCustomFields({
    tableName: REPORTING_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: reportingModalVisible,
  });

  const {
    customFields: reportingListCustomFields,
    generateCustomFieldColumns: generateReportingCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichReportingRecordsWithCustomFields,
    customFieldValues: reportingDetailCustomFieldValues,
    loadFieldValuesForDetail: loadReportingFieldValuesForDetail,
    resetDetailFieldValues: resetReportingDetailFieldValues,
  } = useCustomFieldsForList<ReportingRecord>({ tableName: REPORTING_CUSTOM_FIELD_TABLE });

  const reportingCustomFieldColumns = generateReportingCustomFieldColumns();

  // 报废记录Modal状态
  const [scrapModalVisible, setScrapModalVisible] = useState(false);
  const [currentReportingRecord, setCurrentReportingRecord] = useState<ReportingRecord | null>(null);
  const scrapFormRef = useRef<any>(null);

  // 不良品记录Modal状态
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [currentReportingRecordForDefect, setCurrentReportingRecordForDefect] = useState<ReportingRecord | null>(null);
  const defectFormRef = useRef<any>(null);

  // 数据修正Modal状态
  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [currentReportingRecordForCorrect, setCurrentReportingRecordForCorrect] = useState<ReportingRecord | null>(null);
  const correctFormRef = useRef<any>(null);

  // 新建报工状态（工单、工序列表）
  const [reportWorkOrders, setReportWorkOrders] = useState<any[]>([]);
  const [reportOperations, setReportOperations] = useState<any[]>([]);
  const [reportWorkOrderId, setReportWorkOrderId] = useState<number | null>(null);
  const [reportOperationId, setReportOperationId] = useState<number | null>(null);
  const [createFormDefectOptions, setCreateFormDefectOptions] = useState<OperationDefectOption[]>([]);
  const [defectQuickAddOpen, setDefectQuickAddOpen] = useState(false);
  const { data: executionConfig } = useQuery({
    queryKey: ['workOrderExecutionConfig'],
    queryFn: () => workOrderApi.getExecutionConfig(),
    staleTime: 0,
  });

  const currentUser = useCurrentUser();
  const canProxyReporting = useMemo(
    () => hasModulePermission(currentUser ?? undefined, 'kuaizhizao:production-execution-reporting', 'assign'),
    [currentUser],
  );
  const createModalProxyWorkerRef = useRef<Pick<User, 'id' | 'full_name' | 'username'> | null>(null);
  const createModalTeamRef = useRef<{ id: number; name: string } | null>(null);

  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pullPreviewContext, setPullPreviewContext] = useState<{
    workOrder: any;
    operation: any;
    operations: any[];
  } | null>(null);

  const resetPullPreview = useCallback(() => {
    setPullPreviewOpen(false);
    setPullPreviewLoading(false);
    setPullPreviewData(null);
    setPullPreviewContext(null);
  }, []);

  const openReportingCreateFromPullContext = useCallback(
    (workOrder: any, operations: any[], operation: any) => {
      if (!workOrder?.id || !operation?.operation_id) return;
      formRef.current?.resetFields();
      setReportWorkOrders([workOrder]);
      setReportWorkOrderId(Number(workOrder.id));
      setReportOperations(operations);
      setReportOperationId(Number(operation.operation_id));
      setReportingModalVisible(true);
      // 表单字段在 Modal 挂载后的 effect 中写入，避免 formRef 尚未就绪
    },
    [],
  );

  const openReportingPullPreview = useCallback(
    async (workOrderId: number, operationId: number) => {
      if (!workOrderId || !operationId) return;
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewData(null);
      setPullPreviewContext(null);
      try {
        const [workOrder, operationsRes] = await Promise.all([
          workOrderApi.get(workOrderId.toString()),
          workOrderApi.getOperations(workOrderId.toString()),
        ]);
        const operations = Array.isArray(operationsRes)
          ? operationsRes
          : (operationsRes as any)?.data ?? (operationsRes as any)?.items ?? [];
        if (!Array.isArray(operations) || operations.length === 0) {
          messageApi.warning(t('app.kuaizhizao.workReporting.workOrderOrOperationMissing'));
          resetPullPreview();
          return;
        }
        const operation =
          operations.find((op: any) => Number(op.operation_id) === Number(operationId)) ?? null;
        if (!operation) {
          messageApi.warning(t('app.kuaizhizao.workReporting.workOrderOrOperationMissing'));
          resetPullPreview();
          return;
        }
        const planQty = Number(workOrder.quantity ?? 0) || 0;
        const preview = buildReportingPullPreview(workOrder, operation, planQty, t);
        setPullPreviewData(preview);
        setPullPreviewContext({ workOrder, operation, operations });
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.workReporting.pullPreviewFailed')));
        resetPullPreview();
      } finally {
        setPullPreviewLoading(false);
      }
    },
    [messageApi, resetPullPreview, t],
  );

  const handlePullPreviewConfirm = useCallback(() => {
    if (!pullPreviewContext || !pullPreviewData || pullPreviewData.has_blocking_issues) return;
    const { workOrder, operation, operations } = pullPreviewContext;
    resetPullPreview();
    openReportingCreateFromPullContext(workOrder, operations, operation);
  }, [openReportingCreateFromPullContext, pullPreviewContext, pullPreviewData, resetPullPreview]);

  const pullFromWorkOrderScopeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.workReporting.pullScopeReportable'), value: 'reportable' },
      { label: t('app.kuaizhizao.workReporting.pullScopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromWorkOrderQuery = useUniPullQuery<PullReportingOperationCandidate>({
    rowKey: 'pull_row_key',
    selectionType: 'radio',
    scopeOptions: pullFromWorkOrderScopeOptions,
    defaultScope: 'reportable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      const res = await reportingApi.listPullCandidates({
        keyword: keyword.trim() || undefined,
        scope: scope === 'all' ? 'all' : 'reportable',
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      const rows: PullReportingOperationCandidate[] = (res.data ?? []).map((row) => ({
        id: Number(row.work_order_id),
        code: row.code,
        name: row.name ?? undefined,
        product_name: row.product_name ?? undefined,
        quantity: Number(row.quantity ?? 0) || 0,
        planned_start_date: row.planned_start_date ?? undefined,
        pull_row_key: row.pull_row_key || `${row.work_order_id}-${row.operation_id}`,
        work_order_id: Number(row.work_order_id),
        operation_id: Number(row.operation_id),
        operation_code: row.operation_code ?? undefined,
        operation_name: row.operation_name ?? undefined,
        operation_sequence: row.operation_sequence ?? undefined,
        reportable_quantity_cap: Number(row.reportable_quantity_cap ?? 0) || 0,
        reportable_quantity_pushed: Number(row.reportable_quantity_pushed ?? 0) || 0,
        reportable_quantity_max: Number(row.reportable_quantity_max ?? 0) || 0,
      }));
      return {
        data: rows,
        total: Number(res.total ?? rows.length) || 0,
      };
    },
    isRowDisabled: (record) => Number(record.reportable_quantity_max ?? 0) <= 0,
    onConfirm: async (_selectedKeys, selectedRows) => {
      const selected = selectedRows[0];
      if (!selected?.work_order_id || !selected?.operation_id) {
        messageApi.warning(t('app.kuaizhizao.workReporting.formWorkOrderRequired'));
        return;
      }
      if (Number(selected.reportable_quantity_max ?? 0) <= 0) {
        messageApi.warning(t('app.kuaizhizao.workReporting.pullPreviewBlocked'));
        return;
      }
      pullFromWorkOrderQuery.closeModal();
      await openReportingPullPreview(selected.work_order_id, selected.operation_id);
    },
  });

  useEffect(() => {
    if (!reportingModalVisible || !canProxyReporting) {
      createModalProxyWorkerRef.current = null;
      createModalTeamRef.current = null;
      return;
    }
    if (!reportOperationId) {
      createModalProxyWorkerRef.current = null;
      createModalTeamRef.current = null;
      formRef.current?.setFieldsValue({
        proxy_worker_uuid: undefined,
        producer_mode: 'worker',
        report_team_id: undefined,
      });
      return;
    }
    const operation = (Array.isArray(reportOperations) ? reportOperations : []).find(
      (op: any) => Number(op.operation_id) === Number(reportOperationId),
    );
    if (!operation) return;
    const b = getWorkerInfo(operation, t);
    createModalProxyWorkerRef.current = { id: b.worker_id, full_name: b.worker_name, username: '' };
    createModalTeamRef.current = null;
    formRef.current?.setFieldsValue({
      proxy_worker_uuid: undefined,
      producer_mode: 'worker',
      report_team_id: undefined,
    });
  }, [reportingModalVisible, canProxyReporting, reportOperationId, reportOperations, t]);

  const reportSelectedOperation = useMemo(
    () =>
      (Array.isArray(reportOperations) ? reportOperations : []).find(
        (op: any) => Number(op.operation_id) === Number(reportOperationId),
      ),
    [reportOperations, reportOperationId],
  );

  useEffect(() => {
    if (!reportingModalVisible || !reportSelectedOperation) {
      setCreateFormDefectOptions([]);
      return;
    }
    setCreateFormDefectOptions(getOperationDefectTypeOptions(reportSelectedOperation));
  }, [reportingModalVisible, reportSelectedOperation]);

  const handleDefectTypeQuickCreated = useCallback(
    async (created: DefectType) => {
      const masterOpId = Number(reportSelectedOperation?.operation_id);
      const opCode = String(reportSelectedOperation?.operation_code || '').trim();
      const newUuid = String(created.uuid || '').trim();
      if (!newUuid) {
        messageApi.error(t('app.kuaizhizao.workReporting.defectBindOperationFailed'));
        return;
      }
      if (!masterOpId && !opCode) {
        messageApi.error(t('app.kuaizhizao.workReporting.defectBindOperationFailed'));
        return;
      }
      try {
        const listRes = await operationApi.list({
          code: opCode || undefined,
          keyword: opCode || undefined,
          limit: 20,
        });
        const items = unwrapProcessPagedList(listRes);
        const master =
          items.find((o) => Number(o.id) === masterOpId) ||
          items.find((o) => String(o.code || '').trim() === opCode) ||
          null;
        if (!master?.uuid) {
          throw new Error(t('app.kuaizhizao.workReporting.defectBindOperationFailed'));
        }
        const detail = await operationApi.get(master.uuid);
        const existing = (detail.defectTypes ?? detail.defect_types ?? [])
          .map((d) => String(d.uuid || '').trim())
          .filter(Boolean);
        const nextUuids = [...new Set([...existing, newUuid])];
        await operationApi.update(master.uuid, { defectTypeUuids: nextUuids });

        const opt: OperationDefectOption = {
          label: `${created.name || created.code || ''}${created.code ? ` (${created.code})` : ''}`.trim(),
          value: newUuid,
          code: created.code,
          name: created.name,
        };
        setCreateFormDefectOptions((prev) =>
          prev.some((p) => p.value === newUuid) ? prev : [...prev, opt],
        );
        setReportOperations((prev) =>
          prev.map((op) => {
            if (Number(op.operation_id) !== masterOpId) return op;
            const dts = [...(op.defect_types ?? op.defectTypes ?? [])];
            if (!dts.some((d: any) => String(d.uuid || '') === newUuid)) {
              dts.push({ uuid: newUuid, code: created.code, name: created.name });
            }
            return { ...op, defect_types: dts, defectTypes: dts };
          }),
        );
        formRef.current?.setFieldsValue({ defect_type: newUuid });
      } catch (err: unknown) {
        messageApi.error(
          getApiErrorMessage(err, t('app.kuaizhizao.workReporting.defectBindOperationFailed')),
        );
      }
    },
    [messageApi, reportSelectedOperation, t],
  );

  const reportIsLastOperation = useMemo(
    () => resolveIsLastOperation(reportSelectedOperation, reportOperations),
    [reportSelectedOperation, reportOperations],
  );

  const reportWarehouseRequired = useMemo(
    () =>
      isInboundWarehouseRequiredForLastOperation(
        reportIsLastOperation,
        executionConfig?.last_operation_auto_inbound_mode,
      ),
    [reportIsLastOperation, executionConfig?.last_operation_auto_inbound_mode],
  );

  const reportLastInboundHint = useMemo(() => {
    if (!reportIsLastOperation) return '';
    return resolveLastInboundHint(t, executionConfig?.last_operation_auto_inbound_mode);
  }, [reportIsLastOperation, executionConfig?.last_operation_auto_inbound_mode, t]);

  useEffect(() => {
    if (!reportingModalVisible || !reportIsLastOperation || !reportWorkOrderId) return;
    let cancelled = false;
    workOrderApi
      .getDefaultInboundWarehouse(String(reportWorkOrderId))
      .then((res) => {
        if (cancelled || !res?.warehouse_id) return;
        formRef.current?.setFieldsValue({
          inbound_warehouse_id: res.warehouse_id,
          inbound_warehouse_name: res.warehouse_name ?? undefined,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reportingModalVisible, reportIsLastOperation, reportWorkOrderId]);

  /**
   * 处理新建报工（打开加载选源）
   */
  const handleNewReporting = () => {
    pullFromWorkOrderQuery.openModal();
  };
  useNewShortcut(() => {
    void handleNewReporting();
  });
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.workReporting.createButton')),
    [t],
  );

  const reportSelectedWorkOrder = useMemo(
    () =>
      (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find(
        (wo: any) => Number(wo.id) === Number(reportWorkOrderId),
      ),
    [reportWorkOrders, reportWorkOrderId],
  );

  useEffect(() => {
    if (!reportingModalVisible || !reportOperationId || !reportWorkOrderId) return;
    const operation = (Array.isArray(reportOperations) ? reportOperations : []).find(
      (op: any) => Number(op.operation_id) === Number(reportOperationId),
    );
    const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find(
      (wo: any) => Number(wo.id) === Number(reportWorkOrderId),
    );
    if (!operation || !workOrder) return;
    const autoFillValues: Record<string, unknown> = {
      work_order_id: Number(workOrder.id),
      operation_id: Number(operation.operation_id),
    };
    if (operation.standard_time) {
      const qtyDisplay =
        Number(workOrder.display_quantity ?? workOrder.displayQuantity) ||
        convertBaseQtyToProductionDisplay(
          parseFloat(workOrder.quantity?.toString() || '0') || 0,
          workOrder,
        )
      autoFillValues.work_hours = parseFloat(operation.standard_time.toString()) * qtyDisplay
    }
    if (operation.reporting_type === 'quantity') {
      const remainingBase = getRemainingReportableQuantity(
        operation,
        parseFloat(workOrder.quantity?.toString() || '0') || 0,
      )
      const remaining = convertBaseQtyToProductionDisplay(remainingBase, workOrder)
      Object.assign(
        autoFillValues,
        resolveDefaultReportingQuantityFields(
          remaining,
          executionConfig?.default_reporting_quantity_mode,
        ),
      )
    }
    if (operation.reporting_type === 'status') {
      autoFillValues.completed_status = 'completed';
    }
    formRef.current?.setFieldsValue(autoFillValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportingModalVisible, reportOperationId, reportWorkOrderId, reportOperations, reportWorkOrders, executionConfig?.default_reporting_quantity_mode]);

  /**
   * 处理报工提交
   */
  const handleReportingSubmit = async (values: any) => {
    try {
      const { standardValues, customData } = extractReportingFormValues(values);
      const ensurePickingGate = async (workOrderId: number) => {
        if (!executionConfig?.require_confirmed_picking_before_reporting) return true;
        const status = await workOrderApi.getPickingConfirmationStatus(workOrderId.toString());
        if (!status?.has_confirmed_picking) {
          messageApi.warning(t('app.kuaizhizao.workReporting.pickingGateWarning'));
          return false;
        }
        return true;
      };

      // 加载锁定源以 state 为准（隐藏表单项可能是字符串或 Modal 挂载前未写入）
      const workOrderId = Number(reportWorkOrderId ?? standardValues.work_order_id);
      const operationId = Number(reportOperationId ?? standardValues.operation_id);
      const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find(
        (wo: any) => Number(wo.id) === workOrderId,
      );
      const operation = (Array.isArray(reportOperations) ? reportOperations : []).find(
        (op: any) => Number(op.operation_id) === operationId,
      );
      if (!workOrder || !operation || !Number.isFinite(workOrderId) || !Number.isFinite(operationId)) {
        messageApi.error(t('app.kuaizhizao.workReporting.workOrderOrOperationMissing'));
        return;
      }
      const canContinue = await ensurePickingGate(Number(workOrder.id));
      if (!canContinue) return;
      const producerMode =
        canProxyReporting && standardValues.producer_mode === 'team' ? 'team' : 'worker';
      const workTime = resolveReportingWorkTimeForSubmit(standardValues);
      const reportingData: any = {
        work_order_id: Number(workOrder.id),
        work_order_code: workOrder.code,
        work_order_name: resolveWorkOrderDisplayName(workOrder),
        operation_id: Number(operation.operation_id),
        operation_code: operation.operation_code,
        operation_name: operation.operation_name,
        status: 'pending',
        reported_at: workTime.reported_at,
        remarks: standardValues.remarks,
        work_hours: workTime.work_hours,
      };
      if (producerMode === 'team') {
        const team = createModalTeamRef.current;
        const teamId = Number(team?.id ?? standardValues.report_team_id);
        const teamName = String(team?.name || standardValues.report_team_name || '').trim();
        if (!Number.isFinite(teamId) || teamId <= 0 || !teamName) {
          messageApi.warning(t('app.kuaizhizao.workReporting.formWorkGroupRequired'));
          return;
        }
        reportingData.team_id = teamId;
        reportingData.team_name = teamName;
        reportingData.worker_name = teamName;
      } else {
        const { worker_id, worker_name } = resolveProductionWorker(
          operation,
          createModalProxyWorkerRef.current,
          t,
        );
        reportingData.worker_id = worker_id;
        reportingData.worker_name = worker_name;
      }
      if (operation.reporting_type === 'status') {
        const planQty = parseFloat(workOrder.quantity?.toString() || '0') || 0;
        const completeQty = getStatusReportingCompleteQuantity(operation, planQty);
        reportingData.reported_quantity = standardValues.completed_status === 'completed' ? completeQty : 0;
        reportingData.qualified_quantity = standardValues.completed_status === 'completed' ? completeQty : 0;
        reportingData.unqualified_quantity = 0;
      } else {
        const qq = Number(standardValues.qualified_quantity) || 0;
        const uq = Number(standardValues.unqualified_quantity) || 0;
        const rq = qq + uq;
        if (rq <= 0) {
          messageApi.warning(t('app.kuaizhizao.workReporting.quantityMustBePositive'));
          return;
        }
        const remBase = getRemainingReportableQuantity(
          operation,
          parseFloat(workOrder.quantity?.toString() || '0') || 0,
        )
        const rem = convertBaseQtyToProductionDisplay(remBase, workOrder)
        if (rq > rem + 1e-9) {
          messageApi.warning(
            t('apps.kuaizhizao.workOrder.quickReport.exceedEffectiveSubmit', {
              max: reportSelectedWorkOrder?.product_unit ? `${rem} ${reportSelectedWorkOrder.product_unit}` : rem,
            }),
          )
          return
        }
        if (uq > 0 && !standardValues.defect_type) {
          messageApi.warning(t('app.kuaizhizao.workOrder.kioskSelectDefectType'));
          return;
        }
        reportingData.reported_quantity = convertProductionInputToBaseQty(rq, workOrder)
        reportingData.qualified_quantity = convertProductionInputToBaseQty(qq, workOrder)
        reportingData.unqualified_quantity = convertProductionInputToBaseQty(uq, workOrder)
      }
      if (reportIsLastOperation) {
        if (reportWarehouseRequired && !standardValues.inbound_warehouse_id) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.workOrder.selectWarehouse'));
          return;
        }
        if (standardValues.inbound_warehouse_id) {
          reportingData.inbound_warehouse_id = Number(standardValues.inbound_warehouse_id);
          reportingData.inbound_warehouse_name = standardValues.inbound_warehouse_name
            ? String(standardValues.inbound_warehouse_name)
            : undefined;
        }
      }
      const created = await reportingApi.create(coerceReportingCreateStrings(reportingData, workOrder));
      const createdId = Number((created as { id?: number } | null)?.id);
      if (createdId && Object.keys(customData).length > 0) {
        await saveReportingCustomFieldValues(createdId, customData);
      }
      if (
        operation.reporting_type === 'quantity' &&
        Number(standardValues.unqualified_quantity) > 0 &&
        standardValues.defect_type &&
        createdId
      ) {
        const uq = Number(standardValues.unqualified_quantity) || 0;
        const selected =
          createFormDefectOptions.find((o) => o.value === standardValues.defect_type) ||
          getOperationDefectTypeOptions(operation).find((o) => o.value === standardValues.defect_type);
        try {
          await reportingApi.recordDefect(String(createdId), {
            defect_quantity: uq,
            defect_type: selected?.code || String(standardValues.defect_type),
            defect_reason: selected?.name || selected?.label || String(standardValues.defect_type),
            disposition: 'quarantine',
          });
        } catch (defectErr: unknown) {
          console.error(defectErr);
          messageApi.warning(t('app.kuaizhizao.workReporting.defectCreateAfterReportFailed'));
        }
      }
      messageApi.success(t('app.kuaizhizao.workReporting.createSuccess'));
      setReportingModalVisible(false);
      formRef.current?.resetFields();
      resetReportingFormFieldValues();
      setReportWorkOrders([]);
      setReportOperations([]);
      setReportWorkOrderId(null);
      setReportOperationId(null);
      setCreateFormDefectOptions([]);
      setDefectQuickAddOpen(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.workReporting.createFailed'));
      throw error;
    }
  };

  /**
   * 处理创建报废记录
   */
  const handleCreateScrap = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning(t('app.kuaizhizao.workReporting.noUnqualifiedForScrap'));
      return;
    }
    setCurrentReportingRecord(record);
    setScrapModalVisible(true);
    setTimeout(() => {
      scrapFormRef.current?.setFieldsValue({
        scrap_quantity: record.unqualified_quantity,
        scrap_type: 'other',
      });
    }, 100);
  };

  /**
   * 处理提交报废记录
   */
  const handleSubmitScrap = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecord?.id) {
        throw new Error(t('app.kuaizhizao.workReporting.recordNotFound'));
      }

      await reportingApi.recordScrap(currentReportingRecord.id.toString(), values);
      messageApi.success(t('app.kuaizhizao.workReporting.scrapCreateSuccess'));
      setScrapModalVisible(false);
      setCurrentReportingRecord(null);
      scrapFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.workReporting.scrapCreateFailed'));
      throw error;
    }
  };

  /**
   * 处理创建不良品记录
   */
  const handleCreateDefect = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning(t('app.kuaizhizao.workReporting.noUnqualifiedForDefect'));
      return;
    }
    setCurrentReportingRecordForDefect(record);
    setDefectModalVisible(true);
    setTimeout(() => {
      defectFormRef.current?.setFieldsValue({
        defect_quantity: record.unqualified_quantity,
        defect_type: 'other',
        disposition: 'quarantine',
      });
    }, 100);
  };

  /**
   * 处理提交不良品记录
   */
  const handleSubmitDefect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForDefect?.id) {
        throw new Error(t('app.kuaizhizao.workReporting.recordNotFound'));
      }

      await reportingApi.recordDefect(currentReportingRecordForDefect.id.toString(), values);
      messageApi.success(t('app.kuaizhizao.workReporting.defectCreateSuccess'));
      setDefectModalVisible(false);
      setCurrentReportingRecordForDefect(null);
      defectFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.workReporting.defectCreateFailed'));
      throw error;
    }
  };

  /**
   * 处理修正报工数据
   */
  const handleCorrectReporting = async (record: ReportingRecord) => {
    try {
      const detail = await reportingApi.get(record.id!.toString());
      setCurrentReportingRecordForCorrect(detail as ReportingRecord);
      setCorrectModalVisible(true);
      setTimeout(() => {
        correctFormRef.current?.setFieldsValue({
          reported_quantity: (detail as any).reported_quantity ?? (detail as any).reportedQuantity,
          qualified_quantity: (detail as any).qualified_quantity ?? (detail as any).qualifiedQuantity,
          unqualified_quantity: (detail as any).unqualified_quantity ?? (detail as any).unqualifiedQuantity,
          work_hours: (detail as any).work_hours ?? (detail as any).workHours,
          remarks: (detail as any).remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.workReporting.loadDetailFailed'));
    }
  };

  /**
   * 处理提交数据修正
   */
  const handleSubmitCorrect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForCorrect?.id) {
        throw new Error(t('app.kuaizhizao.workReporting.recordNotFound'));
      }

      if (!values.correction_reason || !values.correction_reason.trim()) {
        messageApi.error(t('app.kuaizhizao.workReporting.correctionReasonRequired'));
        throw new Error(t('app.kuaizhizao.workReporting.correctionReasonEmpty'));
      }

      const correctedId = currentReportingRecordForCorrect.id;

      const correctPayload = { ...values };
      const wh = correctPayload.work_hours;
      if (wh === undefined || wh === null || wh === '') {
        delete correctPayload.work_hours;
      } else {
        correctPayload.work_hours = Number(wh);
      }

      await reportingApi.correct(
        currentReportingRecordForCorrect.id.toString(),
        correctPayload
      );
      messageApi.success(t('app.kuaizhizao.workReporting.correctSuccess'));
      setCorrectModalVisible(false);
      setCurrentReportingRecordForCorrect(null);
      correctFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      invalidateStatistics();
      if (reportingDetail?.id === correctedId) {
        try {
          const fresh = await reportingApi.get(String(correctedId));
          setReportingDetail(fresh as ReportingRecord);
          setRpTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      if (error.message !== t('app.kuaizhizao.workReporting.correctionReasonEmpty')) {
        const detail = error?.response?.data?.detail;
        const msg =
          (typeof detail === 'string' ? detail : detail?.message) ||
          error?.message ||
          t('app.kuaizhizao.workReporting.correctFailed');
        messageApi.error(msg);
      }
      throw error;
    }
  };

  const handleDetail = async (record: ReportingRecord) => {
    try {
      const detail = await reportingApi.get(record.id!.toString());
      setReportingDetail(detail as ReportingRecord);
      setDetailDrawerVisible(true);
      setRpTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadReportingFieldValuesForDetail(record.id);
      }
      try {
        const bindings = await materialBindingApi.getByReportingRecord(String(record.id));
        setDetailMaterialBindings(Array.isArray(bindings) ? bindings : []);
      } catch {
        setDetailMaterialBindings([]);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.workReporting.loadDetailFailed'));
    }
  };

  const renderReportingRowActionNodes = (record: ReportingRecord): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const isPending = isReportingPending(record.status);
    const isApproved = isReportingApproved(record.status);
    const isRejected = isReportingRejected(record.status);
    nodes.push(
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        {t('common.detail')}
      </Button>
    );
    nodes.push(
      <span {...rowActionKind('skip')} key="wf" onClick={(e) => e.stopPropagation()}>
        <UniWorkflowActions
          {...rowActionKind('skip')}
          record={record}
          resourcePrefix={REPORTING_RESOURCE}
          entityName={t('app.kuaizhizao.workReporting.entityName')}
          {...reportingRecordUniAuditProps(record as unknown as Record<string, unknown>)}
          onSuccess={() => handleReportingWorkflowSuccess(record)}
        />
      </span>
    );
    if (isPending) {
      nodes.push(
        <Button {...rowActionKind('update')}
          key="corr"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            void handleCorrectReporting(record);
          }}
        >
          {t('app.kuaizhizao.workReporting.correct')}
        </Button>
      );
      nodes.push(
        <Button {...rowActionKind('delete')}
          key="del"
          type="link"
          size="small"
          danger
          onClick={(e) => {
            e.stopPropagation();
            Modal.confirm({
              title: t('app.kuaizhizao.workReporting.confirmDeleteTitle'),
              content: t('app.kuaizhizao.workReporting.confirmDeletePendingContent'),
              onOk: async () => {
                try {
                  await reportingApi.delete(record.id.toString());
                  messageApi.success(t('common.deleteSuccess'));
                  if (reportingDetail?.id === record.id) {
                    setDetailDrawerVisible(false);
                    setReportingDetail(null);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                  invalidateStatistics();
                } catch (error: any) {
                  messageApi.error(error.message || t('common.deleteFailed'));
                }
              },
            });
          }}
        >
          {t('common.delete')}
        </Button>
      );
    }
    if (isApproved) {
      if ((record.unqualified_quantity || 0) > 0) {
        nodes.push(
          <Button {...rowActionKind('create')}
            key="defect"
            type="link"
            size="small"
            style={{ color: '#faad14' }}
            onClick={(e) => {
              e.stopPropagation();
              handleCreateDefect(record);
            }}
          >
            {t('app.kuaizhizao.workReporting.defect')}
          </Button>
        );
        nodes.push(
          <Button {...rowActionKind('obsolete')}
            key="scrap"
            type="link"
            size="small"
            danger
            onClick={(e) => {
              e.stopPropagation();
              handleCreateScrap(record);
            }}
          >
            {t('app.kuaizhizao.workReporting.scrap')}
          </Button>
        );
      }
      nodes.push(
        <Button {...rowActionKind('update')}
          key="corr2"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            void handleCorrectReporting(record);
          }}
        >
          {t('app.kuaizhizao.workReporting.correct')}
        </Button>
      );
    }
    if (isRejected) {
      nodes.push(
        <Button {...rowActionKind('delete')}
          key="del2"
          type="link"
          size="small"
          danger
          onClick={(e) => {
            e.stopPropagation();
            Modal.confirm({
              title: t('app.kuaizhizao.workReporting.confirmDeleteTitle'),
              content: t('app.kuaizhizao.workReporting.confirmDeleteRejectedContent'),
              onOk: async () => {
                try {
                  await reportingApi.delete(record.id.toString());
                  messageApi.success(t('common.deleteSuccess'));
                  if (reportingDetail?.id === record.id) {
                    setDetailDrawerVisible(false);
                    setReportingDetail(null);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                  invalidateStatistics();
                } catch (error: any) {
                  messageApi.error(error.message || t('common.deleteFailed'));
                }
              },
            });
          }}
        >
          {t('common.delete')}
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportingRecord>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.workReporting.colReportedAt'),
      dataIndex: 'reported_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkOrderStacked'),
      key: 'workOrderStacked',
      dataIndex: 'work_order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      hideInSearch: false,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={getReportingWorkOrderName(record)}
          secondary={getReportingWorkOrderCode(record)}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkOrderCode'),
      dataIndex: 'work_order_code',
      hideInTable: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkOrderName'),
      dataIndex: 'work_order_name',
      hideInTable: true,
      hideInSearch: false,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colOperation'),
      dataIndex: 'operation_name',
      width: 120,
      ellipsis: true,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorker'),
      dataIndex: 'worker_name',
      width: 100,
      ellipsis: true,
      sorter: true,
      hideInSearch: false,
      render: (_, record) =>
        String(record.worker_name || record.team_name || '').trim() || '—',
    },
    {
      title: t('app.kuaizhizao.workReporting.colQualifiedQty'),
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <Typography.Text type="success">
          {formatQuantity(record.qualified_quantity ?? record.qualifiedQuantity)}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.workReporting.colUnqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <Typography.Text type="danger">
          {formatQuantity(record.unqualified_quantity ?? record.unqualifiedQuantity)}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.workReporting.colReportedQty'),
      dataIndex: 'reported_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkHours'),
      dataIndex: 'work_hours',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colReportedAt'),
      dataIndex: 'reported_at',
      width: 148,
      uniTableKeepWidth: true,
      sorter: true,
      defaultSortOrder: 'descend',
      hideInSearch: true,
      render: (_, record) => {
        const operator =
          String(record.recorded_by_name ?? '').trim() ||
          String(record.worker_name ?? '').trim() ||
          '-';
        const time = record.reported_at
          ? formatDateTime(record.reported_at, 'YYYY-MM-DD HH:mm')
          : '-';
        return (
          <UniTableStackedPrimaryCell
            primary={operator}
            secondary={time}
            secondaryCopyable={false}
            primaryBold={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.workReporting.colReviewStatus'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: reportingStatusValueEnum,
      hideInTable: true,
      hideInSearch: false,
    },
    ...(reportingAuditColumn ? [reportingAuditColumn] : []),
    ...reportingCustomFieldColumns,
    {
      title: t('common.actions'),
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderReportingRowActionNodes(record),
    },
  ], [t, reportingAuditColumn, reportingStatusValueEnum, reportingCustomFieldColumns]);


  const reportingDetailBaseColumns: ProDescriptionsItemProps<ReportingRecord>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workReporting.colWorkOrderCode'),
        dataIndex: 'work_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }}>{r.work_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.workReporting.colWorkOrderName'), dataIndex: 'work_order_name' },
      { title: t('app.kuaizhizao.workReporting.colOperation'), dataIndex: 'operation_name' },
      { title: t('app.kuaizhizao.workReporting.colWorker'), dataIndex: 'worker_name' },
      {
        title: t('app.kuaizhizao.workReporting.colRecordedBy'),
        dataIndex: 'recorded_by_name',
        render: (_: any, r: ReportingRecord) =>
          r.recorded_by_name || r.worker_name || '—',
      },
      {
        title: t('app.kuaizhizao.workReporting.colReviewStatus'),
        dataIndex: 'status',
        render: (s) => {
          const m: Record<string, { text: string; color: string }> = {
            pending: { text: t('app.kuaizhizao.workReporting.statusPending'), color: 'default' },
            approved: { text: t('app.kuaizhizao.workReporting.statusApproved'), color: 'success' },
            rejected: { text: t('app.kuaizhizao.workReporting.statusRejected'), color: 'error' },
          };
          const x = m[String(s)] || { text: String(s ?? '-'), color: 'default' };
          return <Tag color={x.color} variant="solid">{x.text}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.workReporting.colQualifiedQty'), dataIndex: 'qualified_quantity' },
      { title: t('app.kuaizhizao.workReporting.colUnqualifiedQty'), dataIndex: 'unqualified_quantity' },
      { title: t('app.kuaizhizao.workReporting.colReportedQty'), dataIndex: 'reported_quantity' },
      { title: t('app.kuaizhizao.workReporting.colWorkHours'), dataIndex: 'work_hours' },
      { title: t('app.kuaizhizao.workReporting.colReportedAt'), dataIndex: 'reported_at', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.workReporting.colApprovedAt'), dataIndex: 'approved_at', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.workReporting.colApprovedBy'), dataIndex: 'approved_by_name' },
      { title: t('app.kuaizhizao.workReporting.colRejectionReason'), dataIndex: 'rejection_reason', span: 3, render: (t: any) => t || '-' },
      {
        title: t('app.kuaizhizao.workReporting.colRemarks'),
        dataIndex: 'remarks',
        span: 3,
        render: (text: any) => text || '-',
      },
    ],
    [t]
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      <UniTable
        headerTitle={t('app.kuaizhizao.menu.production-execution.reporting')}
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.reporting.worker-qty-v2"
        actionRef={actionRef}
        rowKey="id"
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        pinnedTabsField="status"
        pinnedTabsValueEnum={reportingStatusValueEnum}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const s = (searchFormValues ?? {}) as Record<string, unknown>;
            const statusParams = resolveReportingListStatusParams(s);
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

            const apiParams: Parameters<typeof reportingApi.list>[0] = {
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              ...statusParams,
              order_by: orderBy,
              operation_name: s.operation_name as string | undefined,
              worker_name: s.worker_name as string | undefined,
            };

            if (fuzzyKeyword) {
              apiParams.keyword = fuzzyKeyword;
            } else {
              if (s.work_order_code != null && String(s.work_order_code).trim()) {
                apiParams.work_order_code = String(s.work_order_code).trim();
              }
              if (s.work_order_name != null && String(s.work_order_name).trim()) {
                apiParams.work_order_name = String(s.work_order_name).trim();
              }
            }

            const reportedRange = s.reported_at_range as [unknown, unknown] | undefined;
            if (reportedRange && Array.isArray(reportedRange) && reportedRange[0]) {
              apiParams.reported_at_start = formatDateTime(reportedRange[0] as string | Date, 'YYYY-MM-DD HH:mm:ss');
              apiParams.reported_at_end = reportedRange[1]
                ? formatDateTime(reportedRange[1] as string | Date, 'YYYY-MM-DD HH:mm:ss')
                : apiParams.reported_at_start;
            }

            const result = await reportingApi.list(apiParams);
            const raw = (result.data || []) as ReportingRecord[];
            const data = await enrichReportingRecordsWithCustomFields(raw);
            return {
              data,
              success: result.success,
              total: result.total || 0,
            };
          } catch (error: any) {
            messageApi.error(error.message || t('app.kuaizhizao.workReporting.listLoadFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={handleNewReporting}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await reportingApi.delete(String(id));
            }
            messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
            setSelectedRowKeys([]);
            if (reportingDetail?.id != null && keys.includes(reportingDetail.id)) {
              setDetailDrawerVisible(false);
              setReportingDetail(null);
            }
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
            invalidateStatistics();
          } catch (error: any) {
            messageApi.error(error.message || t('common.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.workReporting.deleteSelectedConfirm', { count })}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        toolBarActionsAfterDelete={[
          <UniAuditBatchMenuButton
            key="reporting-batch-audit-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={reportingAuditEnabled}
            permGates={reportingPerms}
            handlers={reportingAuditBatchHandlers}
            bulkHandlers={reportingAuditBatchBulkHandlers}
            onSuccess={handleReportingBatchSuccess}
            toolBarButtonSize="middle"
          />,
        ]}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.workReporting.createModalTitle')}
        open={reportingModalVisible}
        onClose={() => {
          setReportingModalVisible(false);
          formRef.current?.resetFields();
          resetReportingFormFieldValues();
          setReportWorkOrders([]);
          setReportOperations([]);
          setReportWorkOrderId(null);
          setReportOperationId(null);
          setCreateFormDefectOptions([]);
          setDefectQuickAddOpen(false);
        }}
        onFinish={handleReportingSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={true}
      >
        {!!reportLastInboundHint && (
          <Col span={24} style={{ marginBottom: 12 }}>
            <Alert type="info" showIcon message={reportLastInboundHint} />
          </Col>
        )}
        {reportSelectedWorkOrder && reportSelectedOperation ? (
          <>
            <Col span={24}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message={t('app.kuaizhizao.workReporting.formSourceLocked')}
              />
            </Col>
            <Col span={24}>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label={t('app.kuaizhizao.workReporting.colWorkOrderCode')}>
                    {reportSelectedWorkOrder.code || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.workReporting.colWorkOrderName')}>
                    {resolveWorkOrderDisplayName(reportSelectedWorkOrder) || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.workReporting.formOperation')} span={2}>
                    {`${reportSelectedOperation.operation_name || reportSelectedOperation.name || '—'} (${reportSelectedOperation.operation_code || '—'})`}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col span={24} style={{ marginBottom: 12 }}>
              <ReportableQuantityPanel
                operation={reportSelectedOperation}
                workOrderQuantity={Number(reportSelectedWorkOrder.quantity ?? 0) || 0}
                operations={reportOperations}
                workOrderId={reportWorkOrderId ?? undefined}
                unitContext={reportSelectedWorkOrder}
              />
            </Col>
          </>
        ) : null}
        <ProFormDigit name="work_order_id" hidden fieldProps={{ precision: 0 }} />
        <ProFormDigit name="operation_id" hidden fieldProps={{ precision: 0 }} />
        {canProxyReporting && (
          <Col span={24}>
            <ReportingProducerField
              colProps={{ span: 24 }}
              onWorkerChange={(u) => {
                createModalProxyWorkerRef.current = u;
              }}
              onTeamChange={(team) => {
                createModalTeamRef.current = team;
              }}
            />
            {currentUser ? (
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                {t('app.kuaizhizao.workReporting.formRecordedByLogin', { name: currentUser.full_name || currentUser.username || '—' })}
              </Typography.Text>
            ) : null}
          </Col>
        )}
        {(Array.isArray(reportOperations) ? reportOperations : []).find(
          (op: any) => Number(op.operation_id) === Number(reportOperationId),
        )?.reporting_type === 'status' ? (
          <ProFormRadio.Group
            name="completed_status"
            label={t('app.kuaizhizao.workReporting.formCompletedStatus')}
            rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formCompletedStatusRequired') }]}
            options={[
              { label: t('app.kuaizhizao.workReporting.formCompleted'), value: 'completed' },
              { label: t('app.kuaizhizao.workReporting.formIncomplete'), value: 'incomplete' },
            ]}
            colProps={{ span: 12 }}
          />
        ) : (
          <>
            <ProFormDigit
              name="qualified_quantity"
              label={
                reportSelectedWorkOrder?.product_unit
                  ? `${t('app.kuaizhizao.workReporting.colQualifiedQty')}（${reportSelectedWorkOrder.product_unit}）`
                  : t('app.kuaizhizao.workReporting.colQualifiedQty')
              }
              placeholder={t('app.kuaizhizao.workReporting.formQualifiedQtyRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formQualifiedQtyRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label={
                reportSelectedWorkOrder?.product_unit
                  ? `${t('app.kuaizhizao.workReporting.colUnqualifiedQty')}（${reportSelectedWorkOrder.product_unit}）`
                  : t('app.kuaizhizao.workReporting.colUnqualifiedQty')
              }
              placeholder={t('app.kuaizhizao.workReporting.unqualifiedQtyRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.unqualifiedQtyRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
              colProps={{ span: 12 }}
            />
            <ProFormDependency name={['qualified_quantity', 'unqualified_quantity']}>
              {({ qualified_quantity: qqIn, unqualified_quantity: uqIn }) => {
                const qq = Number(qqIn) || 0;
                const uq = Number(uqIn) || 0;
                const total = qq + uq;
                const remBase =
                  reportSelectedWorkOrder && reportSelectedOperation
                    ? getRemainingReportableQuantity(
                        reportSelectedOperation,
                        Number(reportSelectedWorkOrder.quantity ?? 0) || 0,
                      )
                    : 0;
                const rem = reportSelectedWorkOrder
                  ? convertBaseQtyToProductionDisplay(remBase, reportSelectedWorkOrder)
                  : remBase;
                const unitLabel = reportSelectedWorkOrder?.product_unit
                  ? ` ${reportSelectedWorkOrder.product_unit}`
                  : '';
                const over = total > rem + 1e-9;
                return (
                  <Col span={24} style={{ marginBottom: 16 }}>
                    <div>
                      <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                        {t('app.kuaizhizao.workReporting.formReportedQtyAuto')}
                      </span>
                      <span style={{ fontWeight: 600 }}>
                        {formatQuantity(total)}
                        {unitLabel}
                      </span>
                    </div>
                    {over ? (
                      <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                        {t('apps.kuaizhizao.workOrder.quickReport.exceedEffective', {
                          max: `${rem}${unitLabel}`,
                        })}
                      </Typography.Text>
                    ) : null}
                  </Col>
                );
              }}
            </ProFormDependency>
            <ProFormDependency name={['unqualified_quantity']}>
              {({ unqualified_quantity: uqIn }) => {
                const uq = Number(uqIn) || 0;
                if (uq <= 0 || !reportSelectedOperation) {
                  return null;
                }
                return (
                  <Col span={12}>
                    <ProFormItem
                      name="defect_type"
                      label={t('app.kuaizhizao.workReporting.defectReason')}
                      rules={[{ required: true, message: t('app.kuaizhizao.workReporting.defectTypeRequired') }]}
                    >
                      <UniDropdown
                        placeholder={t('app.kuaizhizao.workReporting.defectTypeRequired')}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        options={createFormDefectOptions}
                        style={{ width: '100%' }}
                        quickCreate={{
                          label: t('field.operation.quickAddDefectType'),
                          onClick: () => setDefectQuickAddOpen(true),
                        }}
                      />
                    </ProFormItem>
                  </Col>
                );
              }}
            </ProFormDependency>
          </>
        )}
        <ReportingWorkTimeFields />
        <ReportingInboundWarehouseField
          isLastOperation={reportIsLastOperation}
          warehouseRequired={reportWarehouseRequired}
        />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.workReporting.colRemarks')}
          placeholder={t('app.kuaizhizao.workReporting.formRemarksPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <CustomFieldsFormSection
          customFields={reportingFormCustomFields}
          customFieldValues={reportingFormCustomFieldValues}
          gridColumns={3}
        />
      </FormModalTemplate>

      {defectQuickAddOpen ? (
        <DefectTypeFormModal
          open
          onClose={() => setDefectQuickAddOpen(false)}
          editUuid={null}
          onSuccess={(created) => {
            void handleDefectTypeQuickCreated(created);
          }}
          zIndex={1000 + MODAL_NESTED_ABOVE_PARENT_OFFSET}
        />
      ) : null}

      <UniPullQueryModal<PullReportingOperationCandidate>
        open={pullFromWorkOrderQuery.open}
        title={t('app.kuaizhizao.workReporting.pullSelectSource')}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="pull_row_key"
        isRowDisabled={pullFromWorkOrderQuery.isRowDisabled}
        columns={[
          { title: t('app.kuaizhizao.workReporting.colWorkOrderCode'), dataIndex: 'code', width: 180, ellipsis: true },
          {
            title: t('app.kuaizhizao.workReporting.colWorkOrderName'),
            dataIndex: 'name',
            width: 220,
            ellipsis: true,
            render: (_, row) => resolveWorkOrderDisplayName(row) || '—',
          },
          {
            title: t('app.kuaizhizao.workReporting.formOperation'),
            key: 'operation_display',
            width: 220,
            ellipsis: true,
            render: (_, row) => `${row.operation_name || '-'} (${row.operation_code || '-'})`,
          },
          {
            title: t('app.kuaizhizao.workReporting.pullColPlanQty'),
            dataIndex: 'quantity',
            width: 100,
            align: 'right',
            render: formatQuantity,
          },
          {
            title: t('app.kuaizhizao.workReporting.pullColOverReportQty'),
            key: 'over_report_quantity',
            width: 110,
            align: 'right',
            render: (_, row) => {
              const plan = Number(row.quantity ?? 0) || 0;
              const cap = Number(row.reportable_quantity_cap ?? 0) || 0;
              return formatQuantity(Math.max(0, cap - plan));
            },
          },
          {
            title: t('app.kuaizhizao.workReporting.pullColReportCap'),
            dataIndex: 'reportable_quantity_cap',
            width: 100,
            align: 'right',
            render: formatQuantity,
          },
          {
            title: t('app.kuaizhizao.workReporting.pullColReported'),
            dataIndex: 'reportable_quantity_pushed',
            width: 100,
            align: 'right',
            render: formatQuantity,
          },
          {
            title: t('app.kuaizhizao.workReporting.pullColReportable'),
            dataIndex: 'reportable_quantity_max',
            width: 100,
            align: 'right',
            render: formatQuantity,
          },
          {
            title: t('app.kuaizhizao.workOrder.colPlannedStart'),
            dataIndex: 'planned_start_date',
            width: 160,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
        ]}
        dataSource={pullFromWorkOrderQuery.dataSource}
        loading={pullFromWorkOrderQuery.loading}
        confirmLoading={pullFromWorkOrderQuery.confirmLoading}
        selectionType={pullFromWorkOrderQuery.selectionType}
        selectedRowKeys={pullFromWorkOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromWorkOrderQuery.searchDraft}
        onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
        onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
        onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
        appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.workReporting.formWorkOrderPlaceholder')}
        scopeOptions={pullFromWorkOrderQuery.scopeOptions}
        scope={pullFromWorkOrderQuery.scope}
        onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <Modal
        title={t('app.kuaizhizao.workReporting.pullPreviewTitle')}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={t('common.next')}
        cancelText={t('common.cancel')}
        onOk={() => handlePullPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            !(pullPreviewData?.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0),
        }}
      >
        {pullPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={pullPreviewData.blocking_reason} />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 860 }}
                columns={[
                  { title: t('app.kuaizhizao.workReporting.formOperation'), dataIndex: 'material_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.workReporting.colOperation'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.workReporting.pullPreviewNoReportable')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>


      {/* 创建报废记录Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.workReporting.scrapModalTitle')}
        open={scrapModalVisible}
        onClose={() => {
          setScrapModalVisible(false);
          setCurrentReportingRecord(null);
          scrapFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitScrap}
        formRef={scrapFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecord && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapWorkOrderCode')}{currentReportingRecord.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapOperation')}{currentReportingRecord.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>{t('app.kuaizhizao.workReporting.scrapUnqualifiedQty')}{currentReportingRecord.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="scrap_quantity"
              label={t('app.kuaizhizao.workReporting.scrapQuantity')}
              placeholder={t('app.kuaizhizao.workReporting.scrapQuantityRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.scrapQuantityRequired') }]}
              min={0}
              max={currentReportingRecord.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="scrap_type"
              label={t('app.kuaizhizao.workReporting.scrapType')}
              placeholder={t('app.kuaizhizao.workReporting.scrapTypeRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.scrapTypeRequired') }]}
              options={[
                { label: t('app.kuaizhizao.workReporting.scrapTypeProcess'), value: 'process' },
                { label: t('app.kuaizhizao.workReporting.scrapTypeMaterial'), value: 'material' },
                { label: t('app.kuaizhizao.workReporting.scrapTypeQuality'), value: 'quality' },
                { label: t('app.kuaizhizao.workReporting.scrapTypeEquipment'), value: 'equipment' },
                { label: t('app.kuaizhizao.workReporting.scrapTypeOther'), value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="scrap_reason"
              label={t('app.kuaizhizao.workReporting.scrapReason')}
              placeholder={t('app.kuaizhizao.workReporting.scrapReasonRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.scrapReasonRequired') }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormDigit
              name="unit_cost"
              label={t('app.kuaizhizao.workReporting.unitCostOptional')}
              placeholder={t('app.kuaizhizao.workReporting.unitCostPlaceholder')}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label={t('app.kuaizhizao.workReporting.remarksOptional')}
              placeholder={t('app.kuaizhizao.workReporting.formRemarksPlaceholder')}
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 创建不良品记录Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.workReporting.defectModalTitle')}
        open={defectModalVisible}
        onClose={() => {
          setDefectModalVisible(false);
          setCurrentReportingRecordForDefect(null);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitDefect}
        formRef={defectFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForDefect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapWorkOrderCode')}{currentReportingRecordForDefect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapOperation')}{currentReportingRecordForDefect.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>{t('app.kuaizhizao.workReporting.scrapUnqualifiedQty')}{currentReportingRecordForDefect.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="defect_quantity"
              label={t('app.kuaizhizao.workReporting.defectQuantity')}
              placeholder={t('app.kuaizhizao.workReporting.defectQuantityRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.defectQuantityRequired') }]}
              min={0}
              max={currentReportingRecordForDefect.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="defect_type"
              label={t('app.kuaizhizao.workReporting.defectType')}
              placeholder={t('app.kuaizhizao.workReporting.defectTypeRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.defectTypeRequired') }]}
              options={[
                { label: t('app.kuaizhizao.workReporting.defectTypeDimension'), value: 'dimension' },
                { label: t('app.kuaizhizao.workReporting.defectTypeAppearance'), value: 'appearance' },
                { label: t('app.kuaizhizao.workReporting.defectTypeFunction'), value: 'function' },
                { label: t('app.kuaizhizao.workReporting.defectTypeMaterial'), value: 'material' },
                { label: t('app.kuaizhizao.workReporting.defectTypeOther'), value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="defect_reason"
              label={t('app.kuaizhizao.workReporting.defectReason')}
              placeholder={t('app.kuaizhizao.workReporting.defectReasonRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.defectReasonRequired') }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormSelect
              name="disposition"
              label={t('app.kuaizhizao.workReporting.disposition')}
              placeholder={t('app.kuaizhizao.workReporting.dispositionRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.dispositionRequired') }]}
              options={[
                { label: t('app.kuaizhizao.workReporting.dispositionQuarantine'), value: 'quarantine' },
                { label: t('app.kuaizhizao.workReporting.dispositionRework'), value: 'rework' },
                { label: t('app.kuaizhizao.workReporting.dispositionScrap'), value: 'scrap' },
                { label: t('app.kuaizhizao.workReporting.dispositionAccept'), value: 'accept' },
                { label: t('app.kuaizhizao.workReporting.dispositionOther'), value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="quarantine_location"
              label={t('app.kuaizhizao.workReporting.quarantineLocation')}
              placeholder={t('app.kuaizhizao.workReporting.quarantineLocationPlaceholder')}
              fieldProps={{ rows: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label={t('app.kuaizhizao.workReporting.remarksOptional')}
              placeholder={t('app.kuaizhizao.workReporting.formRemarksPlaceholder')}
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 修正报工数据Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.workReporting.correctModalTitle')}
        open={correctModalVisible}
        onClose={() => {
          setCorrectModalVisible(false);
          setCurrentReportingRecordForCorrect(null);
          correctFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitCorrect}
        formRef={correctFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForCorrect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapWorkOrderCode')}{currentReportingRecordForCorrect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div>{t('app.kuaizhizao.workReporting.scrapOperation')}{currentReportingRecordForCorrect.operation_name}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="reported_quantity"
              label={t('app.kuaizhizao.workReporting.colReportedQty')}
              placeholder={t('app.kuaizhizao.workReporting.formReportedQtyRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formReportedQtyRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label={t('app.kuaizhizao.workReporting.colQualifiedQty')}
              placeholder={t('app.kuaizhizao.workReporting.formQualifiedQtyRequired')}
              rules={[
                { required: true, message: t('app.kuaizhizao.workReporting.formQualifiedQtyRequired') },
                ({ getFieldValue }: { getFieldValue: (name: string) => number }) => ({
                  validator: (_: any, value: number) => {
                    const reportedQuantity = getFieldValue('reported_quantity');
                    if (reportedQuantity !== undefined && value > reportedQuantity) {
                      return Promise.reject(new Error(t('app.kuaizhizao.workReporting.qualifiedExceedsReported')));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label={t('app.kuaizhizao.workReporting.colUnqualifiedQty')}
              placeholder={t('app.kuaizhizao.workReporting.unqualifiedQtyRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.unqualifiedQtyRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label={t('app.kuaizhizao.workReporting.colWorkHours')}
              placeholder={t('app.kuaizhizao.workReporting.formWorkHoursPlaceholder')}
              min={0}
              fieldProps={{ precision: 2, step: 0.1 }}
            />
            <ProFormTextArea
              name="correction_reason"
              label={t('app.kuaizhizao.workReporting.correctionReason')}
              placeholder={t('app.kuaizhizao.workReporting.correctionReasonPlaceholder')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.correctionReasonRequired') }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="remarks"
              label={t('app.kuaizhizao.workReporting.remarksOptional')}
              placeholder={t('app.kuaizhizao.workReporting.formRemarksPlaceholder')}
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>


      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.workReporting.detailTitle')}${reportingDetail?.work_order_code ? ` - ${reportingDetail.work_order_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={reportingDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReportingDetail(null);
          setDetailMaterialBindings([]);
          resetReportingDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          reportingDetail ? (
            <UniWorkflowActions
              {...rowActionKind('skip')}
              record={reportingDetail}
              resourcePrefix={REPORTING_RESOURCE}
              entityName={t('app.kuaizhizao.workReporting.entityName')}
              theme="default"
              {...reportingRecordUniAuditProps(reportingDetail as unknown as Record<string, unknown>)}
              onSuccess={() => handleReportingWorkflowSuccess(reportingDetail)}
            />
          ) : null
        }
        dataSource={reportingDetail || undefined}
        customContent={
          reportingDetail && (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.workReporting.sectionBasicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(reportingDetail, reportingDetailBaseColumns)}
                />
                {reportingDetail.sop_parameters && Object.keys(reportingDetail.sop_parameters).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>{t('app.kuaizhizao.workReporting.sopParameters')}</Typography.Text>
                    <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(reportingDetail.sop_parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </DetailDrawerSection>

              {hasCustomFieldsDetailContent(reportingListCustomFields, reportingDetailCustomFieldValues) && (
                <DetailDrawerSection title={t('app.master-data.customFields')}>
                  <CustomFieldsDetailSection
                    customFields={reportingListCustomFields}
                    customFieldValues={reportingDetailCustomFieldValues}
                  />
                </DetailDrawerSection>
              )}

              <DetailDrawerSection title={t('app.kuaizhizao.workReporting.sectionLifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getReportingLifecycle(reportingDetail as Record<string, unknown>, t);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.workReporting.sectionDetailInfo')}>
                <style>{`
                  .reporting-detail-bindings .ant-table-wrapper .ant-table-body,
                  .reporting-detail-bindings .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {detailMaterialBindings.length > 0 ? (
                  <div
                    className="reporting-detail-bindings"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      tableLayout="fixed"
                      style={{ minWidth: REPORTING_DETAIL_BINDINGS_MIN_WIDTH }}
                      columns={[
                        { title: t('app.kuaizhizao.workReporting.bindingColType'), dataIndex: 'binding_type', width: 100, ellipsis: true },
                        { title: t('app.kuaizhizao.workReporting.bindingColMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: t('app.kuaizhizao.workReporting.bindingColMaterialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: t('app.kuaizhizao.workReporting.bindingColQuantity'), dataIndex: 'quantity', width: 100, align: 'right' as const , render: formatQuantity },
                        { title: t('app.kuaizhizao.workReporting.bindingColWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                        { title: t('app.kuaizhizao.workReporting.bindingColMethod'), dataIndex: 'binding_method', width: 100 },
                      ]}
                      dataSource={detailMaterialBindings}
                      pagination={false}
                      rowKey={(r: any) => String(r.id ?? `${r.material_code}-${r.binding_type}`)}
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.workReporting.noMaterialBindings')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.workReporting.sectionOperationLog')}>
                {reportingTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {reportingTracking.error && !reportingTracking.loading && (
                  <Typography.Text type="danger">{reportingTracking.error}</Typography.Text>
                )}
                {reportingTracking.data && !reportingTracking.loading && (
                  <DocumentTrackingTimelineBody data={reportingTracking.data} />
                )}
                {!reportingTracking.loading && !reportingTracking.data && !reportingTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.workReporting.noOperationLog')} />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      
                      traceDocument={
                        reportingDetail?.id != null
                          ? {
                              documentType: 'reporting_record',
                              documentId: reportingDetail.id,
                              selfDocumentId: reportingDetail.id,
                            renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setReportingDetail(null);
                      setDetailMaterialBindings([]);
                    }}
                  />
                )
                            }
                          : undefined
                      }
      />

    </ListPageTemplate>
    </>
  );
};

export default ReportingPage;
