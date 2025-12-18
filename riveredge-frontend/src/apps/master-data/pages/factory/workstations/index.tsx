/**
 * 工位管理页面
 * 
 * 提供工位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { workstationApi, productionLineApi } from '../../../services/factory';
import type { Workstation, WorkstationCreate, WorkstationUpdate, ProductionLine } from '../../../types/factory';

/**
 * 工位管理列表页面组件
 */
const WorkstationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentWorkstationUuid, setCurrentWorkstationUuid] = useState<string | null>(null);
  const [workstationDetail, setWorkstationDetail] = useState<Workstation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工位）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 产线列表（用于下拉选择）
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [productionLinesLoading, setProductionLinesLoading] = useState(false);

  /**
   * 加载产线列表
   */
  useEffect(() => {
    const loadProductionLines = async () => {
      try {
        setProductionLinesLoading(true);
        const result = await productionLineApi.list({ limit: 1000, isActive: true });
        setProductionLines(result);
      } catch (error: any) {
        console.error('加载产线列表失败:', error);
      } finally {
        setProductionLinesLoading(false);
      }
    };
    loadProductionLines();
  }, []);

  /**
   * 处理新建工位
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkstationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑工位
   */
  const handleEdit = async (record: Workstation) => {
    try {
      setIsEdit(true);
      setCurrentWorkstationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取工位详情
      const detail = await workstationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        productionLineId: detail.productionLineId,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工位详情失败');
    }
  };

  /**
   * 处理删除工位
   */
  const handleDelete = async (record: Workstation) => {
    try {
      await workstationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Workstation) => {
    try {
      setCurrentWorkstationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await workstationApi.get(record.uuid);
      setWorkstationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工位详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentWorkstationUuid(null);
    setWorkstationDetail(null);
  };

  /**
   * 处理提交表单（创建/更新工位）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentWorkstationUuid) {
        // 更新工位
        await workstationApi.update(currentWorkstationUuid, values as WorkstationUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建工位
        await workstationApi.create(values as WorkstationCreate);
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
   * 获取产线名称
   */
  const getProductionLineName = (productionLineId: number): string => {
    const productionLine = productionLines.find(p => p.id === productionLineId);
    return productionLine ? `${productionLine.code} - ${productionLine.name}` : `产线ID: ${productionLineId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Workstation>[] = [
    {
      title: '工位编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工位名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属产线',
      dataIndex: 'productionLineId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getProductionLineName(record.productionLineId),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
            title="确定要删除这个工位吗？"
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
    <>
      <UniTable<Workstation>
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
          
          // 产线筛选
          if (searchFormValues?.productionLineId !== undefined && searchFormValues.productionLineId !== '' && searchFormValues.productionLineId !== null) {
            apiParams.productionLineId = searchFormValues.productionLineId;
          }
          
          try {
            const result = await workstationApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
            };
          } catch (error: any) {
            console.error('获取工位列表失败:', error);
            messageApi.error(error?.message || '获取工位列表失败');
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
            新建工位
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="工位详情"
        size={720}
        open={drawerVisible}
        onClose={handleCloseDetail}
      >
        <ProDescriptions<Workstation>
          dataSource={workstationDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '工位编码',
              dataIndex: 'code',
            },
            {
              title: '工位名称',
              dataIndex: 'name',
            },
            {
              title: '所属产线',
              dataIndex: 'productionLineId',
              render: (_, record) => getProductionLineName(record.productionLineId),
            },
            {
              title: '描述',
              dataIndex: 'description',
              span: 2,
            },
            {
              title: '启用状态',
              dataIndex: 'isActive',
              render: (_, record) => (
                <Tag color={record.isActive ? 'success' : 'default'}>
                  {record.isActive ? '启用' : '禁用'}
                </Tag>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              valueType: 'dateTime',
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              valueType: 'dateTime',
            },
          ]}
        />
      </Drawer>

      {/* 创建/编辑工位 Modal */}
      <Modal
        title={isEdit ? '编辑工位' : '新建工位'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
              resetText: '取消',
            },
            resetButtonProps: {
              onClick: handleCloseModal,
            },
          }}
          initialValues={{
            isActive: true,
          }}
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <SafeProFormSelect
            name="productionLineId"
            label="所属产线"
            placeholder="请选择产线"
            colProps={{ span: 12 }}
            options={productionLines.map(p => ({
              label: `${p.code} - ${p.name}`,
              value: p.id,
            }))}
            rules={[
              { required: true, message: '请选择产线' },
            ]}
            fieldProps={{
              loading: productionLinesLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="code"
            label="工位编码"
            placeholder="请输入工位编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入工位编码' },
              { max: 50, message: '工位编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="工位名称"
            placeholder="请输入工位名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入工位名称' },
              { max: 200, message: '工位名称不能超过200个字符' },
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
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default WorkstationsPage;
