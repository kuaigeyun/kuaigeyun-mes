/**
 * 工序信息管理页面
 * 
 * 提供工序信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { operationApi } from '../../../services/process';
import type { Operation, OperationCreate, OperationUpdate } from '../../../types/process';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';

/**
 * 工序信息管理列表页面组件
 */
const OperationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOperationUuid, setCurrentOperationUuid] = useState<string | null>(null);
  const [operationDetail, setOperationDetail] = useState<Operation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工序）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建工序
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOperationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑工序
   */
  const handleEdit = async (record: Operation) => {
    try {
      setIsEdit(true);
      setCurrentOperationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取工序详情
      const detail = await operationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        reportingType: detail.reportingType || 'quantity',
        allowJump: detail.allowJump || false,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工序详情失败');
    }
  };

  /**
   * 处理删除工序
   */
  const handleDelete = async (record: Operation) => {
    try {
      await operationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Operation) => {
    try {
      setCurrentOperationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await operationApi.get(record.uuid);
      setOperationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工序详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentOperationUuid(null);
    setOperationDetail(null);
  };

  /**
   * 处理提交表单（创建/更新工序）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOperationUuid) {
        // 更新工序
        await operationApi.update(currentOperationUuid, values as OperationUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建工序
        await operationApi.create(values as OperationCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
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
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Operation>[] = [
    {
      title: '工序编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工序名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '报工类型',
      dataIndex: 'reportingType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        quantity: { text: '按数量报工', status: 'Processing' },
        status: { text: '按状态报工', status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? '按数量报工' : '按状态报工'}
        </Tag>
      ),
    },
    {
      title: '允许跳转',
      dataIndex: 'allowJump',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '允许', status: 'Success' },
        false: { text: '不允许', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.allowJump ? 'success' : 'default'}>
          {record.allowJump ? '允许' : '不允许'}
        </Tag>
      ),
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
      width: 150,
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
          <Popconfirm
            title="确定要删除这个工序吗？"
            description="删除工序前需要检查是否有关联的工艺路线或SOP"
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
      <UniTable<Operation>
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
          
          try {
            const result = await operationApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取工序列表失败:', error);
            messageApi.error(error?.message || '获取工序列表失败');
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
            新建工序
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      <DetailDrawerTemplate<Operation>
        title="工序详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={operationDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[
          { title: '工序编码', dataIndex: 'code' },
          { title: '工序名称', dataIndex: 'name' },
          { title: '描述', dataIndex: 'description', span: 2 },
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
        title={isEdit ? '编辑工序' : '新建工序'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{ isActive: true, reportingType: 'quantity', allowJump: false }}
      >
        <ProFormText
          name="code"
          label="工序编码"
          placeholder="请输入工序编码"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工序编码' },
            { max: 50, message: '工序编码不能超过50个字符' },
          ]}
          fieldProps={{
            style: { textTransform: 'uppercase' },
          }}
        />
        <ProFormText
          name="name"
          label="工序名称"
          placeholder="请输入工序名称"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工序名称' },
            { max: 200, message: '工序名称不能超过200个字符' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述"
          colProps={{ span: 24 }}
          fieldProps={{
            rows: 4,
            maxLength: 500,
          }}
        />
        <ProFormSelect
          name="reportingType"
          label="报工类型"
          placeholder="请选择报工类型"
          colProps={{ span: 12 }}
          options={[
            { label: '按数量报工', value: 'quantity' },
            { label: '按状态报工', value: 'status' },
          ]}
          rules={[{ required: true, message: '请选择报工类型' }]}
          initialValue="quantity"
          extra="按数量报工：需要输入完成数量、合格数量（如：注塑、组装、包装）。按状态报工：只有完成/未完成状态，无数量概念（如：检验、测试、审批）"
        />
        <ProFormSwitch
          name="allowJump"
          label="是否允许跳转"
          colProps={{ span: 12 }}
          extra="允许跳转：可以并行进行，不依赖上道工序完成。不允许跳转：必须完成上道工序才能开始下道工序（默认）"
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default OperationsPage;
