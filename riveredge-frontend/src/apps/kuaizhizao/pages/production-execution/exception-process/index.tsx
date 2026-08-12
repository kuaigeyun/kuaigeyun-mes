import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 异常处理流程管理页面
 *
 * 提供异常处理流程管理功能，包括流程启动、分配、步骤流转、解决、取消等。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import {
  ActionType,
  ProColumns,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, Steps, Timeline, Card, Divider } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EyeOutlined, UserOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { UniTable } from '../../../../../components/uni-table';
import { UNI_TABLE_OPERATION_STEPS_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { resolveUserDisplay } from '../../../../../services/user';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { exceptionApi } from '../../../services/production';
import {
  ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES,
  ACTIVE_QUALITY_EXCEPTION_STATUSES,
} from '../../../constants/exceptionStatuses';
import { apiRequest } from '../../../../../services/api';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { exceptionProcessBatchCancelAllowed } from '../../../../../hooks/useDocumentCapabilities';
import { formatDateTime } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import {
  buildExceptionProcessStatusValueEnum,
  resolveProductionExceptionListStatusParams,
} from '../../../utils/productionExceptionList';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { WorkOrderOperationStepsStrip } from '../work-orders/components/WorkOrderOperationStepsStrip';
import type { WorkOrderOperationStep } from '../work-orders/workOrderOperationSteps';

const EXCEPTION_PROCESS_RESOURCE = 'kuaizhizao:production-execution-exception-process';

const P = 'app.kuaizhizao.productionException';
const PROC = `${P}.process`;

/** 异常处理流程标准步骤（与详情 Steps 一致；取消单独成节点） */
const EXCEPTION_PROCESS_STEP_KEYS = [
  'detected',
  'assigned',
  'investigating',
  'handling',
  'verifying',
  'closed',
] as const;

function exceptionProcessStepLabel(t: (key: string) => string, key: string): string {
  if (key === 'cancelled') return t(`${P}.status.cancelled`);
  const map: Record<string, string> = {
    detected: `${P}.step.detected`,
    assigned: `${P}.step.assigned`,
    investigating: `${P}.step.investigating`,
    handling: `${P}.step.handling`,
    verifying: `${P}.step.verifying`,
    closed: `${P}.step.closed`,
  };
  return t(map[key] || `${P}.exceptionType.unknown`);
}

function buildExceptionProcessStepNodes(
  t: (key: string) => string,
  currentStep?: string,
  processStatus?: string,
): WorkOrderOperationStep[] {
  const cancelled = processStatus === 'cancelled' || currentStep === 'cancelled';
  const resolved = processStatus === 'resolved' || currentStep === 'closed';
  const keys: string[] = cancelled
    ? [...EXCEPTION_PROCESS_STEP_KEYS.filter((k) => k !== 'closed'), 'cancelled']
    : [...EXCEPTION_PROCESS_STEP_KEYS];
  const activeKey = cancelled ? 'cancelled' : resolved ? 'closed' : currentStep || 'detected';
  let activeIdx = keys.findIndex((k) => k === activeKey);
  if (activeIdx < 0) activeIdx = 0;

  return keys.map((key, index) => {
    let status: WorkOrderOperationStep['status'] = 'pending';
    if (resolved) {
      status = 'done';
    } else if (index < activeIdx) {
      status = 'done';
    } else if (index === activeIdx) {
      status = 'active';
    }
    return {
      name: exceptionProcessStepLabel(t, key),
      sequence: index + 1,
      status,
    };
  });
}

interface ExceptionProcessRecord {
  id?: number;
  uuid?: string;
  exception_type?: string;
  exception_id?: number;
  work_order_code?: string;
  work_order_id?: number;
  process_status?: string;
  current_step?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  remarks?: string;
  created_at?: string;
  histories?: ExceptionProcessHistory[];
  capabilities?: {
    cancel?: { allowed: boolean; reason?: string | null };
  };
}

interface ExceptionProcessHistory {
  id?: number;
  action?: string;
  action_by?: number;
  action_by_name?: string;
  action_at?: string;
  from_step?: string;
  to_step?: string;
  comment?: string;
}

const ExceptionProcessPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const startFormRef = useRef<ProFormInstance>();
  const assignFormRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<ExceptionProcessRecord[]>([]);
  const exceptionProcessPerms = useResourcePermissions(EXCEPTION_PROCESS_RESOURCE);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ExceptionProcessRecord | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [stepTransitionModalVisible, setStepTransitionModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [exceptionList, setExceptionList] = useState<any[]>([]);

  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ExceptionProcessRecord => row != null),
    [selectedRowKeys],
  );

  const handleExceptionProcessBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts]);

  const getStatusTag = useCallback(
    (status?: string) => {
      const statusMap: Record<string, { color: string; text: string }> = {
        pending: { color: 'default', text: t(`${P}.status.pending`) },
        processing: { color: 'processing', text: t(`${P}.status.processing`) },
        resolved: { color: 'success', text: t(`${P}.status.resolved`) },
        cancelled: { color: 'error', text: t(`${P}.status.cancelled`) },
      };
      const item = statusMap[status || 'pending'] || statusMap.pending;
      return <StatusTag color={item.color}>{item.text}</StatusTag>;
    },
    [t],
  );

  const getExceptionTypeTag = useCallback(
    (type?: string) => {
      const typeMap: Record<string, { color: string; text: string }> = {
        material_shortage: { color: 'orange', text: t(`${P}.exceptionType.materialShortage`) },
        delivery_delay: { color: 'red', text: t(`${P}.exceptionType.deliveryDelay`) },
        quality: { color: 'purple', text: t(`${P}.exceptionType.quality`) },
      };
      const item = typeMap[type || ''] || { color: 'default', text: type || t(`${P}.exceptionType.unknown`) };
      return <MarkerTag color={item.color}>{item.text}</MarkerTag>;
    },
    [t],
  );

  const getStepTag = useCallback(
    (step?: string) => {
      const stepMap: Record<string, { color: string; text: string }> = {
        detected: { color: 'blue', text: t(`${P}.step.detected`) },
        assigned: { color: 'cyan', text: t(`${P}.step.assigned`) },
        investigating: { color: 'orange', text: t(`${P}.step.investigating`) },
        handling: { color: 'processing', text: t(`${P}.step.handling`) },
        verifying: { color: 'purple', text: t(`${P}.step.verifying`) },
        closed: { color: 'success', text: t(`${P}.step.closed`) },
        cancelled: { color: 'error', text: t(`${P}.status.cancelled`) },
      };
      const item = stepMap[step || ''] || { color: 'default', text: step || t(`${P}.exceptionType.unknown`) };
      return <Tag color={item.color}>{item.text}</Tag>;
    },
    [t],
  );

  const stepValueEnum = useMemo(
    () => ({
      detected: t(`${P}.step.detected`),
      assigned: t(`${P}.step.assigned`),
      investigating: t(`${P}.step.investigating`),
      handling: t(`${P}.step.handling`),
      verifying: t(`${P}.step.verifying`),
      closed: t(`${P}.step.closed`),
    }),
    [t],
  );

  const exceptionTypeValueEnum = useMemo(
    () => ({
      material_shortage: t(`${P}.exceptionType.materialShortage`),
      delivery_delay: t(`${P}.exceptionType.deliveryDelay`),
      quality: t(`${P}.exceptionType.quality`),
    }),
    [t],
  );

  const processStatusValueEnum = useMemo(() => buildExceptionProcessStatusValueEnum(t), [t]);

  const handleDetail = async (record: ExceptionProcessRecord) => {
    try {
      const detail = await exceptionApi.process.get(String(record.id));
      setCurrentRecord(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t(`${P}.message.fetchDetailFailed`));
    }
  };

  useEffect(() => {
    const loadExceptions = async () => {
      try {
        const [materialShortage, deliveryDelay, quality] = await Promise.all([
          exceptionApi.materialShortage.list({ limit: 1000, statuses: ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES }),
          exceptionApi.deliveryDelay.list({ limit: 1000, statuses: ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES }),
          exceptionApi.quality.list({ limit: 1000, statuses: ACTIVE_QUALITY_EXCEPTION_STATUSES }),
        ]);

        const exceptions: any[] = [];
        materialShortage.items.forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'material_shortage',
            display_name: t(`${PROC}.displayName.materialShortage`, { code: item.work_order_code }),
          });
        });
        deliveryDelay.items.forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'delivery_delay',
            display_name: t(`${PROC}.displayName.deliveryDelay`, { code: item.work_order_code }),
          });
        });
        quality.items.forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'quality',
            display_name: t(`${PROC}.displayName.quality`, {
              code: item.work_order_code || item.material_code,
            }),
          });
        });

        setExceptionList(exceptions);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t(`${P}.message.fetchListFailed`);
        messageApi.error(message);
      }
    };
    loadExceptions();
  }, [t]);

  const openStartModal = (record?: ExceptionProcessRecord) => {
    if (record) {
      setCurrentRecord(record);
    }
    setStartModalVisible(true);
  };
  useNewShortcut(() => openStartModal());
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t(`${PROC}.createButton`)),
    [t],
  );

  const resolveAssigneeUserId = (raw: unknown): number | undefined => {
    if (raw == null || raw === '') return undefined;
    const id = Number(raw);
    return Number.isFinite(id) ? id : undefined;
  };

  const handleStart = async (values: any) => {
    try {
      await exceptionApi.process.start({
        exception_type: values.exception_type,
        exception_id: values.exception_id,
        assigned_to: resolveAssigneeUserId(values.assigned_to),
        remarks: values.remarks,
      });
      messageApi.success(t(`${PROC}.message.startSuccess`));
      setStartModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t(`${PROC}.message.startFailed`));
    }
  };

  const openAssignModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setAssignModalVisible(true);
  };

  const handleAssign = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.processRecordNotFound`));
      }
      const assignedTo = resolveAssigneeUserId(values.assigned_to);
      if (assignedTo == null) {
        messageApi.error(t(`${PROC}.validation.assigneeRequired`));
        return;
      }
      await exceptionApi.process.assign(String(currentRecord.id), {
        assigned_to: assignedTo,
        comment: values.comment,
      });
      messageApi.success(t(`${PROC}.message.assignSuccess`));
      setAssignModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible) {
        handleDetail(currentRecord);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t(`${PROC}.message.assignFailed`));
    }
  };

  const openStepTransitionModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setStepTransitionModalVisible(true);
  };

  const handleStepTransition = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.processRecordNotFound`));
      }
      await exceptionApi.process.stepTransition(String(currentRecord.id), {
        to_step: values.to_step,
        comment: values.comment,
      });
      messageApi.success(t(`${PROC}.message.transitionSuccess`));
      setStepTransitionModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible) {
        handleDetail(currentRecord);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t(`${PROC}.message.transitionFailed`));
    }
  };

  const openResolveModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setResolveModalVisible(true);
  };

  const handleResolve = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.processRecordNotFound`));
      }
      await exceptionApi.process.resolve(String(currentRecord.id), {
        comment: values.comment,
        verification_result: values.verification_result,
      });
      messageApi.success(t(`${PROC}.message.resolveSuccess`));
      setResolveModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setDetailDrawerVisible(false);
    } catch (error: any) {
      messageApi.error(error?.message || t(`${PROC}.message.resolveFailed`));
    }
  };

  const handleCancel = async (record: ExceptionProcessRecord) => {
    Modal.confirm({
      title: t(`${PROC}.confirm.cancelTitle`),
      content: t(`${PROC}.confirm.cancelContent`),
      onOk: async () => {
        try {
          await exceptionApi.process.cancel(String(record.id));
          messageApi.success(t(`${PROC}.message.cancelSuccess`));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setDetailDrawerVisible(false);
        } catch (error: any) {
          messageApi.error(error?.message || t(`${PROC}.message.cancelFailed`));
        }
      },
    });
  };

  const columns: ProColumns<ExceptionProcessRecord>[] = useMemo(() => [
    {
      title: t(`${P}.col.workOrderCode`),
      key: 'exception_doc_work_order_code',
      dataIndex: 'work_order_code',
      width: 180,
      uniTableKeepWidth: true,
      fixed: 'left',
      ellipsis: false,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t(`${P}.col.exceptionType`),
      key: 'exception_process_type',
      dataIndex: 'exception_type',
      width: 120,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: exceptionTypeValueEnum,
      render: (_, record) => getExceptionTypeTag(record.exception_type),
    },
    {
      title: t(`${P}.col.currentStep`),
      key: 'exception_process_steps',
      dataIndex: 'current_step',
      ...UNI_TABLE_OPERATION_STEPS_COLUMN_DEFAULTS,
      className: 'uni-table-operation-steps-cell',
      onHeaderCell: () => ({ className: 'uni-table-operation-steps-cell' }),
      onCell: () => ({ className: 'uni-table-operation-steps-cell' }),
      hideInSearch: true,
      render: (_, record) => (
        <WorkOrderOperationStepsStrip
          steps={buildExceptionProcessStepNodes(t, record.current_step, record.process_status)}
        />
      ),
    },
    {
      title: t(`${P}.col.assignedTo`),
      dataIndex: 'assigned_to_name',
      width: 120,
    },
    {
      title: t(`${P}.col.startTime`),
      dataIndex: 'started_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.started_at ? formatDateTime(record.started_at, 'YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t(`${P}.col.endTime`),
      dataIndex: 'completed_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.completed_at ? formatDateTime(record.completed_at, 'YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t(`${P}.col.processStatus`),
      key: 'lifecycle',
      dataIndex: 'process_status',
      fixed: 'right',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: processStatusValueEnum,
      render: (_, record) => getStatusTag(record.process_status),
    },
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      render: (_, record) => {
        const status = record.process_status || '';
        const canAssign = status === 'pending' || status === 'processing';
        // 历史数据：创建时已带处理人但仍停在 pending 时，仍允许步骤流转/解决
        const canExecute =
          status === 'processing' || (status === 'pending' && record.assigned_to != null);
        const canCancel = status === 'pending' || status === 'processing';
        return [
          <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
          canAssign ? (
            <Button key="assign" {...rowActionKind('assign')} onClick={() => openAssignModal(record)}>
              {t(`${P}.action.assign`)}
            </Button>
          ) : null,
          canExecute ? (
            <Button
              key="transition"
              {...rowActionKind('execute')}
              onClick={() => openStepTransitionModal(record)}
            >
              {t(`${P}.action.transition`)}
            </Button>
          ) : null,
          canExecute ? (
            <Button key="resolve" {...rowActionKind('execute')} onClick={() => openResolveModal(record)}>
              {t(`${P}.lifecycleNext.resolve`)}
            </Button>
          ) : null,
          canCancel ? (
            <Button key="cancel" {...rowActionKind('revoke')} onClick={() => handleCancel(record)}>
              {t(`${P}.action.cancel`)}
            </Button>
          ) : null,
        ];
      },
    },
  ], [t, getExceptionTypeTag, getStatusTag, processStatusValueEnum, exceptionTypeValueEnum]);

  const getStepsConfig = useCallback(
    (currentStep?: string) => {
      const steps = [
        { title: t(`${P}.step.detected`), key: 'detected' },
        { title: t(`${P}.step.assigned`), key: 'assigned' },
        { title: t(`${P}.step.investigating`), key: 'investigating' },
        { title: t(`${P}.step.handling`), key: 'handling' },
        { title: t(`${P}.step.verifying`), key: 'verifying' },
        { title: t(`${P}.step.closed`), key: 'closed' },
      ];

      const currentIndex = steps.findIndex((s) => s.key === currentStep);
      return {
        current: currentIndex >= 0 ? currentIndex : 0,
        steps,
      };
    },
    [t],
  );

  const detailDescriptionColumns = useMemo(
    () => [
      { title: t(`${P}.col.exceptionType`), dataIndex: 'exception_type' },
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code' },
      { title: t(`${P}.col.processStatus`), dataIndex: 'process_status' },
      { title: t(`${P}.col.currentStep`), dataIndex: 'current_step' },
      { title: t(`${P}.col.assignedTo`), dataIndex: 'assigned_to_name' },
      { title: t(`${P}.col.assignedAt`), dataIndex: 'assigned_at' },
      { title: t(`${P}.col.startTime`), dataIndex: 'started_at' },
      { title: t(`${P}.col.endTime`), dataIndex: 'completed_at' },
      { title: t(`${P}.field.remarks`), dataIndex: 'remarks', span: 2 },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ExceptionProcessRecord>
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.exception-process.v3"
          actionRef={actionRef}
          columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
          request={async (params, sort, _filter, searchFormValues) => {
            const s = searchFormValues ?? {};
            const statusParams = resolveProductionExceptionListStatusParams(s, 'process_status');
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

            const apiParams: Record<string, unknown> = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              order_by: orderBy,
              ...statusParams,
            };

            if (s.exception_type) {
              apiParams.exception_type = s.exception_type;
            }
            const assigneeUuid = String(s.assigned_to_uuid ?? '').trim();
            if (assigneeUuid) {
              const resolved = await resolveUserDisplay({ user_uuids: [assigneeUuid] });
              const assigneeId = resolved[0]?.id;
              if (assigneeId != null) {
                apiParams.assigned_to = assigneeId;
              }
            }
            if (fuzzyKeyword) {
              apiParams.keyword = fuzzyKeyword;
            } else if (s.assigned_to_name != null && String(s.assigned_to_name).trim()) {
              apiParams.assigned_to_name = String(s.assigned_to_name).trim();
            }

            const createdRange = s.created_at_range as [unknown, unknown] | undefined;
            if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
              apiParams.created_start_date = formatDateTime(
                createdRange[0] as string | Date,
                'YYYY-MM-DD',
              );
              apiParams.created_end_date = createdRange[1]
                ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                : apiParams.created_start_date;
            }

            try {
              const page = await exceptionApi.process.list(apiParams);
              return {
                data: page.items,
                success: true,
                total: page.total,
              };
            } catch (error: any) {
              console.error('获取异常处理流程列表失败:', error);
              messageApi.error(error?.message || t(`${P}.message.fetchListFailed`));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          rowKey="id"
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField="process_status"
          pinnedTabsValueEnum={processStatusValueEnum}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={() => openStartModal()}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={false}
          toolBarActions={[
            <UniCapabilityBatchButton
              key="exception-process-batch-cancel"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRecordsForBatch}
              capabilityKey="cancel"
              permAllowed={exceptionProcessPerms.canAction?.('revoke') ?? false}
              batchAllowed={(records, perm) => exceptionProcessBatchCancelAllowed(records, perm)}
              onRun={(id) => exceptionApi.process.cancel(String(id))}
              labels={{
                single: t(`${PROC}.batch.cancel`),
                batch: t(`${PROC}.batch.cancel`),
              }}
              icon={<RollbackOutlined />}
              size="middle"
              onSuccess={handleExceptionProcessBatchSuccess}
            />,
          ]}
          searchFormItems={[
            {
              name: 'exception_type',
              label: t(`${P}.col.exceptionType`),
              valueType: 'select',
              valueEnum: exceptionTypeValueEnum,
            },
            {
              name: 'process_status',
              label: t(`${P}.col.processStatus`),
              valueType: 'select',
              valueEnum: processStatusValueEnum,
            },
            {
              name: 'assigned_to_uuid',
              label: t(`${P}.col.assignedTo`),
              renderFormItem: () => <UniUserSelect name="assigned_to_uuid" />,
            },
          ]}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t(`${PROC}.detailTitle`)}
        visible={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentRecord && ['pending', 'processing'].includes(currentRecord.process_status || '') ? (
            <Space>
              <Button
                {...rowActionKind('assign')}
                icon={<UserOutlined />}
                onClick={() => openAssignModal(currentRecord)}
              >
                {t(`${P}.action.assign`)}
              </Button>
              {(currentRecord.process_status === 'processing' ||
                (currentRecord.process_status === 'pending' && currentRecord.assigned_to != null)) && (
                <>
                  <Button
                    {...rowActionKind('execute')}
                    icon={<ArrowRightOutlined />}
                    onClick={() => openStepTransitionModal(currentRecord)}
                  >
                    {t(`${P}.action.stepTransition`)}
                  </Button>
                  <Button
                    {...rowActionKind('execute')}
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => openResolveModal(currentRecord)}
                  >
                    {t(`${P}.lifecycleNext.resolve`)}
                  </Button>
                </>
              )}
              <Button
                {...rowActionKind('revoke')}
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancel(currentRecord)}
              >
                {t(`${P}.action.cancel`)}
              </Button>
            </Space>
          ) : null
        }
      >
        {currentRecord && (
          <div>
            <ProDescriptions
              column={2}
              bordered
              dataSource={{
                exception_type: getExceptionTypeTag(currentRecord.exception_type),
                work_order_code: currentRecord.work_order_code || '-',
                process_status: getStatusTag(currentRecord.process_status),
                current_step: getStepTag(currentRecord.current_step),
                assigned_to_name: currentRecord.assigned_to_name || '-',
                assigned_at: currentRecord.assigned_at ? formatDateTime(currentRecord.assigned_at, 'YYYY-MM-DD HH:mm:ss') : '-',
                started_at: currentRecord.started_at ? formatDateTime(currentRecord.started_at, 'YYYY-MM-DD HH:mm:ss') : '-',
                completed_at: currentRecord.completed_at ? formatDateTime(currentRecord.completed_at, 'YYYY-MM-DD HH:mm:ss') : '-',
                remarks: currentRecord.remarks || '-',
              }}
              columns={detailDescriptionColumns}
            />

            <Divider />

            <Card title={t(`${PROC}.section.flow`)} style={{ marginBottom: 16 }}>
              <Steps
                {...getStepsConfig(currentRecord.current_step)}
                items={getStepsConfig(currentRecord.current_step).steps.map((step) => ({ title: step.title }))}
              />
            </Card>

            {currentRecord.histories && currentRecord.histories.length > 0 && (
              <Card title={t(`${PROC}.section.history`)}>
                <Timeline>
                  {currentRecord.histories.map((history, index) => (
                    <Timeline.Item key={index}>
                      <div>
                        <div>
                          <strong>{history.action_by_name}</strong> - {history.action}
                          {history.from_step && history.to_step && (
                            <span>
                              {' '}
                              ({history.from_step} → {history.to_step})
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
                          {formatDateTime(history.action_at, 'YYYY-MM-DD HH:mm:ss')}
                        </div>
                        {history.comment && <div style={{ marginTop: 8 }}>{history.comment}</div>}
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </div>
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title={t(`${PROC}.modal.start`)}
        open={startModalVisible}
        onClose={() => {
          setStartModalVisible(false);
          setCurrentRecord(null);
        }}
        onFinish={handleStart}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={startFormRef}
      >
        <ProFormSelect
          name="exception_type"
          label={t(`${P}.col.exceptionType`)}
          valueEnum={exceptionTypeValueEnum}
          rules={[{ required: true, message: t(`${PROC}.validation.exceptionTypeRequired`) }]}
          fieldProps={{
            onChange: () => {
              startFormRef.current?.setFieldsValue({ exception_id: undefined });
            },
          }}
        />
        <ProFormDependency name={['exception_type']}>
          {({ exception_type: exceptionType }) => {
            const options = exceptionList
              .filter((item) => item.exception_type === exceptionType)
              .map((item) => ({
                label: item.display_name || String(item.id),
                value: item.id,
              }));
            return (
              <ProFormSelect
                name="exception_id"
                label={t(`${PROC}.field.exceptionRecord`)}
                rules={[{ required: true, message: t(`${PROC}.validation.exceptionRecordRequired`) }]}
                options={options}
                disabled={!exceptionType}
              />
            );
          }}
        </ProFormDependency>
        <UniUserSelect
          name="assigned_to_uuid"
          label={t(`${P}.col.assignedTo`)}
          onChange={(_, user) => {
            const picked = Array.isArray(user) ? user[0] : user;
            startFormRef.current?.setFieldsValue({
              assigned_to: picked?.id ?? undefined,
            });
          }}
        />
        <ProFormText name="assigned_to" hidden />
        <ProFormTextArea
          name="remarks"
          label={t(`${P}.field.remarks`)}
          fieldProps={{ rows: 4 }}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${PROC}.modal.assign`)}
        open={assignModalVisible}
        onClose={() => {
          setAssignModalVisible(false);
        }}
        onFinish={handleAssign}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={assignFormRef}
      >
        <UniUserSelect
          name="assigned_to_uuid"
          label={t(`${P}.col.assignedTo`)}
          required
          rules={[{ required: true, message: t(`${PROC}.validation.assigneeRequired`) }]}
          onChange={(_, user) => {
            const picked = Array.isArray(user) ? user[0] : user;
            assignFormRef.current?.setFieldsValue({
              assigned_to: picked?.id ?? undefined,
            });
          }}
        />
        <ProFormText name="assigned_to" hidden />
        <ProFormTextArea
          name="comment"
          label={t(`${P}.field.remarks`)}
          fieldProps={{ rows: 4 }}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${PROC}.modal.stepTransition`)}
        open={stepTransitionModalVisible}
        onClose={() => {
          setStepTransitionModalVisible(false);
        }}
        onFinish={handleStepTransition}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="to_step"
          label={t(`${PROC}.field.targetStep`)}
          valueEnum={stepValueEnum}
          rules={[{ required: true, message: t(`${PROC}.validation.targetStepRequired`) }]}
        />
        <ProFormTextArea
          name="comment"
          label={t(`${P}.field.remarks`)}
          fieldProps={{ rows: 4 }}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${PROC}.modal.resolve`)}
        open={resolveModalVisible}
        onClose={() => {
          setResolveModalVisible(false);
        }}
        onFinish={handleResolve}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormTextArea
          name="comment"
          label={t(`${P}.field.remarks`)}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea
          name="verification_result"
          label={t(`${P}.quality.field.verificationResult`)}
          fieldProps={{ rows: 4 }}
        />
      </FormModalTemplate>
    </>
  );
};

export default ExceptionProcessPage;
