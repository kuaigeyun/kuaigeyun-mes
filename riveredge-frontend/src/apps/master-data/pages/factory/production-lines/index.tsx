/**
 * 产线管理页面
 * 
 * 提供产线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { productionLineApi, workshopApi } from '../../../services/factory';
import type { ProductionLine, ProductionLineCreate, ProductionLineUpdate, Workshop } from '../../../types/factory';

/**
 * 产线管理列表页面组件
 */
const ProductionLinesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProductionLineUuid, setCurrentProductionLineUuid] = useState<string | null>(null);
  const [productionLineDetail, setProductionLineDetail] = useState<ProductionLine | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑产线）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 车间列表（用于下拉选择）
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workshopsLoading, setWorkshopsLoading] = useState(false);

  /**
   * 加载车间列表
   */
  useEffect(() => {
    const loadWorkshops = async () => {
      try {
        setWorkshopsLoading(true);
        const result = await workshopApi.list({ limit: 1000, isActive: true });
        setWorkshops(result);
      } catch (error: any) {
        console.error('加载车间列表失败:', error);
      } finally {
        setWorkshopsLoading(false);
      }
    };
    loadWorkshops();
  }, []);

  /**
   * 处理新建产线
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentProductionLineUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑产线
   */
  const handleEdit = async (record: ProductionLine) => {
    try {
      setIsEdit(true);
      setCurrentProductionLineUuid(record.uuid);
      setModalVisible(true);
      
      // 获取产线详情
      const detail = await productionLineApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        workshopId: detail.workshopId,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取产线详情失败');
    }
  };

  /**
   * 处理删除产线
   */
  const handleDelete = async (record: ProductionLine) => {
    try {
      await productionLineApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProductionLine) => {
    try {
      setCurrentProductionLineUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionLineApi.get(record.uuid);
      setProductionLineDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取产线详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentProductionLineUuid(null);
    setProductionLineDetail(null);
  };

  /**
   * 处理提交表单（创建/更新产线）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentProductionLineUuid) {
        // 更新产线
        await productionLineApi.update(currentProductionLineUuid, values as ProductionLineUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建产线
        await productionLineApi.create(values as ProductionLineCreate);
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
  const columns: ProColumns<ProductionLine>[] = [
    {
      title: '产线编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '产线名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属车间',
      dataIndex: 'workshopId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getWorkshopName(record.workshopId),
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
            title="确定要删除这条产线吗？"
            description="删除产线前需要检查是否有关联的工位"
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
   * 获取车间名称
   */
  const getWorkshopName = (workshopId?: number): string => {
    if (!workshopId) return '-';
    const workshop = workshops.find(w => w.id === workshopId);
    return workshop ? `${workshop.code} - ${workshop.name}` : '-';
  };

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemType<ProductionLine>[] = [
    {
      title: '产线编码',
      dataIndex: 'code',
    },
    {
      title: '产线名称',
      dataIndex: 'name',
    },
    {
      title: '所属车间',
      dataIndex: 'workshopId',
      render: (_, record) => getWorkshopName(record.workshopId),
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
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ProductionLine>
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
          
          // 车间筛选
          if (searchFormValues?.workshopId !== undefined && searchFormValues.workshopId !== '' && searchFormValues.workshopId !== null) {
            apiParams.workshopId = searchFormValues.workshopId;
          }
          
          try {
            const result = await productionLineApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
            };
          } catch (error: any) {
            console.error('获取产线列表失败:', error);
            messageApi.error(error?.message || '获取产线列表失败');
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
            新建产线
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<ProductionLine>
        title="产线详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={productionLineDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑产线 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑产线' : '新建产线'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{
          isActive: true,
        }}
      >
          <SafeProFormSelect
            name="workshopId"
            label="所属车间"
            placeholder="请选择车间"
            colProps={{ span: 12 }}
            options={workshops.map(w => ({
              label: `${w.code} - ${w.name}`,
              value: w.id,
            }))}
            rules={[
              { required: true, message: '请选择车间' },
            ]}
            fieldProps={{
              loading: workshopsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="code"
            label="产线编码"
            placeholder="请输入产线编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入产线编码' },
              { max: 50, message: '产线编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="产线名称"
            placeholder="请输入产线名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入产线名称' },
              { max: 200, message: '产线名称不能超过200个字符' },
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
      </FormModalTemplate>
    </>
  );
};

export default ProductionLinesPage;
