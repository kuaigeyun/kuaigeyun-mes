/**
 * 制造BOM管理页面
 * 
 * 提供制造BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Tabs, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined, FormOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { sopApi, operationApi } from '../../../services/process';
import type { SOP, SOPCreate, SOPUpdate, Operation } from '../../../types/process';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import FormSchemaEditor from './FormSchemaEditor';
import type { ISchema } from '@formily/core';

/**
 * 制造BOM管理列表页面组件
 */
const SOPPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSOPUuid, setCurrentSOPUuid] = useState<string | null>(null);
  const [sopDetail, setSopDetail] = useState<SOP | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑SOP）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formConfig, setFormConfig] = useState<ISchema | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  // 工序列表（用于下拉选择）
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);

  /**
   * 加载工序列表
   */
  useEffect(() => {
    const loadOperations = async () => {
      try {
        setOperationsLoading(true);
        const result = await operationApi.list({ limit: 1000, isActive: true });
        setOperations(result);
      } catch (error: any) {
        console.error('加载工序列表失败:', error);
      } finally {
        setOperationsLoading(false);
      }
    };
    loadOperations();
  }, []);

  /**
   * 处理新建SOP
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSOPUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
    setFormConfig(undefined);
    setActiveTab('basic');
  };

  /**
   * 处理编辑SOP
   */
  const handleEdit = async (record: SOP) => {
    try {
      setIsEdit(true);
      setCurrentSOPUuid(record.uuid);
      setModalVisible(true);
      
      // 获取SOP详情
      const detail = await sopApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        operationId: detail.operationId,
        version: detail.version,
        content: detail.content,
        isActive: detail.isActive,
      });
      // 加载form_config配置（SOP参数收集表单配置）
      setFormConfig(detail.formConfig || undefined);
      setActiveTab('basic');
      // 注意：attachments 是 JSON 字段，这里暂时不处理，后续可以扩展为文件上传组件
    } catch (error: any) {
      messageApi.error(error.message || '获取SOP详情失败');
    }
  };

  /**
   * 处理删除SOP
   */
  const handleDelete = async (record: SOP) => {
    try {
      await sopApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除SOP
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
              await sopApi.delete(key.toString());
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
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SOP) => {
    try {
      setCurrentSOPUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sopApi.get(record.uuid);
      setSopDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取SOP详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSOPUuid(null);
    setSopDetail(null);
  };

  /**
   * 处理提交表单（创建/更新SOP）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 合并form_config到提交数据
      const submitData = {
        ...values,
        formConfig: formConfig || null,
      };
      
      if (isEdit && currentSOPUuid) {
        // 更新SOP
        await sopApi.update(currentSOPUuid, submitData as SOPUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建SOP
        await sopApi.create(submitData as SOPCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      setFormConfig(undefined);
      setActiveTab('basic');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
    setFormConfig(undefined);
    setActiveTab('basic');
  };

  /**
   * 获取工序名称
   */
  const getOperationName = (operationId?: number): string => {
    if (!operationId) return '-';
    const operation = operations.find(o => o.id === operationId);
    return operation ? `${operation.code} - ${operation.name}` : `工序ID: ${operationId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SOP>[] = [
    {
      title: 'SOP编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: 'SOP名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '关联工序',
      dataIndex: 'operationId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getOperationName(record.operationId),
    },
    {
      title: '版本号',
      dataIndex: 'version',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.content ? `${record.content.substring(0, 50)}...` : '-',
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
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
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}`)}
          >
            设计流程
          </Button>
          <Popconfirm
            title="确定要删除这个SOP吗？"
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

  return (
    <ListPageTemplate>
      <UniTable<SOP>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 工序筛选
          if (searchFormValues?.operationId !== undefined && searchFormValues.operationId !== '' && searchFormValues.operationId !== null) {
            apiParams.operationId = searchFormValues.operationId;
          }
          
          try {
            const result = await sopApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取SOP列表失败:', error);
            messageApi.error(error?.message || '获取SOP列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建SOP
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      <DetailDrawerTemplate<SOP>
        title="SOP详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={sopDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[
          { title: 'SOP编码', dataIndex: 'code' },
          { title: 'SOP名称', dataIndex: 'name' },
          { title: '关联工序', dataIndex: 'operationId', render: (_, record) => getOperationName(record.operationId) },
          { title: '版本号', dataIndex: 'version' },
          { title: 'SOP内容', dataIndex: 'content', span: 2 },
          {
            title: '启用状态',
            dataIndex: 'isActive',
            render: (_, record) => (
              <Tag color={record.isActive ? 'success' : 'default'}>
                {record.isActive ? '启用' : '禁用'}
              </Tag>
            ),
          },
          { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
        ]}
      />

      <FormModalTemplate
        title={isEdit ? '编辑SOP' : '新建SOP'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={1000}
        formRef={formRef}
        initialValues={{ isActive: true }}
        formProps={{
          layout: 'vertical',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <>
                  <SafeProFormSelect
                    name="operationId"
                    label="关联工序"
                    placeholder="请选择关联工序（可选）"
                    colProps={{ span: 12 }}
                    options={operations.map(o => ({
                      label: `${o.code} - ${o.name}`,
                      value: o.id,
                    }))}
                    fieldProps={{
                      loading: operationsLoading,
                      showSearch: true,
                      allowClear: true,
                      filterOption: (input, option) => {
                        const label = option?.label as string || '';
                        return label.toLowerCase().includes(input.toLowerCase());
                      },
                    }}
                  />
                  <ProFormText
                    name="code"
                    label="SOP编码"
                    placeholder="请输入SOP编码"
                    colProps={{ span: 12 }}
                    rules={[
                      { required: true, message: '请输入SOP编码' },
                      { max: 50, message: 'SOP编码不能超过50个字符' },
                    ]}
                    fieldProps={{
                      style: { textTransform: 'uppercase' },
                    }}
                  />
                  <ProFormText
                    name="name"
                    label="SOP名称"
                    placeholder="请输入SOP名称"
                    colProps={{ span: 12 }}
                    rules={[
                      { required: true, message: '请输入SOP名称' },
                      { max: 200, message: 'SOP名称不能超过200个字符' },
                    ]}
                  />
                  <ProFormText
                    name="version"
                    label="版本号"
                    placeholder="请输入版本号（如：v1.0）"
                    colProps={{ span: 12 }}
                    rules={[
                      { max: 20, message: '版本号不能超过20个字符' },
                    ]}
                  />
                  <ProFormTextArea
                    name="content"
                    label="SOP内容"
                    placeholder="请输入SOP内容（支持富文本）"
                    colProps={{ span: 24 }}
                    fieldProps={{
                      rows: 8,
                      maxLength: 5000,
                    }}
                  />
                  <ProFormSwitch
                    name="isActive"
                    label="是否启用"
                    colProps={{ span: 12 }}
                  />
                  <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, gridColumn: '1 / -1' }}>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      提示：附件（attachments）字段为 JSON 格式，可在编辑页面中通过文件上传组件进行配置。
                    </div>
                  </div>
                </>
              ),
            },
            {
              key: 'formConfig',
              label: (
                <span>
                  <FormOutlined /> 报工参数收集配置
                </span>
              ),
              children: (
                <div style={{ padding: '16px 0' }}>
                  <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
                    <div style={{ color: '#1890ff', fontSize: 13, lineHeight: 1.6 }}>
                      <strong>说明：</strong>
                      <div style={{ marginTop: 8 }}>
                        配置报工时需要收集的参数表单。当工序关联了此SOP时，报工界面会自动显示配置的参数收集表单。
                      </div>
                      <div style={{ marginTop: 8 }}>
                        支持的参数类型：数字（带单位、范围验证）、文本（单行/多行）、选择（单选/多选）、日期、布尔值等。
                      </div>
                    </div>
                  </div>
                  <FormSchemaEditor
                    value={formConfig}
                    onChange={(schema) => {
                      setFormConfig(schema);
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SOPPage;
