/**
 * 审批实例管理列表页面
 * 
 * 用于查看和管理组织内的审批实例。
 * 支持审批实例的查看、提交审批、审批操作等功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, message, Input, Typography } from 'antd';
import { EyeOutlined, PlusOutlined, CheckOutlined, CloseOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { theme } from 'antd';
import {
  getApprovalInstanceList,
  getApprovalInstanceByUuid,
  createApprovalInstance,
  updateApprovalInstance,
  deleteApprovalInstance,
  performApprovalAction,
  ApprovalInstance,
  CreateApprovalInstanceData,
  ApprovalInstanceActionData,
} from '../../../../services/approvalInstance';
import { getApprovalProcessList } from '../../../../services/approvalProcess';

const { TextArea } = Input;

/**
 * 审批实例管理列表页面组件
 */
const ApprovalInstanceListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
      messageApi.success('提交成功');
      setSubmitModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '提交失败');
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
    formRef.current?.resetFields();
  };

  /**
   * 处理审批操作表单提交
   */
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
      messageApi.success('操作成功');
      setActionModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    } finally {
      setActionFormLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: ApprovalInstance) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApprovalInstanceByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取审批实例详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ApprovalInstance>[] = [
    {
      title: '审批标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '关联流程',
      dataIndex: 'process_uuid',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '审批状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待审批', status: 'Processing' },
        approved: { text: '已通过', status: 'Success' },
        rejected: { text: '已拒绝', status: 'Error' },
        cancelled: { text: '已取消', status: 'Default' },
      },
      render: (_, record) => {
        const statusMap = {
          pending: { color: 'processing', text: '待审批' },
          approved: { color: 'success', text: '已通过' },
          rejected: { color: 'error', text: '已拒绝' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '当前节点',
      dataIndex: 'current_node',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const actions = [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>,
        ];
        
        // 根据状态显示不同的操作按钮
        if (record.status === 'pending') {
          if (record.current_approver_id) {
            // 当前审批人可以看到审批操作
            actions.push(
              <Button
                key="approve"
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAction(record, 'approve')}
              >
                同意
              </Button>,
              <Button
                key="reject"
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleAction(record, 'reject')}
              >
                拒绝
              </Button>,
              <Button
                key="transfer"
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => handleAction(record, 'transfer')}
              >
                转交
              </Button>
            );
          }
          
          // 提交人可以取消
          actions.push(
            <Button
              key="cancel"
              type="link"
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleAction(record, 'cancel')}
            >
              取消
            </Button>
          );
        }
        
        return actions;
      },
    },
  ];

  /**
   * 渲染看板卡片
   */
  const renderKanbanCard = (item: ApprovalInstance, status: string) => {
    const statusMap = {
      pending: { color: 'processing', text: '待审批' },
      approved: { color: 'success', text: '已通过' },
      rejected: { color: 'error', text: '已拒绝' },
      cancelled: { color: 'default', text: '已取消' },
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
            查看
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
  const detailColumns = [
    { title: '审批标题', dataIndex: 'title' },
    { title: '审批内容', dataIndex: 'content' },
    {
      title: '审批状态',
      dataIndex: 'status',
      render: (value: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'processing', text: '待审批' },
          approved: { color: 'success', text: '已通过' },
          rejected: { color: 'error', text: '已拒绝' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const statusInfo = statusMap[value] || { color: 'default', text: value };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    { title: '当前节点', dataIndex: 'current_node' },
    { title: '当前审批人ID', dataIndex: 'current_approver_id' },
    {
      title: '审批数据',
      dataIndex: 'data',
      render: (value: any) => (
        <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ),
    },
    { title: '提交时间', dataIndex: 'submitted_at', valueType: 'dateTime' },
    { title: '完成时间', dataIndex: 'completed_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={
          stats
            ? [
                {
                  title: '总审批数',
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: '待审批',
                  value: stats.pending,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: '已通过',
                  value: stats.approved,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: '已拒绝',
                  value: stats.rejected,
                  valueStyle: { color: '#ff4d4f' },
                },
              ]
            : undefined
        }
      >
        <UniTable<ApprovalInstance>
          headerTitle="审批实例管理"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20, ...rest } = params;
            const skip = (current - 1) * pageSize;
            const limit = pageSize;
            
            const listParams: any = {
              skip,
              limit,
              ...searchFormValues,
            };
            
            const data = await getApprovalInstanceList(listParams);
            // 更新表格数据用于统计
            setTableData(data);
            return {
              data,
              success: true,
              total: data.length,
            };
          }}
          rowKey="uuid"
          toolBarRender={() => []}
          search={{
            labelWidth: 'auto',
            showAdvancedSearch: true,
          }}
          showCreateButton={true}
          onCreate={handleSubmit}
          viewTypes={['table', 'kanban']}
          defaultViewType="table"
          kanbanViewConfig={{
            statusField: 'status',
            statusGroups: {
              pending: { title: '待审批', color: '#1890ff' },
              approved: { title: '已通过', color: '#52c41a' },
              rejected: { title: '已拒绝', color: '#ff4d4f' },
              cancelled: { title: '已取消', color: '#999' },
            },
            renderCard: renderKanbanCard,
          }}
        />
      </ListPageTemplate>

      {/* 提交审批 Modal */}
      <FormModalTemplate
        title="提交审批"
        open={submitModalVisible}
        onClose={() => setSubmitModalVisible(false)}
        onFinish={handleSubmitForm}
        loading={submitFormLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={formRef.current?.getFieldsValue()}
      >
        <SafeProFormSelect
          name="process_uuid"
          label="审批流程"
          rules={[{ required: true, message: '请选择审批流程' }]}
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
          label="审批标题"
          rules={[{ required: true, message: '请输入审批标题' }]}
        />
        <ProFormTextArea
          name="content"
          label="审批内容"
          fieldProps={{
            rows: 4,
          }}
        />
        <ProForm.Item
          name="data"
          label="审批数据（JSON，可选）"
        >
          <TextArea
            rows={6}
            placeholder='{"key": "value"}'
          />
        </ProForm.Item>
      </FormModalTemplate>

      {/* 审批操作 Modal */}
      <FormModalTemplate
        title={
          actionType === 'approve' ? '同意审批' :
          actionType === 'reject' ? '拒绝审批' :
          actionType === 'cancel' ? '取消审批' :
          '转交审批'
        }
        open={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        onFinish={handleActionForm}
        loading={actionFormLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={formRef.current?.getFieldsValue()}
      >
        {actionType === 'transfer' && (
          <ProFormText
            name="transfer_to_user_id"
            label="转交目标用户ID"
            rules={[{ required: true, message: '请输入转交目标用户ID' }]}
          />
        )}
        <ProFormTextArea
          name="comment"
          label="审批意见"
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<ApprovalInstance>
        title="审批实例详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
        column={1}
      />
    </>
  );
};

export default ApprovalInstanceListPage;

