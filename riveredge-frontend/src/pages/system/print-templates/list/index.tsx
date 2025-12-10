/**
 * 打印模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的打印模板。
 * 支持打印模板的 CRUD 操作和模板渲染功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Drawer, Modal, message, Input, Form, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PrinterOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CardView from '../card-view';
import { UniTable } from '../../../../components/uni_table';
import {
  getPrintTemplateList,
  getPrintTemplateByUuid,
  createPrintTemplate,
  updatePrintTemplate,
  deletePrintTemplate,
  renderPrintTemplate,
  PrintTemplate,
  CreatePrintTemplateData,
  UpdatePrintTemplateData,
  RenderPrintTemplateData,
  PrintTemplateRenderResponse,
} from '../../../../services/printTemplate';

const { TextArea } = Input;

/**
 * 打印模板管理列表页面组件
 */
const PrintTemplateListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  // Modal 相关状态（创建/编辑打印模板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPrintTemplateUuid, setCurrentPrintTemplateUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Modal 相关状态（渲染模板）
  const [renderModalVisible, setRenderModalVisible] = useState(false);
  const [renderFormLoading, setRenderFormLoading] = useState(false);
  const [currentRenderTemplateUuid, setCurrentRenderTemplateUuid] = useState<string | null>(null);
  const [renderFormRef] = Form.useForm();
  const [renderResult, setRenderResult] = useState<PrintTemplateRenderResponse | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<PrintTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建打印模板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPrintTemplateUuid(null);
    setConfigJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'pdf',
      is_active: true,
      is_default: false,
    });
  };

  /**
   * 处理编辑打印模板
   */
  const handleEdit = async (record: PrintTemplate) => {
    try {
      setIsEdit(true);
      setCurrentPrintTemplateUuid(record.uuid);
      setModalVisible(true);
      
      // 获取打印模板详情
      const detail = await getPrintTemplateByUuid(record.uuid);
      setConfigJson(detail.config ? JSON.stringify(detail.config, null, 2) : '{}');
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        description: detail.description,
        content: detail.content,
        is_active: detail.is_active,
        is_default: detail.is_default,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取打印模板详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: PrintTemplate) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPrintTemplateByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取打印模板详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理渲染模板
   */
  const handleRender = (record: PrintTemplate) => {
    setCurrentRenderTemplateUuid(record.uuid);
    setRenderModalVisible(true);
    setRenderResult(null);
    renderFormRef.current?.resetFields();
    renderFormRef.current?.setFieldsValue({
      output_format: 'pdf',
      async_execution: false,
    });
  };

  /**
   * 处理渲染模板表单提交
   */
  const handleRenderSubmit = async (values: any) => {
    if (!currentRenderTemplateUuid) return;
    
    try {
      setRenderFormLoading(true);
      setRenderResult(null);
      
      const data: RenderPrintTemplateData = {
        data: values.data ? JSON.parse(values.data) : {},
        output_format: values.output_format || 'pdf',
        async_execution: values.async_execution || false,
      };
      
      const result = await renderPrintTemplate(currentRenderTemplateUuid, data);
      setRenderResult(result);
      
      if (result.success) {
        messageApi.success('模板渲染成功');
      } else {
        messageApi.error(result.error || '模板渲染失败');
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '模板渲染失败');
    } finally {
      setRenderFormLoading(false);
    }
  };

  /**
   * 处理删除打印模板
   */
  const handleDelete = async (record: PrintTemplate) => {
    try {
      await deletePrintTemplate(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要删除的打印模板');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deletePrintTemplate(key as string)));
      messageApi.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('批量删除失败');
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 配置
      let config: Record<string, any> | undefined;
      if (configJson) {
        try {
          config = JSON.parse(configJson);
        } catch (e) {
          messageApi.error('模板配置 JSON 格式错误');
          return;
        }
      }
      
      const data: CreatePrintTemplateData | UpdatePrintTemplateData = {
        ...values,
        config,
      };
      
      if (isEdit && currentPrintTemplateUuid) {
        await updatePrintTemplate(currentPrintTemplateUuid, data as UpdatePrintTemplateData);
        messageApi.success('更新成功');
      } else {
        await createPrintTemplate(data as CreatePrintTemplateData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<PrintTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '模板代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '模板类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        pdf: { text: 'PDF' },
        html: { text: 'HTML' },
        word: { text: 'Word' },
        excel: { text: 'Excel' },
        other: { text: '其他' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          pdf: { color: 'red', text: 'PDF' },
          html: { color: 'blue', text: 'HTML' },
          word: { color: 'green', text: 'Word' },
          excel: { color: 'purple', text: 'Excel' },
          other: { color: 'default', text: '其他' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '是否启用',
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
      title: '是否默认',
      dataIndex: 'is_default',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_default ? 'processing' : 'default'}>
          {record.is_default ? '默认' : '-'}
        </Tag>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '最后使用时间',
      dataIndex: 'last_used_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
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
        return [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>,
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>,
          <Button
            key="render"
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handleRender(record)}
            disabled={!record.is_active}
          >
            渲染
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除这个打印模板吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <>
      {/* 视图切换 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs
          activeKey={viewMode}
          onChange={(key) => setViewMode(key as 'card' | 'list')}
          items={[
            { key: 'card', label: '卡片视图', icon: <AppstoreOutlined /> },
            { key: 'list', label: '列表视图', icon: <UnorderedListOutlined /> },
          ]}
        />
        {viewMode === 'list' && (
          <Space>
            <Button
              danger
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建
            </Button>
          </Space>
        )}
      </div>

      {/* 卡片视图 */}
      {viewMode === 'card' && <CardView />}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <UniTable<PrintTemplate>
        headerTitle="打印模板管理"
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
          
          const data = await getPrintTemplateList(listParams);
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => []}
        search={{
          labelWidth: 'auto',
          showAdvancedSearch: true,
        }}
        />
      )}

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑打印模板' : '新建打印模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        size={900}
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
          }}
        >
          <ProFormText
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          />
          <ProFormText
            name="code"
            label="模板代码"
            rules={[
              { required: true, message: '请输入模板代码' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '模板代码只能包含字母、数字和下划线，且必须以字母开头' },
            ]}
            disabled={isEdit}
            tooltip="模板代码用于程序识别，创建后不可修改"
          />
          <ProFormSelect
            name="type"
            label="模板类型"
            rules={[{ required: true, message: '请选择模板类型' }]}
            options={[
              { label: 'PDF', value: 'pdf' },
              { label: 'HTML', value: 'html' },
              { label: 'Word', value: 'word' },
              { label: 'Excel', value: 'excel' },
              { label: '其他', value: 'other' },
            ]}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="模板描述"
            fieldProps={{
              rows: 3,
            }}
          />
          <ProFormTextArea
            name="content"
            label="模板内容"
            rules={[{ required: true, message: '请输入模板内容' }]}
            fieldProps={{
              rows: 12,
              style: { fontFamily: 'monospace' },
            }}
            tooltip="支持变量替换，使用 {{variable_name}} 格式"
          />
          <ProForm.Item
            name="config"
            label="模板配置（JSON，可选）"
            tooltip="模板配置，JSON 格式，如页面大小、边距等"
          >
            <TextArea
              rows={4}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder='{"page_size": "A4", "margin": {"top": 10, "bottom": 10, "left": 10, "right": 10}}'
              style={{ fontFamily: 'monospace' }}
            />
          </ProForm.Item>
          {isEdit && (
            <>
              <ProFormSwitch
                name="is_active"
                label="是否启用"
              />
              <ProFormSwitch
                name="is_default"
                label="是否默认模板"
              />
            </>
          )}
        </ProForm>
      </Modal>

      {/* 渲染模板 Modal */}
      <Modal
        title="渲染打印模板"
        open={renderModalVisible}
        onCancel={() => setRenderModalVisible(false)}
        footer={null}
        size={700}
      >
        <ProForm
          formRef={renderFormRef}
          loading={renderFormLoading}
          onFinish={handleRenderSubmit}
          submitter={{
            searchConfig: {
              submitText: '渲染',
            },
          }}
        >
          <ProFormTextArea
            name="data"
            label="模板数据（JSON）"
            rules={[{ required: true, message: '请输入模板数据' }]}
            fieldProps={{
              rows: 6,
              style: { fontFamily: 'monospace' },
              placeholder: '{"title": "标题", "content": "内容"}',
            }}
            tooltip="模板数据，JSON 格式，用于替换模板中的变量"
          />
          <ProFormSelect
            name="output_format"
            label="输出格式"
            options={[
              { label: 'PDF', value: 'pdf' },
              { label: 'HTML', value: 'html' },
            ]}
          />
          <ProFormSwitch
            name="async_execution"
            label="异步执行（通过 Inngest）"
            tooltip="如果启用，模板渲染将通过 Inngest 异步执行"
          />
        </ProForm>
        
        {renderResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>渲染结果：</div>
            {renderResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ 渲染成功</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>✗ 渲染失败</div>
            )}
            {renderResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>错误：</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', color: '#ff4d4f' }}>
                  {renderResult.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="打印模板详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailData ? (
          <ProDescriptions
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
              },
              {
                title: '模板代码',
                dataIndex: 'code',
              },
              {
                title: '模板类型',
                dataIndex: 'type',
              },
              {
                title: '模板描述',
                dataIndex: 'description',
              },
              {
                title: '是否启用',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '是否默认',
                dataIndex: 'is_default',
                render: (value) => (
                  <Tag color={value ? 'processing' : 'default'}>
                    {value ? '默认' : '-'}
                  </Tag>
                ),
              },
              {
                title: '模板内容',
                dataIndex: 'content',
                render: (value) => (
                  <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                    {value}
                  </pre>
                ),
              },
              {
                title: '模板配置',
                dataIndex: 'config',
                render: (value) => (
                  value ? (
                    <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : '-'
                ),
              },
              {
                title: '使用次数',
                dataIndex: 'usage_count',
              },
              {
                title: '最后使用时间',
                dataIndex: 'last_used_at',
                valueType: 'dateTime',
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        ) : null}
      </Drawer>
    </>
  );
};

export default PrintTemplateListPage;

