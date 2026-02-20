/**
 * 消息模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息模板。
 * 支持消息模板的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProFormList, ProFormGroup } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getMessageTemplateList,
  getMessageTemplateByUuid,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  MessageTemplate,
  CreateMessageTemplateData,
  UpdateMessageTemplateData,
} from '../../../../services/messageTemplate';

/**
 * 消息模板管理列表页面组件
 */
const MessageTemplateListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息模板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageTemplateUuid, setCurrentMessageTemplateUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MessageTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建消息模板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMessageTemplateUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'email',
      is_active: true,
    });
  };

  /**
   * 处理编辑消息模板
   */
  const handleEdit = async (record: MessageTemplate) => {
    try {
      setIsEdit(true);
      setCurrentMessageTemplateUuid(record.uuid);
      setModalVisible(true);
      
      // 获取消息模板详情
      const detail = await getMessageTemplateByUuid(record.uuid);
      
      // 转换变量为列表格式
      const variableList = detail.variables 
        ? Object.entries(detail.variables).map(([key, label]) => ({ key, label }))
        : [];

      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        subject: detail.subject,
        content: detail.content,
        variableList,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取消息模板详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: MessageTemplate) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMessageTemplateByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取消息模板详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除消息模板
   */
  const handleDelete = async (record: MessageTemplate) => {
    try {
      await deleteMessageTemplate(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除消息模板
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deleteMessageTemplate(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新消息模板）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 将变量列表转换回 JSON 对象
      let variables: Record<string, any> | undefined = undefined;
      if (values.variableList && Array.isArray(values.variableList)) {
        variables = {};
        values.variableList.forEach((item: any) => {
          if (item.key) {
            variables![item.key] = item.label || '';
          }
        });
      }
      
      if (isEdit && currentMessageTemplateUuid) {
        await updateMessageTemplate(currentMessageTemplateUuid, {
          name: values.name,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as UpdateMessageTemplateData);
        messageApi.success('更新成功');
      } else {
        await createMessageTemplate({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as CreateMessageTemplateData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MessageTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '模板代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '消息类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        email: { text: '邮件', status: 'Success' },
        sms: { text: '短信', status: 'Processing' },
        internal: { text: '站内信', status: 'Warning' },
        push: { text: '推送通知', status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          email: { color: 'blue', text: '邮件' },
          sms: { color: 'orange', text: '短信' },
          internal: { color: 'green', text: '站内信' },
          push: { color: 'default', text: '推送通知' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '主题',
      dataIndex: 'subject',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个消息模板吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '模板名称', dataIndex: 'name' },
    { title: '模板代码', dataIndex: 'code' },
    {
      title: '消息类型',
      dataIndex: 'type',
      render: (value: string) => {
        const typeMap: Record<string, string> = {
          email: '邮件',
          sms: '短信',
          internal: '站内信',
          push: '推送通知',
        };
        return typeMap[value] || value;
      },
    },
    { title: '主题', dataIndex: 'subject' },
    {
      title: '模板内容',
      dataIndex: 'content',
      render: (value: string) => (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '200px',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}>
          {value}
        </pre>
      ),
    },
    {
      title: '模板变量',
      dataIndex: 'variables',
      render: (value: Record<string, any>) => value ? (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '200px',
          fontSize: 12,
        }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : '-',
    },
    { title: '模板描述', dataIndex: 'description' },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MessageTemplate>
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 消息类型筛选
          if (searchFormValues?.type) {
            apiParams.type = searchFormValues.type;
          }
          
          // 启用状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          try {
            const result = await getMessageTemplateList(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,  // 简化实现，实际应该从后端返回总数
            };
          } catch (error: any) {
            console.error('获取消息模板列表失败:', error);
            messageApi.error(error?.message || '获取消息模板列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        showCreateButton
        createButtonText="新建消息模板"
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText="批量删除"
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, keys, pageData) => {
          try {
            const allData = await getMessageTemplateList({ skip: 0, limit: 10000 });
            let items = Array.isArray(allData) ? allData : [];
            if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d: any) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `message-templates-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(`已导出 ${items.length} 条记录`);
          } catch (error: any) {
            messageApi.error(error?.message || '导出失败');
          }
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        />
      </ListPageTemplate>

      {/* 创建/编辑消息模板 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑消息模板' : '新建消息模板'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="code"
          label="模板代码"
          rules={[
            { required: true, message: '请输入模板代码' },
            { pattern: /^[A-Z0-9_]+$/, message: '建议使用大写字母、数字和下划线' },
          ]}
          placeholder="例如：MATERIAL_CHANGE_NOTIFY"
          disabled={isEdit}
          colProps={{ md: 12, xs: 24 }}
        />
        <ProFormText
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
          placeholder="例如：物料变更通知"
          colProps={{ md: 12, xs: 24 }}
        />
        <SafeProFormSelect
          name="type"
          label="消息类型"
          rules={[{ required: true, message: '请选择消息类型' }]}
          options={[
            { label: '邮件', value: 'email' },
            { label: '短信', value: 'sms' },
            { label: '站内信', value: 'internal' },
            { label: '推送通知', value: 'push' },
          ]}
          disabled={isEdit}
          colProps={{ md: 12, xs: 24 }}
        />
        <ProFormSwitch
          name="is_active"
          label="启用状态"
          colProps={{ md: 12, xs: 24 }}
        />
        <ProFormText
          name="subject"
          label="消息主题"
          placeholder="请输入邮件或推送消息的主题"
          colProps={{ span: 24 }}
        />
        <ProFormTextArea
          name="content"
          label="模板正文"
          rules={[{ required: true, message: '请输入模板内容' }]}
          placeholder="支持变量替换，例如：您好 {name}，验证码为 {code}"
          fieldProps={{
            rows: 6,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormList
          name="variableList"
          label="变量声明"
          creatorButtonProps={{
            creatorButtonText: '添加变量',
          }}
          itemRender={({ listDom, action }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>{listDom}</div>
              {action}
            </div>
          )}
        >
          <ProFormGroup key="group">
            <ProFormText 
              name="key" 
              placeholder="变量名 (如: name)" 
              rules={[{ required: true, message: '必填' }]}
            />
            <ProFormText 
              name="label" 
              placeholder="变量描述 (如: 用户姓名)" 
            />
          </ProFormGroup>
        </ProFormList>

        <ProFormTextArea
          name="description"
          label="模板描述"
          placeholder="该模板的详细用途备注"
          fieldProps={{
            rows: 2,
          }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<MessageTemplate>
        title="消息模板详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns}
        column={1}
      />
    </>
  );
};

export default MessageTemplateListPage;

