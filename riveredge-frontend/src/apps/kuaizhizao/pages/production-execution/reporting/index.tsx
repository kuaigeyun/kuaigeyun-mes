import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能；扫码报工见移动端 kiosk。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  theme as AntdTheme,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  WarningOutlined,
  RollbackOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
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
import { getReportingLifecycle } from '../../../utils/reportingLifecycle';
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
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

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
  [key: string]: any; // 支持索引访问
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
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
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
  return nodes;
}

/** 获取报工员工信息：优先使用工序派工的 assigned_worker，否则使用当前登录用户 */
const getWorkerInfo = (operation?: any) => {
  const user = getUserInfo();
  if (operation?.assigned_worker_id) {
    return {
      worker_id: operation.assigned_worker_id,
      worker_name: String(
        operation.assigned_worker_name || user?.full_name || user?.username || '操作员'
      ),
    };
  }
  return {
    worker_id: user?.id ?? 0,
    worker_name: String(user?.full_name || user?.username || '当前用户'),
  };
};

/** 代报工：若选择了「生产人员」则以其为准，否则与 getWorkerInfo 一致 */
function resolveProductionWorker(
  operation: any,
  proxyUser: Pick<User, 'id' | 'full_name' | 'username'> | null | undefined,
): { worker_id: number; worker_name: string } {
  const base = getWorkerInfo(operation);
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

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [reportingDetail, setReportingDetail] = useState<ReportingRecord | null>(null);
  const [detailMaterialBindings, setDetailMaterialBindings] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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
        title: '累计工时',
        value: (stats.cumulative_hours ?? 0).toFixed(1),
        unit: 'h',
        trend: stats.trends?.hours,
        icon: <ClockCircleOutlined />,
      },
      {
        title: '预估工资',
        value: (stats.estimated_wages ?? 0).toLocaleString(),
        unit: '¥',
        trend: stats.trends?.wages,
        icon: <CheckCircleOutlined />,
      },
      {
        title: '生产效率',
        value: ((stats.efficiency ?? 0) * 100).toFixed(1) + '%',
        trend: stats.trends?.efficiency,
        icon: <CheckCircleOutlined />,
        color: 'green',
        subValue: stats.efficiency_yoy != null ? (stats.efficiency_yoy >= 0 ? '+' : '') + stats.efficiency_yoy + '%' : undefined,
        subLabel: '同比',
      },
      {
        title: '异常提报',
        value: stats.exception_reports ?? 0,
        unit: '项',
        icon: <WarningOutlined />,
        color: (stats.exception_reports ?? 0) > 0 ? 'red' : 'green',
      },
    ];
  }, [stats]);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['reportingStatistics'] });
  };

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
    const b = getWorkerInfo(operation);
    createModalProxyWorkerRef.current = { id: b.worker_id, full_name: b.worker_name, username: '' };
    formRef.current?.setFieldsValue({ proxy_worker_uuid: undefined });
  }, [reportingModalVisible, canProxyReporting, reportOperationId, reportOperations]);

  /**
   * 处理新建报工（打开弹窗并加载工单列表）
   */
  const handleNewReporting = async () => {
    setReportingModalVisible(true);
    formRef.current?.resetFields();
    setReportOperations([]);
    setReportWorkOrderId(null);
    setReportOperationId(null);
    try {
      const workOrders = await workOrderApi.list({ status: 'in_progress', limit: 200 });
      const list = Array.isArray(workOrders) ? workOrders : (workOrders as any)?.data ?? (workOrders as any)?.items ?? [];
      setReportWorkOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      messageApi.error('加载工单列表失败');
      setReportWorkOrders([]);
    }
  };

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
      messageApi.error('加载工序列表失败');
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
          messageApi.warning('当前配置要求先确认领料，未确认时不可报工');
          return false;
        }
        return true;
      };

      // 新建报工：从工单+工序构建完整 payload
      const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find((wo: any) => wo.id === values.work_order_id);
      const operation = (Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === values.operation_id);
      if (!workOrder || !operation) {
        messageApi.error('工单或工序信息不存在');
        throw new Error('工单或工序未选择');
      }
      const canContinue = await ensurePickingGate(workOrder.id);
      if (!canContinue) return;
      const { worker_id, worker_name } = resolveProductionWorker(operation, createModalProxyWorkerRef.current);
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
          messageApi.warning('报工数量须大于 0');
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
      await reportingApi.create(coerceReportingCreateStrings(reportingData, workOrder));
      messageApi.success('报工成功');
      setReportingModalVisible(false);
      formRef.current?.resetFields();
      setReportOperations([]);
      setReportWorkOrderId(null);
      setReportOperationId(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '报工失败');
      throw error;
    }
  };

  /**
   * 处理创建报废记录
   */
  const handleCreateScrap = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建报废记录');
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
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordScrap(currentReportingRecord.id.toString(), values);
      messageApi.success('报废记录创建成功');
      setScrapModalVisible(false);
      setCurrentReportingRecord(null);
      scrapFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建报废记录失败');
      throw error;
    }
  };

  /**
   * 处理创建不良品记录
   */
  const handleCreateDefect = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建不良品记录');
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
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordDefect(currentReportingRecordForDefect.id.toString(), values);
      messageApi.success('不良品记录创建成功');
      setDefectModalVisible(false);
      setCurrentReportingRecordForDefect(null);
      defectFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不良品记录失败');
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
      messageApi.error('获取报工记录详情失败');
    }
  };

  /**
   * 处理提交数据修正
   */
  const handleSubmitCorrect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForCorrect?.id) {
        throw new Error('报工记录信息不存在');
      }

      if (!values.correction_reason || !values.correction_reason.trim()) {
        messageApi.error('请输入修正原因');
        throw new Error('修正原因不能为空');
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
      messageApi.success('报工数据修正成功');
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
      if (error.message !== '修正原因不能为空') {
        const detail = error?.response?.data?.detail;
        const msg =
          (typeof detail === 'string' ? detail : detail?.message) ||
          error?.message ||
          '修正报工数据失败';
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
      messageApi.error('获取报工记录详情失败');
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
        详情
      </Button>
    );
    if (isPending) {
      nodes.push(
        <span {...rowActionKind('skip')} key="wf" onClick={(e) => e.stopPropagation()}>
          <UniWorkflowActions {...rowActionKind('skip')}
            record={record}
            entityName="报工记录"
            statusField="status"
            draftStatuses={[]}
            pendingStatuses={REPORTING_PENDING_STATUSES}
            approvedStatuses={REPORTING_APPROVED_STATUSES}
            rejectedStatuses={REPORTING_REJECTED_STATUSES}
            onSuccess={() => {
              invalidateMenuBadgeCounts();

              actionRef.current?.reload();
              invalidateStatistics();
              if (reportingDetail?.id === record.id) {
                reportingApi
                  .get(record.id.toString())
                  .then((d) => {
                    setReportingDetail(d as ReportingRecord);
                    setRpTrackingRefreshKey((k) => k + 1);
                  })
                  .catch(() => {});
              }
            }}
            theme="link"
            size="small"
          />
        </span>
      );
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
          修正
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
              title: '确认删除',
              content: '确定要删除这条待审核的报工记录吗？删除后将扣减工单/工序相应的完成数量。',
              onOk: async () => {
                try {
                  await reportingApi.delete(record.id.toString());
                  messageApi.success('删除成功');
                  if (reportingDetail?.id === record.id) {
                    setDetailDrawerVisible(false);
                    setReportingDetail(null);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                  invalidateStatistics();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
        >
          删除
        </Button>
      );
    }
    if (isApproved) {
      nodes.push(
        <Button {...rowActionKind('revoke')}
          key="revoke"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            Modal.confirm({
              title: '确认撤回审核',
              content:
                '撤回审核后，该报工记录将变为"待审核"状态，且不再计入工单已完成数量。确定要撤回吗？',
              onOk: async () => {
                try {
                  await reportingApi.revoke(record.id.toString());
                  messageApi.success('已撤回审核');
                  if (reportingDetail?.id === record.id) {
                    reportingApi
                      .get(record.id.toString())
                      .then((d) => {
                        setReportingDetail(d as ReportingRecord);
                        setRpTrackingRefreshKey((k) => k + 1);
                      })
                      .catch(() => {});
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                  invalidateStatistics();
                } catch (error: any) {
                  messageApi.error(error.message || '撤回失败');
                }
              },
            });
          }}
        >
          撤回审核
        </Button>
      );
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
            不良品
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
            报废
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
          修正
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
              title: '确认删除',
              content: '确定要删除这条被驳回的报工记录吗？',
              onOk: async () => {
                try {
                  await reportingApi.delete(record.id.toString());
                  messageApi.success('删除成功');
                  if (reportingDetail?.id === record.id) {
                    setDetailDrawerVisible(false);
                    setReportingDetail(null);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                  invalidateStatistics();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
        >
          删除
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportingRecord>[] = [
    {
      title: '工单名称 / 编号',
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
      title: '工单编号',
      dataIndex: 'work_order_code',
      hideInTable: true,
    },
    {
      title: '工单名称',
      dataIndex: 'work_order_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: '工序',
      dataIndex: 'operation_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '生产人员',
      dataIndex: 'worker_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '记录人员',
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
      title: '报工数量',
      dataIndex: 'reported_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const val = Number(record.qualified_quantity ?? record.qualifiedQuantity ?? 0);
        return <Typography.Text type="success">{val.toFixed(2)}</Typography.Text>;
      },
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const val = Number(record.unqualified_quantity ?? record.unqualifiedQuantity ?? 0);
        return <Typography.Text type="danger">{val.toFixed(2)}</Typography.Text>;
      },
    },
    {
      title: '工时(小时)',
      dataIndex: 'work_hours',
      width: 100,
      align: 'right',
    },
    {
      title: '报工时间',
      dataIndex: 'reported_at',
      valueType: 'dateTime',
      width: 160,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getReportingLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderReportingRowActions(renderReportingRowActionNodes(record), `rr-${record.id}`),
    },
  ];


  const reportingDetailBaseColumns: ProDescriptionsItemProps<ReportingRecord>[] = useMemo(
    () => [
      {
        title: '工单编号',
        dataIndex: 'work_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }}>{r.work_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '工单名称', dataIndex: 'work_order_name' },
      { title: '工序', dataIndex: 'operation_name' },
      { title: '生产人员', dataIndex: 'worker_name' },
      {
        title: '记录人员',
        dataIndex: 'recorded_by_name',
        render: (_: any, r: ReportingRecord) =>
          r.recorded_by_name || r.worker_name || '—',
      },
      {
        title: '审核状态',
        dataIndex: 'status',
        render: (s) => {
          const m: Record<string, { text: string; color: string }> = {
            pending: { text: '待审核', color: 'default' },
            approved: { text: '已审核', color: 'success' },
            rejected: { text: '已驳回', color: 'error' },
          };
          const x = m[String(s)] || { text: String(s ?? '-'), color: 'default' };
          return <Tag color={x.color}>{x.text}</Tag>;
        },
      },
      { title: '报工数量', dataIndex: 'reported_quantity' },
      { title: '合格数量', dataIndex: 'qualified_quantity' },
      { title: '不合格数量', dataIndex: 'unqualified_quantity' },
      { title: '工时(小时)', dataIndex: 'work_hours' },
      { title: '报工时间', dataIndex: 'reported_at', valueType: 'dateTime' },
      { title: '审核时间', dataIndex: 'approved_at', valueType: 'dateTime' },
      { title: '审核人', dataIndex: 'approved_by_name' },
      { title: '驳回原因', dataIndex: 'rejection_reason', span: 3, render: (t: any) => t || '-' },
      {
        title: '备注',
        dataIndex: 'remarks',
        span: 3,
        render: (text: any) => text || '-',
      },
    ],
    []
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      <UniTable
        headerTitle="报工管理"
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
            messageApi.error(error.message || '获取报工记录失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={true}
        createButtonText="新建报工记录"
        onCreate={handleNewReporting}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await reportingApi.delete(String(id));
            }
            messageApi.success(`成功删除 ${keys.length} 条记录`);
            setSelectedRowKeys([]);
            if (reportingDetail?.id != null && keys.includes(reportingDetail.id)) {
              setDetailDrawerVisible(false);
              setReportingDetail(null);
            }
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
            invalidateStatistics();
          } catch (error: any) {
            messageApi.error(error.message || '删除失败');
          }
        }}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条报工记录吗？`}
        scroll={{ x: 1700 }}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="reporting-batch-menu"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'batch-revoke',
                label: '批量撤回审核',
                icon: <RollbackOutlined />,
                onClick: (keys) => {
                  Modal.confirm({
                    title: '确认批量撤回审核',
                    content: `确定要撤回选中的 ${keys.length} 条报工记录的审核吗？只有"已审核"状态的记录会被执行。`,
                    onOk: async () => {
                      try {
                        const res = await reportingApi.batchRevoke(keys.map(String));
                        if (res.success > 0) {
                          messageApi.success(`成功撤回 ${res.success} 条记录审核`);
                        }
                        if (res.failed > 0) {
                          messageApi.warning(`${res.failed} 条记录操作失败`);
                        }
                        invalidateMenuBadgeCounts();
                        actionRef.current?.reload();
                        invalidateStatistics();
                        setSelectedRowKeys([]);
                      } catch (error: any) {
                        messageApi.error(error.message || '批量撤回失败');
                      }
                    },
                  });
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title="新建报工记录"
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
        <Col span={12}>
          <ProFormItem
            name="work_order_id"
            label="工单"
            rules={[{ required: true, message: '请选择工单' }]}
          >
            <UniDropdown
              placeholder="请选择工单"
              showSearch
              options={(Array.isArray(reportWorkOrders) ? reportWorkOrders : []).map((wo: any) => ({
                label: `${wo.code || wo.work_order_code || ''} - ${wo.name || wo.work_order_name || ''}`,
                value: wo.id,
              }))}
              onChange={(value: any) => handleReportWorkOrderChange(value as number)}
              advancedSearch={{
                label: '高级搜索工单',
                fields: [
                  { name: 'code', label: '工单编号', type: 'text' },
                  { name: 'name', label: '工单名称', type: 'text' },
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
            label="工序"
            rules={[{ required: true, message: '请选择工序' }]}
          >
            <UniDropdown
              placeholder={reportWorkOrderId ? "请选择工序" : "请先选择工单"}
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
              label="生产人员"
              placeholder="选择实际完成报工的生产人员（不选则按派工/本人默认）"
              onChange={(_uuid, u) => {
                createModalProxyWorkerRef.current =
                  u && !Array.isArray(u) ? { id: u.id, full_name: u.full_name, username: u.username } : null;
              }}
            />
            {currentUser ? (
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                记录人员（本次登录）：{currentUser.full_name || currentUser.username || '—'}
              </Typography.Text>
            ) : null}
          </Col>
        )}
        {(Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === reportOperationId)?.reporting_type === 'status' ? (
          <ProFormRadio.Group
            name="completed_status"
            label="完成状态"
            rules={[{ required: true, message: '请选择完成状态' }]}
            options={[
              { label: '完成', value: 'completed' },
              { label: '未完成', value: 'incomplete' },
            ]}
            colProps={{ span: 12 }}
          />
        ) : (
          <>
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              placeholder="报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0}
              colProps={{ span: 8 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              rules={[{ required: true, message: '请输入合格数量' }]}
              min={0}
              colProps={{ span: 8 }}
            />
          </>
        )}
        <ProFormDigit
          name="work_hours"
          label="工时(小时)"
          placeholder="选填，默认按 0"
          min={0}
          fieldProps={{ step: 0.1 }}
          colProps={{ span: 8 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>


      {/* 创建报废记录Modal */}
      <FormModalTemplate
        title="记录报废"
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
                  <div><strong>工单编号：</strong>{currentReportingRecord.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecord.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecord.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="scrap_quantity"
              label="报废数量"
              placeholder="请输入报废数量"
              rules={[{ required: true, message: '请输入报废数量' }]}
              min={0}
              max={currentReportingRecord.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="scrap_type"
              label="报废类型"
              placeholder="请选择报废类型"
              rules={[{ required: true, message: '请选择报废类型' }]}
              options={[
                { label: '工艺问题', value: 'process' },
                { label: '物料问题', value: 'material' },
                { label: '质量问题', value: 'quality' },
                { label: '设备问题', value: 'equipment' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="scrap_reason"
              label="报废原因"
              placeholder="请输入报废原因"
              rules={[{ required: true, message: '请输入报废原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormDigit
              name="unit_cost"
              label="单位成本（可选）"
              placeholder="请输入单位成本"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 创建不良品记录Modal */}
      <FormModalTemplate
        title="记录不良品"
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
                  <div><strong>工单编号：</strong>{currentReportingRecordForDefect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForDefect.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecordForDefect.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="defect_quantity"
              label="不良品数量"
              placeholder="请输入不良品数量"
              rules={[{ required: true, message: '请输入不良品数量' }]}
              min={0}
              max={currentReportingRecordForDefect.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="defect_type"
              label="不良品类型"
              placeholder="请选择不良品类型"
              rules={[{ required: true, message: '请选择不良品类型' }]}
              options={[
                { label: '尺寸问题', value: 'dimension' },
                { label: '外观问题', value: 'appearance' },
                { label: '功能问题', value: 'function' },
                { label: '物料问题', value: 'material' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="defect_reason"
              label="不良品原因"
              placeholder="请输入不良品原因"
              rules={[{ required: true, message: '请输入不良品原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormSelect
              name="disposition"
              label="处理方式"
              placeholder="请选择处理方式"
              rules={[{ required: true, message: '请选择处理方式' }]}
              options={[
                { label: '隔离', value: 'quarantine' },
                { label: '返工', value: 'rework' },
                { label: '报废', value: 'scrap' },
                { label: '接受', value: 'accept' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="quarantine_location"
              label="隔离位置（处理方式为隔离时填写）"
              placeholder="请输入隔离位置"
              fieldProps={{ rows: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 修正报工数据Modal */}
      <FormModalTemplate
        title="修正报工记录"
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
                  <div><strong>工单编号：</strong>{currentReportingRecordForCorrect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForCorrect.operation_name}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              placeholder="请输入报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              rules={[
                { required: true, message: '请输入合格数量' },
                ({ getFieldValue }: { getFieldValue: (name: string) => number }) => ({
                  validator: (_: any, value: number) => {
                    const reportedQuantity = getFieldValue('reported_quantity');
                    if (reportedQuantity !== undefined && value > reportedQuantity) {
                      return Promise.reject(new Error('合格数量不能大于完成数量'));
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
              label="不合格数量"
              placeholder="请输入不合格数量"
              rules={[{ required: true, message: '请输入不合格数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label="工时（小时）"
              placeholder="选填，默认按 0"
              min={0}
              fieldProps={{ precision: 2, step: 0.1 }}
            />
            <ProFormTextArea
              name="correction_reason"
              label="修正原因"
              placeholder="请输入修正原因（必填）"
              rules={[{ required: true, message: '请输入修正原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>


      <DetailDrawerTemplate
        title={`报工记录详情${reportingDetail?.work_order_code ? ` - ${reportingDetail.work_order_code}` : ''}`}
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
        dataSource={reportingDetail || undefined}
        customContent={
          reportingDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(reportingDetail, reportingDetailBaseColumns)}
                />
                {reportingDetail.sop_parameters && Object.keys(reportingDetail.sop_parameters).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>SOP 参数</Typography.Text>
                    <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(reportingDetail.sop_parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
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

              <DetailDrawerSection title="明细信息">
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
                        { title: '类型', dataIndex: 'binding_type', width: 100, ellipsis: true },
                        { title: '物料编码', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const },
                        { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                        { title: '绑定方式', dataIndex: 'binding_method', width: 100 },
                      ]}
                      dataSource={detailMaterialBindings}
                      pagination={false}
                      rowKey={(r: any) => String(r.id ?? `${r.material_code}-${r.binding_type}`)}
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无物料绑定明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
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
