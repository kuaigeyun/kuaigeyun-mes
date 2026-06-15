/**
 * 审批实例管理列表页面
 * 
 * 用于查看和管理组织内的审批实例。
 * 支持审批实例的查看、提交审批、审批操作等功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormItem, ProDescriptionsItemProps } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Button, Descriptions, Input, Space, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { useGlobalStore } from '../../../../stores';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import { theme } from 'antd';
import {
  getApprovalInstanceList,
  getApprovalInstanceByUuid,
  createApprovalInstance,
  performApprovalAction,
  batchPerformApprovalActions,
  ApprovalInstance,
  CreateApprovalInstanceData,
  ApprovalInstanceActionData,
} from '../../../../services/approvalInstance';
import { getApprovalProcessList } from '../../../../services/approvalProcess';
import { rowActionKind } from '../../../../components/uni-action';

const { TextArea } = Input;

/**
 * 审批实例管理列表页面组件
 */
const ApprovalInstanceListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const approvalInstanceDetailReqRef = useRef(0);
  const [tableData, setTableData] = useState<ApprovalInstance[]>([]);
  
  // Modal 相关状态（提交审批）
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitFormLoading, setSubmitFormLoading] = useState(false);
  
  // Modal 相关状态（审批操作）
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionFormLoading, setActionFormLoading] = useState(false);
  const [currentInstanceUuid, setCurrentInstanceUuid] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'cancel' | 'transfer'>('approve');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ApprovalInstance | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  /**
   * 处理提交审批
   */
  const handleSubmit = () => {
    setSubmitModalVisible(true);
  };

  /**
   * 处理提交审批表单
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      setSubmitFormLoading(true);
      
      const data: CreateApprovalInstanceData = {
        process_uuid: values.process_uuid,
        title: values.title,
        content: values.content,
        data: values.data ? JSON.parse(values.data) : undefined,
      };
      
      await createApprovalInstance(data);
      messageApi.success(t('pages.system.approvalInstances.submitSuccess'));
      setSubmitModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.approvalInstances.submitFailed'));
      throw error;
    } finally {
      setSubmitFormLoading(false);
    }
  };

  /**
   * 处理审批操作
   */
  const handleAction = (record: ApprovalInstance, action: 'approve' | 'reject' | 'cancel' | 'transfer') => {
    setCurrentInstanceUuid(record.uuid);
    setActionType(action);
    setActionModalVisible(true);
  };

  const handleActionForm = async (values: any): Promise<void> => {
    if (!currentInstanceUuid) return;
    
    try {
      setActionFormLoading(true);
      
      const actionData: ApprovalInstanceActionData = {
        action: actionType,
        comment: values.comment,
        transfer_to_user_id: actionType === 'transfer' ? values.transfer_to_user_id : undefined,
      };
      
      await performApprovalAction(currentInstanceUuid, actionData);
      messageApi.success(t('pages.system.approvalInstances.actionSuccess'));
      setActionModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.approvalInstances.actionFailed'));
      throw error;
    } finally {
      setActionFormLoading(false);
    }
  };

  const handleBatchApproval = async (action: 'approve' | 'reject') => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择待审批事项');
      return;
    }
    try {
      setBatchLoading(true);
      const result = await batchPerformApprovalActions({
        instance_uuids: selectedRowKeys,
        action,
      });
      if (result.failure_count > 0) {
        messageApi.warning(
          `批量${action === 'approve' ? '通过' : '驳回'}完成：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`,
        );
      } else {
        messageApi.success(`批量${action === 'approve' ? '通过' : '驳回'}成功 ${result.success_count} 条`);
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '批量审批失败');
    } finally {
      setBatchLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: ApprovalInstance) => {
    const req = ++approvalInstanceDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getApprovalInstanceByUuid(record.uuid);
      if (approvalInstanceDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (approvalInstanceDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.approvalInstances.getDetailFailed'));
      }
    } finally {
      if (approvalInstanceDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ApprovalInstance>[] = [
    {
      title: t('pages.system.approvalInstances.title'),
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.approvalInstances.relatedProcess'),
      dataIndex: 'process_uuid',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalInstances.status'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        pending: { text: t('pages.system.approvalInstances.statusPending'), status: 'Processing' },
        approved: { text: t('pages.system.approvalInstances.statusApproved'), status: 'Success' },
        rejected: { text: t('pages.system.approvalInstances.statusRejected'), status: 'Error' },
        cancelled: { text: t('pages.system.approvalInstances.statusCancelled'), status: 'Default' },
      },
      render: (_, record) => {
        const statusMap = {
          pending: { color: 'processing', text: t('pages.system.approvalInstances.statusPending') },
          approved: { color: 'success', text: t('pages.system.approvalInstances.statusApproved') },
          rejected: { color: 'error', text: t('pages.system.approvalInstances.statusRejected') },
          cancelled: { color: 'default', text: t('pages.system.approvalInstances.statusCancelled') },
        };
        const statusInfo = statusMap[record.status as keyof typeof statusMap] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.approvalInstances.currentNode'),
      dataIndex: 'current_node',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalInstances.submittedAt'),
      dataIndex: 'submitted_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalInstances.completedAt'),
      dataIndex: 'completed_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalInstances.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => {
        const actions = [
          <Button
            key="view"
            {...rowActionKind('read')}
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.system.approvalInstances.view')}
          </Button>,
        ];
        
        if (record.status === 'pending') {
          if (record.current_approver_id) {
            actions.push(
              <Button
                key="approve"
                {...rowActionKind('approve')}
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAction(record, 'approve')}
              >
                {t('pages.system.approvalInstances.approve')}
              </Button>,
              <Button
                key="reject"
                {...rowActionKind('reject')}
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleAction(record, 'reject')}
              >
                {t('pages.system.approvalInstances.reject')}
              </Button>,
              <Button
                key="transfer"
                {...rowActionKind('assign')}
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => handleAction(record, 'transfer')}
              >
                {t('pages.system.approvalInstances.transfer')}
              </Button>
            );
          }
          const isSubmitter = currentUser?.id != null && record.submitter_id === currentUser.id;
          if (isSubmitter) {
            actions.push(
              <Tooltip {...rowActionKind('skip')} key="cancel-tt" title={t('pages.system.approvalInstances.cancelOnlySubmitter')}>
                <Button
                  key="cancel"
                  {...rowActionKind('revoke')}
                  type="link"
                  size="small"
                  icon={<StopOutlined />}
                  onClick={() => handleAction(record, 'cancel')}
                >
                  {t('pages.system.approvalInstances.cancel')}
                </Button>
              </Tooltip>
            );
          }
        }

        return actions;
      },
    },
  ];

  /**
   * 渲染看板卡片
   */
  const renderKanbanCard = (item: ApprovalInstance, _status: string) => {
    const statusMap = {
      pending: { color: 'processing', text: t('pages.system.approvalInstances.statusPending') },
      approved: { color: 'success', text: t('pages.system.approvalInstances.statusApproved') },
      rejected: { color: 'error', text: t('pages.system.approvalInstances.statusRejected') },
      cancelled: { color: 'default', text: t('pages.system.approvalInstances.statusCancelled') },
    };
    const statusInfo = statusMap[item.status as keyof typeof statusMap] || { color: 'default', text: item.status };

    return (
      <div
        style={{
          padding: '12px',
          marginBottom: '8px',
          background: '#fff',
          borderRadius: themeToken.borderRadius,
          border: `1px solid ${themeToken.colorBorder}`,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => handleView(item)}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 2px 8px ${themeToken.colorFillSecondary}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {item.title}
          </Typography.Text>
        </div>
        {item.content && (
          <Typography.Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBottom: 8, fontSize: 12, color: themeToken.colorTextSecondary }}
          >
            {item.content}
          </Typography.Paragraph>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space size="small">
            <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
            {item.current_node && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {item.current_node}
              </Tag>
            )}
          </Space>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(item.submitted_at).toLocaleDateString()}
          </Typography.Text>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleView(item);
            }}
          >
            {t('pages.system.approvalInstances.view')}
          </Button>
        </div>
      </div>
    );
  };

  /**
   * 计算统计信息
   */
  const stats = useMemo(() => {
    if (!tableData || tableData.length === 0) {
      return null;
    }
    return {
      total: tableData.length,
      pending: tableData.filter((i) => i.status === 'pending').length,
      approved: tableData.filter((i) => i.status === 'approved').length,
      rejected: tableData.filter((i) => i.status === 'rejected').length,
      cancelled: tableData.filter((i) => i.status === 'cancelled').length,
    };
  }, [tableData]);

  /**
   * 详情列定义
   */
  const approvalInstanceDetailDescColumns = useMemo<ProDescriptionsItemProps<ApprovalInstance>[]>(
    () => [
      { title: t('pages.system.approvalInstances.title'), dataIndex: 'title' },
      { title: t('pages.system.approvalInstances.content'), dataIndex: 'content' },
      {
        title: t('pages.system.approvalInstances.status'),
        dataIndex: 'status',
        render: (_dom, entity: ApprovalInstance) => {
          const value = entity.status;
          const statusMap: Record<string, { color: string; text: string }> = {
            pending: { color: 'processing', text: t('pages.system.approvalInstances.statusPending') },
            approved: { color: 'success', text: t('pages.system.approvalInstances.statusApproved') },
            rejected: { color: 'error', text: t('pages.system.approvalInstances.statusRejected') },
            cancelled: { color: 'default', text: t('pages.system.approvalInstances.statusCancelled') },
          };
          const statusInfo = statusMap[value] || { color: 'default', text: value };
          return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
        },
      },
      { title: t('pages.system.approvalInstances.currentNode'), dataIndex: 'current_node' },
      { title: t('pages.system.approvalInstances.currentApproverId'), dataIndex: 'current_approver_id' },
      {
        title: t('pages.system.approvalInstances.approvalData'),
        dataIndex: 'data',
        render: (_dom, entity: ApprovalInstance) => (
          <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(entity.data, null, 2)}
          </pre>
        ),
      },
      { title: t('pages.system.approvalInstances.submittedAt'), dataIndex: 'submitted_at', valueType: 'dateTime' },
      { title: t('pages.system.approvalInstances.completedAt'), dataIndex: 'completed_at', valueType: 'dateTime' },
    ],
    [t]
  );

  return (
    <>
      <ListPageTemplate
        statCards={
          stats
            ? [
                {
                  title: t('pages.system.approvalInstances.statTotal'),
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: t('pages.system.approvalInstances.statusPending'),
                  value: stats.pending,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: t('pages.system.approvalInstances.statusApproved'),
                  value: stats.approved,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: t('pages.system.approvalInstances.statusRejected'),
                  value: stats.rejected,
                  valueStyle: { color: '#ff4d4f' },
                },
              ]
            : undefined
        }
      >
        <UniTable<ApprovalInstance>
          columnPersistenceId="pages.system.approval-processes.instances"
          headerTitle={t('pages.system.approvalInstances.headerTitle')}
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20 } = params;
            const skip = (current - 1) * pageSize;
            const limit = pageSize;
            
            const listParams: any = {
              skip,
              limit,
              ...searchFormValues,
            };
            
            const countTotal = async (): Promise<number> => {
              const chunkSize = 1000;
              let total = 0;
              let offset = 0;
              for (let i = 0; i < 100; i += 1) {
                const chunk = await getApprovalInstanceList({
                  skip: offset,
                  limit: chunkSize,
                  ...searchFormValues,
                });
                total += chunk.length;
                if (chunk.length < chunkSize) break;
                offset += chunkSize;
              }
              return total;
            };

            const [data, total] = await Promise.all([
              getApprovalInstanceList(listParams),
              // 接口无 total 字段，按后端上限分批统计总量
              countTotal(),
            ]);
            // 更新表格数据用于统计
            setTableData(data);
            return {
              data,
              success: true,
              total,
            };
          }}
          rowKey="uuid"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (record) => ({
              disabled: record.status !== 'pending',
            }),
          }}
          showAdvancedSearch={true}
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button
                    key="batch-approve"
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={batchLoading}
                    onClick={() => void handleBatchApproval('approve')}
                  >
                    批量通过 ({selectedRowKeys.length})
                  </Button>,
                  <Button
                    key="batch-reject"
                    danger
                    icon={<CloseOutlined />}
                    loading={batchLoading}
                    onClick={() => void handleBatchApproval('reject')}
                  >
                    批量驳回 ({selectedRowKeys.length})
                  </Button>,
                ]
              : []
          }
          search={{
            labelWidth: 'auto',
          }}
          showCreateButton
          createButtonText={t('pages.system.approvalInstances.createButton')}
          onCreate={handleSubmit}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getApprovalInstanceList({ skip: 0, limit: 10000 });
              const items = Array.isArray(res) ? res : [];
              let toExport = items;
              if (type === 'currentPage' && pageData?.length) {
                toExport = pageData;
              } else if (type === 'selected' && keys?.length) {
                toExport = items.filter((d: any) => keys.includes(d.uuid));
              }
              if (toExport.length === 0) {
                messageApi.warning(t('pages.system.approvalInstances.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `approval-instances-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.approvalInstances.exportSuccessCount', { count: toExport.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.approvalInstances.exportFailed'));
            }
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          kanbanViewConfig={{
            statusField: 'status',
            statusGroups: {
              pending: { title: t('pages.system.approvalInstances.statusPending'), color: '#1890ff' },
              approved: { title: t('pages.system.approvalInstances.statusApproved'), color: '#52c41a' },
              rejected: { title: t('pages.system.approvalInstances.statusRejected'), color: '#ff4d4f' },
              cancelled: { title: t('pages.system.approvalInstances.statusCancelled'), color: '#999' },
            },
            renderCard: renderKanbanCard,
          }}
        />
      </ListPageTemplate>

      {/* 提交审批 Modal */}
      <FormModalTemplate
        title={t('pages.system.approvalInstances.submitModalTitle')}
        open={submitModalVisible}
        onClose={() => setSubmitModalVisible(false)}
        onFinish={handleSubmitForm}
        loading={submitFormLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <SafeProFormSelect
          name="process_uuid"
          label={t('pages.system.approvalInstances.processLabel')}
          rules={[{ required: true, message: t('pages.system.approvalInstances.processRequired') }]}
          request={async () => {
            const processes = await getApprovalProcessList({ is_active: true });
            return processes.map((p) => ({
              label: p.name,
              value: p.uuid,
            }));
          }}
        />
        <ProFormText
          name="title"
          label={t('pages.system.approvalInstances.title')}
          rules={[{ required: true, message: t('pages.system.approvalInstances.titleRequired') }]}
        />
        <ProFormTextArea
          name="content"
          label={t('pages.system.approvalInstances.contentLabel')}
          fieldProps={{
            rows: 4,
          }}
        />
        <ProFormItem
          name="data"
          label={t('pages.system.approvalInstances.dataLabel')}
        >
          <TextArea
            rows={6}
            placeholder='{"key": "value"}'
          />
        </ProFormItem>
      </FormModalTemplate>

      {/* 审批操作 Modal */}
      <FormModalTemplate
        title={
          actionType === 'approve' ? t('pages.system.approvalInstances.modalApproveTitle') :
          actionType === 'reject' ? t('pages.system.approvalInstances.modalRejectTitle') :
          actionType === 'cancel' ? t('pages.system.approvalInstances.modalCancelTitle') :
          t('pages.system.approvalInstances.modalTransferTitle')
        }
        open={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        onFinish={handleActionForm}
        loading={actionFormLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        {actionType === 'transfer' && (
          <ProFormText
            name="transfer_to_user_id"
            label={t('pages.system.approvalInstances.transferTargetLabel')}
            rules={[{ required: true, message: t('pages.system.approvalInstances.transferTargetRequired') }]}
          />
        )}
        <ProFormTextArea
          name="comment"
          label={actionType === 'reject' ? t('pages.system.approvalInstances.commentLabelReject') : t('pages.system.approvalInstances.commentLabel')}
          rules={actionType === 'reject' ? [{ required: true, message: t('pages.system.approvalInstances.commentRequiredWhenReject') }] : undefined}
          fieldProps={{
            rows: 4,
            placeholder: actionType === 'reject' ? t('pages.system.approvalInstances.commentPlaceholderReject') : undefined,
          }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <UniDetail
        title={t('pages.system.approvalInstances.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(approvalInstanceDetailDescColumns, detailData)} />
          ) : null}
      />
    </>
  );
};

export default ApprovalInstanceListPage;

