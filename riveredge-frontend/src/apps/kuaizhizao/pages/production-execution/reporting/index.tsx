import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能；扫码报工见移动端 kiosk。
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
  ProFormText,
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
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { reportingApi, workOrderApi, materialBindingApi, getReportingStatistics } from '../../../services/production';
import { getReportingLifecycle, reportingRecordUniAuditProps } from '../../../utils/reportingLifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getUserInfo } from '../../../../../utils/auth';
import { hasModulePermission } from '../../../../../utils/permissionContract';
import { useGlobalStore } from '../../../../../stores';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import type { User } from '../../../../../services/user';
import { getRemainingReportableQuantity } from '../../../utils/workOrderReporting';
import { coerceReportingCreateStrings } from '../../../utils/reportingPayload';
import ReportingInboundWarehouseField from '../../../components/ReportingInboundWarehouseField';
import {
  isInboundWarehouseRequiredForLastOperation,
  resolveIsLastOperation,
  resolveLastInboundHint,
} from '../../../utils/reportingLastOperation';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const REPORTING_RESOURCE = 'kuaizhizao:production-execution-reporting';

/** 报工记录（后端返回 snake_case） */
interface ReportingRecord {
  id: number;
  work_order_code: string;
  work_order_name: string;
  operation_name: string;
  worker_name: string;
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

function renderReportingRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

/** 获取报工员工信息：优先使用工序派工的 assigned_worker，否则使用当前登录用户 */
const getWorkerInfo = (operation?: any, translate?: (key: string) => string) => {
  const user = getUserInfo();
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
  const { data: executionConfig } = useQuery({
    queryKey: ['workOrderExecutionConfig'],
    queryFn: () => workOrderApi.getExecutionConfig(),
    staleTime: 0,
  });

  const currentUser = useGlobalStore((s) => s.currentUser);
  const canProxyReporting = useMemo(
    () => hasModulePermission(currentUser ?? undefined, 'kuaizhizao:production-execution-reporting', 'assign'),
    [currentUser],
  );
  const createModalProxyWorkerRef = useRef<Pick<User, 'id' | 'full_name' | 'username'> | null>(null);

  const openReportingCreateFromWorkOrder = useCallback(
    async (workOrderId: number, selectedOperationId?: number) => {
      if (!workOrderId) return;
      formRef.current?.resetFields();
      setReportOperations([]);
      setReportOperationId(null);
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
          return;
        }
        const preferredOperation =
          operations.find((op: any) => Number(op.operation_id) === Number(selectedOperationId))
          || operations.find((op: any) => String(op.status ?? '').toLowerCase() !== 'completed')
          || operations[0];
        setReportWorkOrders([workOrder]);
        setReportWorkOrderId(workOrder.id ?? workOrderId);
        setReportOperations(operations);
        setReportOperationId(preferredOperation?.operation_id ?? null);
        setReportingModalVisible(true);
        formRef.current?.setFieldsValue({
          work_order_id: workOrder.id ?? workOrderId,
          operation_id: preferredOperation?.operation_id,
        });
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.workReporting.loadWorkOrdersFailed'));
        setReportWorkOrders([]);
        setReportOperations([]);
        setReportWorkOrderId(null);
        setReportOperationId(null);
      }
    },
    [messageApi, t],
  );

  const pullFromWorkOrderQuery = useUniPullQuery<PullReportingOperationCandidate>({
    rowKey: 'pull_row_key',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      const normalizedKeyword = keyword.trim().toLowerCase();
      const chunkSize = 100;
      const maxRows = 1000;
      const workOrders: PullReportingWorkOrderCandidate[] = [];
      let skip = 0;
      while (workOrders.length < maxRows) {
        const res = await workOrderApi.list({
          status: 'in_progress',
          keyword: normalizedKeyword || undefined,
          skip,
          limit: chunkSize,
        });
        const chunk = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        workOrders.push(...chunk);
        if (chunk.length < chunkSize) break;
        skip += chunkSize;
      }
      const rows = (
        await Promise.all(
          workOrders.map(async (workOrder) => {
            if (!workOrder?.id) return [];
            const operationsRes = await workOrderApi.getOperations(String(workOrder.id));
            const operations = Array.isArray(operationsRes)
              ? operationsRes
              : (operationsRes as any)?.data ?? (operationsRes as any)?.items ?? [];
            if (!Array.isArray(operations) || operations.length === 0) return [];
            return operations.map((op: any) => ({
              ...workOrder,
              pull_row_key: `${workOrder.id}-${op.operation_id}`,
              work_order_id: Number(workOrder.id),
              operation_id: Number(op.operation_id),
              operation_code: op.operation_code,
              operation_name: op.operation_name || op.name,
              operation_sequence: op.sequence,
            }));
          }),
        )
      ).flat();
      const filteredRows = normalizedKeyword
        ? rows.filter((row) => {
          const workOrderCode = String(row.code || '').toLowerCase();
          const workOrderName = String(row.name || '').toLowerCase();
          const operationCode = String(row.operation_code || '').toLowerCase();
          const operationName = String(row.operation_name || '').toLowerCase();
          return (
            workOrderCode.includes(normalizedKeyword)
            || workOrderName.includes(normalizedKeyword)
            || operationCode.includes(normalizedKeyword)
            || operationName.includes(normalizedKeyword)
          );
        })
        : rows;
      const total = filteredRows.length;
      const start = (page - 1) * pageSize;
      return {
        data: filteredRows.slice(start, start + pageSize),
        total,
      };
    },
    onConfirm: async (_selectedKeys, selectedRows) => {
      const selected = selectedRows[0];
      if (!selected?.work_order_id || !selected?.operation_id) {
        messageApi.warning(t('app.kuaizhizao.workReporting.formWorkOrderRequired'));
        return;
      }
      pullFromWorkOrderQuery.closeModal();
      await openReportingCreateFromWorkOrder(selected.work_order_id, selected.operation_id);
    },
  });

  useEffect(() => {
    if (!reportingModalVisible || !canProxyReporting) {
      createModalProxyWorkerRef.current = null;
      return;
    }
    if (!reportOperationId) {
      createModalProxyWorkerRef.current = null;
      formRef.current?.setFieldsValue({ proxy_worker_uuid: undefined });
      return;
    }
    const operation = (Array.isArray(reportOperations) ? reportOperations : []).find(
      (op: any) => op.operation_id === reportOperationId,
    );
    if (!operation) return;
    const b = getWorkerInfo(operation, t);
    createModalProxyWorkerRef.current = { id: b.worker_id, full_name: b.worker_name, username: '' };
    formRef.current?.setFieldsValue({ proxy_worker_uuid: undefined });
  }, [reportingModalVisible, canProxyReporting, reportOperationId, reportOperations]);

  const reportSelectedOperation = useMemo(
    () =>
      (Array.isArray(reportOperations) ? reportOperations : []).find(
        (op: any) => op.operation_id === reportOperationId,
      ),
    [reportOperations, reportOperationId],
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
   * 处理新建报工（打开弹窗并加载工单列表）
   */
  const handleNewReporting = async () => {
    pullFromWorkOrderQuery.openModal();
  };
  useNewShortcut(() => {
    void handleNewReporting();
  });
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.workReporting.createButton')),
    [t],
  );

  /**
   * 新建报工：工单变更时加载工序
   */
  const handleReportWorkOrderChange = async (workOrderId: number) => {
    setReportWorkOrderId(workOrderId);
    setReportOperations([]);
    setReportOperationId(null);
    formRef.current?.setFieldsValue({ operation_id: undefined });
    if (!workOrderId) return;
    try {
      const operations = await workOrderApi.getOperations(workOrderId.toString());
      const ops = Array.isArray(operations) ? operations : (operations as any)?.data ?? (operations as any)?.items ?? [];
      setReportOperations(Array.isArray(ops) ? ops : []);
    } catch (e) {
      messageApi.error(t('app.kuaizhizao.workReporting.loadOperationsFailed'));
      setReportOperations([]);
    }
  };

  /**
   * 新建报工：工序变更时只更新状态，实际自动填充由 useEffect 依赖驱动。
   * 这样就不必用 setTimeout 去 "等条件字段挂载"——useEffect 天然在提交后运行。
   */
  const handleReportOperationChange = (operationId: number) => {
    setReportOperationId(operationId);
  };

  useEffect(() => {
    if (!reportOperationId || !reportWorkOrderId) return;
    const operation = (Array.isArray(reportOperations) ? reportOperations : []).find(
      (op: any) => op.operation_id === reportOperationId,
    );
    const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find(
      (wo: any) => wo.id === reportWorkOrderId,
    );
    if (!operation || !workOrder) return;
    const autoFillValues: any = {};
    if (operation.standard_time) {
      autoFillValues.work_hours =
        parseFloat(operation.standard_time.toString()) *
        parseFloat(workOrder.quantity?.toString() || '1');
    }
    if (operation.reporting_type === 'quantity') {
      const remaining = getRemainingReportableQuantity(
        operation,
        parseFloat(workOrder.quantity?.toString() || '0') || 0,
      );
      if (remaining > 0) {
        autoFillValues.reported_quantity = remaining;
        autoFillValues.qualified_quantity = remaining;
      }
    }
    if (operation.reporting_type === 'status') {
      autoFillValues.completed_status = 'completed';
    }
    if (Object.keys(autoFillValues).length > 0) {
      formRef.current?.setFieldsValue(autoFillValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOperationId, reportWorkOrderId, reportOperations, reportWorkOrders]);

  /**
   * 处理报工提交
   */
  const handleReportingSubmit = async (values: any) => {
    try {
      const ensurePickingGate = async (workOrderId: number) => {
        if (!executionConfig?.require_confirmed_picking_before_reporting) return true;
        const status = await workOrderApi.getPickingConfirmationStatus(workOrderId.toString());
        if (!status?.has_confirmed_picking) {
          messageApi.warning(t('app.kuaizhizao.workReporting.pickingGateWarning'));
          return false;
        }
        return true;
      };

      // 新建报工：从工单+工序构建完整 payload
      const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find((wo: any) => wo.id === values.work_order_id);
      const operation = (Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === values.operation_id);
      if (!workOrder || !operation) {
        messageApi.error(t('app.kuaizhizao.workReporting.workOrderOrOperationMissing'));
        throw new Error(t('app.kuaizhizao.workReporting.workOrderOrOperationMissing'));
      }
      const canContinue = await ensurePickingGate(workOrder.id);
      if (!canContinue) return;
      const { worker_id, worker_name } = resolveProductionWorker(operation, createModalProxyWorkerRef.current, t);
      const reportingData: any = {
        work_order_id: workOrder.id,
        work_order_code: workOrder.code,
        work_order_name: workOrder.name,
        operation_id: operation.operation_id,
        operation_code: operation.operation_code,
        operation_name: operation.operation_name,
        worker_id,
        worker_name,
        status: 'pending',
        reported_at: new Date().toISOString(),
        remarks: values.remarks,
        work_hours: values.work_hours || 0,
      };
      if (operation.reporting_type === 'status') {
        reportingData.reported_quantity = values.completed_status === 'completed' ? 1 : 0;
        reportingData.qualified_quantity = values.completed_status === 'completed' ? 1 : 0;
        reportingData.unqualified_quantity = 0;
      } else {
        const rq = Number(values.reported_quantity) || 0;
        if (rq <= 0) {
          messageApi.warning(t('app.kuaizhizao.workReporting.quantityMustBePositive'));
          return;
        }
        const rem = getRemainingReportableQuantity(
          operation,
          parseFloat(workOrder.quantity?.toString() || '0') || 0,
        );
        if (rq > rem + 1e-9) {
          messageApi.warning(
            t('apps.kuaizhizao.workOrder.quickReport.exceedEffectiveSubmit', { max: rem }),
          );
          return;
        }
        reportingData.reported_quantity = rq;
        reportingData.qualified_quantity = values.qualified_quantity ?? rq ?? 0;
        reportingData.unqualified_quantity = rq - (values.qualified_quantity ?? rq ?? 0);
      }
      if (reportIsLastOperation) {
        if (reportWarehouseRequired && !values.inbound_warehouse_id) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.workOrder.selectWarehouse'));
          return;
        }
        if (values.inbound_warehouse_id) {
          reportingData.inbound_warehouse_id = Number(values.inbound_warehouse_id);
          reportingData.inbound_warehouse_name = values.inbound_warehouse_name
            ? String(values.inbound_warehouse_name)
            : undefined;
        }
      }
      await reportingApi.create(coerceReportingCreateStrings(reportingData, workOrder));
      messageApi.success(t('app.kuaizhizao.workReporting.createSuccess'));
      setReportingModalVisible(false);
      formRef.current?.resetFields();
      setReportOperations([]);
      setReportWorkOrderId(null);
      setReportOperationId(null);
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
          {...reportingRecordUniAuditProps({
            resourcePrefix: REPORTING_RESOURCE,
            entityName: t('app.kuaizhizao.workReporting.entityName'),
            onSuccess: () => handleReportingWorkflowSuccess(record),
          })}
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
      title: t('app.kuaizhizao.workReporting.colWorkOrderStacked'),
      key: 'workOrderStacked',
      dataIndex: 'work_order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
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
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkOrderName'),
      dataIndex: 'work_order_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colOperation'),
      dataIndex: 'operation_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorker'),
      dataIndex: 'worker_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workReporting.colRecordedBy'),
      dataIndex: 'recorded_by_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const rec = (r as ReportingRecord).recorded_by_name;
        if (rec) return rec;
        return (r as ReportingRecord).worker_name ?? '—';
      },
    },
    {
      title: t('app.kuaizhizao.workReporting.colReportedQty'),
      dataIndex: 'reported_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.workReporting.colQualifiedQty'),
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const val = Number(record.qualified_quantity ?? record.qualifiedQuantity ?? 0);
        return <Typography.Text type="success">{val.toFixed(2)}</Typography.Text>;
      },
    },
    {
      title: t('app.kuaizhizao.workReporting.colUnqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const val = Number(record.unqualified_quantity ?? record.unqualifiedQuantity ?? 0);
        return <Typography.Text type="danger">{val.toFixed(2)}</Typography.Text>;
      },
    },
    {
      title: t('app.kuaizhizao.workReporting.colWorkHours'),
      dataIndex: 'work_hours',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.workReporting.colReportedAt'),
      dataIndex: 'reported_at',
      valueType: 'dateTime',
      width: 160,
      defaultSortOrder: 'descend',
    },
    ...(reportingAuditColumn ? [reportingAuditColumn] : []),
    {
      title: t('app.kuaizhizao.workReporting.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getReportingLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderReportingRowActions(renderReportingRowActionNodes(record), `rr-${record.id}`),
    },
  ], [t, reportingAuditColumn]);


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
          return <Tag color={x.color}>{x.text}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.workReporting.colReportedQty'), dataIndex: 'reported_quantity' },
      { title: t('app.kuaizhizao.workReporting.colQualifiedQty'), dataIndex: 'qualified_quantity' },
      { title: t('app.kuaizhizao.workReporting.colUnqualifiedQty'), dataIndex: 'unqualified_quantity' },
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
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.reporting"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const skip = ((params.current ?? 1) - 1) * (params.pageSize ?? 20);
            const limit = params.pageSize ?? 20;
            const filters = {
              work_order_code: params.keyword || params.work_order_code,
              work_order_name: params.work_order_name,
              operation_name: params.operation_name,
              worker_name: params.worker_name,
              status: params.status,
              reported_at_start: params.reported_at?.[0],
              reported_at_end: params.reported_at?.[1],
            };
            const readList = async (query: { skip?: number; limit?: number }) => {
              const list = await reportingApi.list({
                ...filters,
                ...query,
              });
              return Array.isArray(list) ? list : (list as any)?.items ?? [];
            };
            const [data, total] = await Promise.all([
              readList({ skip, limit }),
              countWithPagedRequests(readList, {}, { chunkSize: 100 }),
            ]);
            return {
              data,
              success: true,
              total,
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
        scroll={{ x: 1700 }}
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
          setReportOperations([]);
          setReportWorkOrderId(null);
          setReportOperationId(null);
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
        <Col span={12}>
          <ProFormItem
            name="work_order_id"
            label={t('app.kuaizhizao.workReporting.formWorkOrder')}
            rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formWorkOrderRequired') }]}
          >
            <UniDropdown
              placeholder={t('app.kuaizhizao.workReporting.formWorkOrderPlaceholder')}
              showSearch
              options={(Array.isArray(reportWorkOrders) ? reportWorkOrders : []).map((wo: any) => ({
                label: `${wo.code || wo.work_order_code || ''} - ${wo.name || wo.work_order_name || ''}`,
                value: wo.id,
              }))}
              onChange={(value: any) => handleReportWorkOrderChange(value as number)}
              advancedSearch={{
                label: t('app.kuaizhizao.workReporting.advancedSearchWorkOrder'),
                fields: [
                  { name: 'code', label: t('app.kuaizhizao.workReporting.colWorkOrderCode'), type: 'text' },
                  { name: 'name', label: t('app.kuaizhizao.workReporting.colWorkOrderName'), type: 'text' },
                ],
                onSearch: async (params) => {
                  const res = await workOrderApi.list({ ...params, status: 'in_progress' });
                  const list = Array.isArray(res) ? res : (res as any)?.items ?? [];
                  return list.map((wo: any) => ({
                    label: `${wo.code} - ${wo.name}`,
                    value: wo.id,
                  }));
                },
              }}
            />
          </ProFormItem>
        </Col>
        <Col span={12}>
          <ProFormItem
            name="operation_id"
            label={t('app.kuaizhizao.workReporting.formOperation')}
            rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formOperationRequired') }]}
          >
            <UniDropdown
              placeholder={reportWorkOrderId ? t('app.kuaizhizao.workReporting.formOperationPlaceholder') : t('app.kuaizhizao.workReporting.formOperationSelectWorkOrderFirst')}
              showSearch
              disabled={!reportWorkOrderId || (Array.isArray(reportOperations) ? reportOperations : []).length === 0}
              options={(Array.isArray(reportOperations) ? reportOperations : []).map((op: any) => ({
                label: `${op.operation_name || op.name} (${op.sequence || ''})`,
                value: op.operation_id,
              }))}
              onChange={(value: any) => handleReportOperationChange(value as number)}
            />
          </ProFormItem>
        </Col>
        {canProxyReporting && (
          <Col span={24}>
            <UniUserSelect
              name="proxy_worker_uuid"
              label={t('app.kuaizhizao.workReporting.formProxyWorker')}
              placeholder={t('app.kuaizhizao.workReporting.formProxyWorkerPlaceholder')}
              onChange={(_uuid, u) => {
                createModalProxyWorkerRef.current =
                  u && !Array.isArray(u) ? { id: u.id, full_name: u.full_name, username: u.username } : null;
              }}
            />
            {currentUser ? (
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                {t('app.kuaizhizao.workReporting.formRecordedByLogin', { name: currentUser.full_name || currentUser.username || '—' })}
              </Typography.Text>
            ) : null}
          </Col>
        )}
        {(Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === reportOperationId)?.reporting_type === 'status' ? (
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
              name="reported_quantity"
              label={t('app.kuaizhizao.workReporting.colReportedQty')}
              placeholder={t('app.kuaizhizao.workReporting.colReportedQty')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formReportedQtyRequired') }]}
              min={0}
              colProps={{ span: 8 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label={t('app.kuaizhizao.workReporting.colQualifiedQty')}
              placeholder={t('app.kuaizhizao.workReporting.formQualifiedQtyRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formQualifiedQtyRequired') }]}
              min={0}
              colProps={{ span: 8 }}
            />
          </>
        )}
        <ProFormDigit
          name="work_hours"
          label={t('app.kuaizhizao.workReporting.colWorkHours')}
          placeholder={t('app.kuaizhizao.workReporting.formWorkHoursPlaceholder')}
          min={0}
          fieldProps={{ step: 0.1 }}
          colProps={{ span: 8 }}
        />
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
      </FormModalTemplate>

      <UniPullQueryModal<PullReportingOperationCandidate>
        open={pullFromWorkOrderQuery.open}
        title={t('app.kuaizhizao.workReporting.formWorkOrder')}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="pull_row_key"
        columns={[
          { title: t('app.kuaizhizao.workReporting.colWorkOrderCode'), dataIndex: 'code', width: 180, ellipsis: true },
          { title: t('app.kuaizhizao.workReporting.colWorkOrderName'), dataIndex: 'name', width: 220, ellipsis: true },
          {
            title: t('app.kuaizhizao.workReporting.formOperation'),
            key: 'operation_display',
            width: 220,
            ellipsis: true,
            render: (_, row) => `${row.operation_name || '-'} (${row.operation_code || '-'})`,
          },
          { title: t('app.kuaizhizao.workOrder.colPlannedQty'), dataIndex: 'quantity', width: 120, align: 'right' },
          {
            title: t('app.kuaizhizao.workOrder.colPlannedStart'),
            dataIndex: 'planned_start_date',
            width: 180,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
          {
            title: t('app.kuaizhizao.workOrder.colPlannedEnd'),
            dataIndex: 'planned_end_date',
            width: 180,
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
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        okText={t('app.kuaizhizao.workReporting.createButton')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />


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
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          reportingDetail ? (
            <UniWorkflowActions
              {...rowActionKind('skip')}
              record={reportingDetail}
              {...reportingRecordUniAuditProps({
                resourcePrefix: REPORTING_RESOURCE,
                entityName: t('app.kuaizhizao.workReporting.entityName'),
                theme: 'default',
                onSuccess: () => handleReportingWorkflowSuccess(reportingDetail),
              })}
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

              <DetailDrawerSection title={t('app.kuaizhizao.workReporting.sectionLifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getReportingLifecycle(reportingDetail);
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
                  {reportingDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='reporting_record'
                      documentId={reportingDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={reportingDetail.id}
                      renderBriefActions={(doc) => (
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
                )}
                    />
                  ) : null}
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
                        { title: t('app.kuaizhizao.workReporting.bindingColQuantity'), dataIndex: 'quantity', width: 100, align: 'right' as const },
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
      />

    </ListPageTemplate>
    </>
  );
};

export default ReportingPage;
