/**
 * BOM（物料清单）管理页面
 * 
 * 提供BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material } from '../../../types/material';

/**
 * BOM管理列表页面组件
 */
const BOMPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBOMUuid, setCurrentBOMUuid] = useState<string | null>(null);
  const [bomDetail, setBomDetail] = useState<BOM | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑BOM）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  /**
   * 加载物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理新建BOM
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentBOMUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isAlternative: false,
      priority: 0,
    });
  };

  /**
   * 处理编辑BOM
   */
  const handleEdit = async (record: BOM) => {
    try {
      setIsEdit(true);
      setCurrentBOMUuid(record.uuid);
      setModalVisible(true);
      
      // 获取BOM详情
      const detail = await bomApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialId: detail.materialId,
        componentId: detail.componentId,
        quantity: detail.quantity,
        unit: detail.unit,
        isAlternative: detail.isAlternative,
        alternativeGroupId: detail.alternativeGroupId,
        priority: detail.priority,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
    }
  };

  /**
   * 处理删除BOM
   */
  const handleDelete = async (record: BOM) => {
    try {
      await bomApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: BOM) => {
    try {
      setCurrentBOMUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await bomApi.get(record.uuid);
      setBomDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentBOMUuid(null);
    setBomDetail(null);
  };

  /**
   * 处理提交表单（创建/更新BOM）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentBOMUuid) {
        // 更新BOM
        await bomApi.update(currentBOMUuid, values as BOMUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建BOM
        await bomApi.create(values as BOMCreate);
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
   * 获取物料名称
   */
  const getMaterialName = (materialId: number): string => {
    const material = materials.find(m => m.id === materialId);
    return material ? `${material.code} - ${material.name}` : `物料ID: ${materialId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<BOM>[] = [
    {
      title: '主物料',
      dataIndex: 'materialId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: '子物料',
      dataIndex: 'componentId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: '用量',
      dataIndex: 'quantity',
      width: 100,
      hideInSearch: true,
      render: (_, record) => `${record.quantity} ${record.unit}`,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '替代料',
      dataIndex: 'isAlternative',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Warning' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      hideInSearch: true,
      sorter: true,
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
            title="确定要删除这个BOM项吗？"
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
      <UniTable<BOM>
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
          
          // 替代料筛选
          if (searchFormValues?.isAlternative !== undefined && searchFormValues.isAlternative !== '' && searchFormValues.isAlternative !== null) {
            apiParams.isAlternative = searchFormValues.isAlternative;
          }
          
          // 主物料筛选
          if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId !== null) {
            apiParams.materialId = searchFormValues.materialId;
          }
          
          try {
            const result = await bomApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取BOM列表失败:', error);
            messageApi.error(error?.message || '获取BOM列表失败');
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
            新建BOM
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="BOM详情"
        size={720}
        open={drawerVisible}
        onClose={handleCloseDetail}
      >
        <ProDescriptions<BOM>
          dataSource={bomDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '主物料',
              dataIndex: 'materialId',
              render: (_, record) => getMaterialName(record.materialId),
            },
            {
              title: '子物料',
              dataIndex: 'componentId',
              render: (_, record) => getMaterialName(record.componentId),
            },
            {
              title: '用量',
              dataIndex: 'quantity',
            },
            {
              title: '单位',
              dataIndex: 'unit',
            },
            {
              title: '替代料',
              dataIndex: 'isAlternative',
              render: (_, record) => (
                <Tag color={record.isAlternative ? 'orange' : 'default'}>
                  {record.isAlternative ? '是' : '否'}
                </Tag>
              ),
            },
            {
              title: '优先级',
              dataIndex: 'priority',
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

      {/* 创建/编辑BOM Modal */}
      <Modal
        title={isEdit ? '编辑BOM' : '新建BOM'}
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
            isAlternative: false,
            priority: 0,
          }}
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <SafeProFormSelect
            name="materialId"
            label="主物料"
            placeholder="请选择主物料"
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: `${m.code} - ${m.name}`,
              value: m.id,
            }))}
            rules={[
              { required: true, message: '请选择主物料' },
            ]}
            fieldProps={{
              loading: materialsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <SafeProFormSelect
            name="componentId"
            label="子物料"
            placeholder="请选择子物料"
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: `${m.code} - ${m.name}`,
              value: m.id,
            }))}
            rules={[
              { required: true, message: '请选择子物料' },
            ]}
            fieldProps={{
              loading: materialsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormDigit
            name="quantity"
            label="用量"
            placeholder="请输入用量"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入用量' },
              { type: 'number', min: 0.0001, message: '用量必须大于0' },
            ]}
            fieldProps={{
              precision: 4,
              style: { width: '100%' },
            }}
          />
          <ProFormText
            name="unit"
            label="单位"
            placeholder="请输入单位"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入单位' },
              { max: 20, message: '单位不能超过20个字符' },
            ]}
          />
          <ProFormSwitch
            name="isAlternative"
            label="是否为替代料"
            colProps={{ span: 12 }}
          />
          <ProFormDigit
            name="priority"
            label="优先级"
            placeholder="请输入优先级（数字越小优先级越高）"
            colProps={{ span: 12 }}
            rules={[
              { type: 'number', min: 0, message: '优先级必须大于等于0' },
            ]}
            fieldProps={{
              precision: 0,
              style: { width: '100%' },
            }}
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

export default BOMPage;
