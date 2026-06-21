import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
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
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, Steps, Timeline, Card, Divider } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EyeOutlined, UserOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { exceptionApi } from '../../../services/production';
import { getExceptionProcessLifecycle } from '../../../utils/exceptionProcessLifecycle';
import { apiRequest } from '../../../../../services/api';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { exceptionProcessBatchCancelAllowed } from '../../../../../hooks/useDocumentCapabilities';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const EXCEPTION_PROCESS_RESOURCE = 'kuaizhizao:production-execution-reporting';

const P = 'app.kuaizhizao.productionException';
const PROC = `${P}.process`;

interface ExceptionProcessRecord {
  id?: number;
  uuid?: string;
  exception_type?: string;
  exception_id?: number;
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
      return <Tag color={item.color}>{item.text}</Tag>;
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
      return <Tag color={item.color}>{item.text}</Tag>;
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

  const processStatusValueEnum = useMemo(
    () => ({
      pending: t(`${P}.status.pending`),
      processing: t(`${P}.status.processing`),
      resolved: t(`${P}.status.resolved`),
      cancelled: t(`${P}.status.cancelled`),
    }),
    [t],
  );

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
          exceptionApi.materialShortage.list({ limit: 1000 }).catch(() => []),
          exceptionApi.deliveryDelay.list({ limit: 1000 }).catch(() => []),
          exceptionApi.quality.list({ limit: 1000 }).catch(() => []),
        ]);

        const exceptions: any[] = [];
        (Array.isArray(materialShortage) ? materialShortage : []).forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'material_shortage',
            display_name: t(`${PROC}.displayName.materialShortage`, { code: item.work_order_code }),
          });
        });
        (Array.isArray(deliveryDelay) ? deliveryDelay : []).forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'delivery_delay',
            display_name: t(`${PROC}.displayName.deliveryDelay`, { code: item.work_order_code }),
          });
        });
        (Array.isArray(quality) ? quality : []).forEach((item: any) => {
          exceptions.push({
            ...item,
            exception_type: 'quality',
            display_name: t(`${PROC}.displayName.quality`, {
              code: item.work_order_code || item.material_code,
            }),
          });
        });

        setExceptionList(exceptions);
      } catch (error) {
        console.error('获取异常列表失败:', error);
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

  const handleStart = async (values: any) => {
    try {
      await exceptionApi.process.start({
        exception_type: values.exception_type,
        exception_id: values.exception_id,
        assigned_to: values.assigned_to,
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
      await exceptionApi.process.assign(String(currentRecord.id), {
        assigned_to: values.assigned_to,
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
      title: t(`${P}.col.exceptionType`),
      dataIndex: 'exception_type',
      width: 120,
      render: (_, record) => getExceptionTypeTag(record.exception_type),
    },
    {
      title: t(`${P}.col.exceptionId`),
      dataIndex: 'exception_id',
      width: 100,
    },
    {
      title: t(`${P}.col.lifecycle`),
      dataIndex: 'lifecycle_stage',
      render: (_, record) => {
        const lifecycle = getExceptionProcessLifecycle(record as unknown as Record<string, unknown>, t);
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
      title: t(`${P}.col.currentStep`),
      dataIndex: 'current_step',
      width: 120,
      render: (_, record) => getStepTag(record.current_step),
    },
    {
      title: t(`${P}.col.assignedTo`),
      dataIndex: 'assigned_to_name',
      width: 120,
    },
    {
      title: t(`${P}.col.startTime`),
      dataIndex: 'started_at',
      width: 180,
      render: (_, record) =>
        record.started_at ? formatDateTime(record.started_at, 'YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t(`${P}.col.endTime`),
      dataIndex: 'completed_at',
      width: 180,
      render: (_, record) =>
        record.completed_at ? formatDateTime(record.completed_at, 'YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>,
            record.process_status === 'pending' ? (
              <Button {...rowActionKind('audit')} key="approve" onClick={() => openAssignModal(record)}>
                {t(`${P}.action.assign`)}
              </Button>
            ) : null,
            record.process_status === 'processing' ? (
              <Button {...rowActionKind('audit')} key="transition" onClick={() => openStepTransitionModal(record)}>
                {t(`${P}.action.transition`)}
              </Button>
            ) : null,
            record.process_status === 'processing' ? (
              <Button key="resolve" {...rowActionKind('audit')} onClick={() => openResolveModal(record)}>
                {t(`${P}.lifecycleNext.resolve`)}
              </Button>
            ) : null,
            ['pending', 'processing'].includes(record.process_status || '') ? (
              <Button key="reject" {...rowActionKind('reject')} onClick={() => handleCancel(record)}>
                {t(`${P}.action.cancel`)}
              </Button>
            ) : null,
          ],
          { keyPrefix: `exception-process-actions-${record.id ?? 'row'}` },
        ),
    },
  ], [t, getExceptionTypeTag, getStepTag]);

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
      { title: t(`${P}.col.exceptionId`), dataIndex: 'exception_id' },
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
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.exception-process"
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            if (searchFormValues?.exception_type) {
              apiParams.exception_type = searchFormValues.exception_type;
            }
            if (searchFormValues?.process_status) {
              apiParams.process_status = searchFormValues.process_status;
            }
            if (searchFormValues?.assigned_to) {
              apiParams.assigned_to = searchFormValues.assigned_to;
            }

            try {
              const result = await exceptionApi.process.list(apiParams);
              return {
                data: Array.isArray(result) ? result : (result?.data || result?.items || []),
                success: true,
                total: Array.isArray(result) ? result.length : (result?.total || result?.count || 0),
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
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={() => openStartModal()}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await exceptionApi.process.cancel(String(id));
              }
              messageApi.success(t(`${PROC}.message.batchCancelSuccess`, { count: keys.length }));
              invalidateMenuBadgeCounts();
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t(`${PROC}.message.cancelFailed`));
            }
          }}
          deleteConfirmTitle={(count) => t(`${PROC}.confirm.batchCancel`, { count })}
          toolBarActionsAfterDelete={[
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
              name: 'assigned_to',
              label: t(`${P}.col.assignedTo`),
              renderFormItem: () => <UniUserSelect name="assigned_to" />
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
              {currentRecord.process_status === 'pending' && (
                <Button icon={<UserOutlined />} onClick={() => openAssignModal(currentRecord)}>
                  {t(`${P}.action.assign`)}
                </Button>
              )}
              {currentRecord.process_status === 'processing' && (
                <>
                  <Button icon={<ArrowRightOutlined />} onClick={() => openStepTransitionModal(currentRecord)}>
                    {t(`${P}.action.stepTransition`)}
                  </Button>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openResolveModal(currentRecord)}>
                    {t(`${P}.lifecycleNext.resolve`)}
                  </Button>
                </>
              )}
              <Button danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(currentRecord)}>
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
                exception_id: currentRecord.exception_id,
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
        formItems={[
          {
            name: 'exception_type',
            label: t(`${P}.col.exceptionType`),
            valueType: 'select',
            rules: [{ required: true, message: t(`${PROC}.validation.exceptionTypeRequired`) }],
            valueEnum: exceptionTypeValueEnum,
            fieldProps: {
              onChange: (_: string) => {
                const form = (document.querySelector('.ant-pro-form') as any)?.__form;
                if (form) {
                  form.setFieldsValue({ exception_id: undefined });
                }
              },
            },
          },
          {
            name: 'exception_id',
            label: t(`${PROC}.field.exceptionRecord`),
            valueType: 'select',
            rules: [{ required: true, message: t(`${PROC}.validation.exceptionRecordRequired`) }],
            dependencies: ['exception_type'],
            request: async (params: any) => {
              const exceptionType = params.exception_type;
              if (!exceptionType) {
                return [];
              }
              const filtered = exceptionList.filter((item) => item.exception_type === exceptionType);
              return filtered.map((item) => ({
                label: item.display_name || `${item.id}`,
                value: item.id,
              }));
            },
          },
          {
            name: 'assigned_to',
            label: t(`${P}.col.assignedTo`),
            renderFormItem: () => <UniUserSelect name="assigned_to" />
          },
          {
            name: 'remarks',
            label: t(`${P}.field.remarks`),
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      <FormModalTemplate
        title={t(`${PROC}.modal.assign`)}
        open={assignModalVisible}
        onClose={() => {
          setAssignModalVisible(false);
        }}
        onFinish={handleAssign}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'assigned_to',
            label: t(`${P}.col.assignedTo`),
            rules: [{ required: true, message: t(`${PROC}.validation.assigneeRequired`) }],
            renderFormItem: () => <UniUserSelect name="assigned_to" />
          },
          {
            name: 'comment',
            label: t(`${P}.field.remarks`),
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      <FormModalTemplate
        title={t(`${PROC}.modal.stepTransition`)}
        open={stepTransitionModalVisible}
        onClose={() => {
          setStepTransitionModalVisible(false);
        }}
        onFinish={handleStepTransition}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'to_step',
            label: t(`${PROC}.field.targetStep`),
            valueType: 'select',
            rules: [{ required: true, message: t(`${PROC}.validation.targetStepRequired`) }],
            valueEnum: stepValueEnum,
          },
          {
            name: 'comment',
            label: t(`${P}.field.remarks`),
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      <FormModalTemplate
        title={t(`${PROC}.modal.resolve`)}
        open={resolveModalVisible}
        onClose={() => {
          setResolveModalVisible(false);
        }}
        onFinish={handleResolve}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'comment',
            label: t(`${P}.field.remarks`),
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
          {
            name: 'verification_result',
            label: t(`${P}.quality.field.verificationResult`),
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />
    </>
  );
};

export default ExceptionProcessPage;
