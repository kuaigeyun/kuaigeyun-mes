/**
 * 物料编码映射管理页面
 * 
 * 提供物料编码映射的 CRUD 功能，支持外部编码映射到内部编码。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { materialCodeMappingApi, materialApi } from '../../../services/material';
import type { 
  MaterialCodeMapping, 
  MaterialCodeMappingCreate, 
  MaterialCodeMappingUpdate,
  Material 
} from '../../../types/material';

/**
 * 物料编码映射管理列表页面组件
 */
const MaterialCodeMappingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMappingUuid, setCurrentMappingUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentMapping, setCurrentMapping] = useState<MaterialCodeMapping | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
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
   * 处理新建映射
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMappingUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑映射
   */
  const handleEdit = async (record: MaterialCodeMapping) => {
    try {
      setIsEdit(true);
      setCurrentMappingUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await materialCodeMappingApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid,
        internalCode: detail.internalCode,
        externalCode: detail.externalCode,
        externalSystem: detail.externalSystem,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取映射详情失败');
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: MaterialCodeMapping) => {
    try {
      setDetailLoading(true);
      setCurrentMapping(record);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取映射详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除映射
   */
  const handleDelete = async (record: MaterialCodeMapping) => {
    try {
      await materialCodeMappingApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentMappingUuid) {
        await materialCodeMappingApi.update(currentMappingUuid, values as MaterialCodeMappingUpdate);
        messageApi.success('更新成功');
      } else {
        await materialCodeMappingApi.create(values as MaterialCodeMappingCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialCodeMapping>[] = [
    {
      title: '内部编码',
      dataIndex: 'internalCode',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '外部编码',
      dataIndex: 'externalCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '外部系统',
      dataIndex: 'externalSystem',
      width: 120,
      ellipsis: true,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '物料',
      dataIndex: ['material', 'name'],
      width: 150,
      ellipsis: true,
      render: (_: any, record: MaterialCodeMapping) => {
        const material = materials.find(m => m.uuid === record.materialUuid);
        return material?.name || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 80,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: MaterialCodeMapping) => (
        <Space>
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
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定要删除这个映射吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
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
  const detailColumns: ProDescriptionsItemType<MaterialCodeMapping>[] = [
    {
      title: '内部编码',
      dataIndex: 'internalCode',
    },
    {
      title: '外部编码',
      dataIndex: 'externalCode',
    },
    {
      title: '外部系统',
      dataIndex: 'externalSystem',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '物料',
      dataIndex: 'materialUuid',
      render: (_: any, record: MaterialCodeMapping) => {
        const material = materials.find(m => m.uuid === record.materialUuid);
        return material ? `${material.code} - ${material.name}` : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
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
        <UniTable<MaterialCodeMapping>
          headerTitle="物料编码映射"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20, ...rest } = params;
            
            const listParams: any = {
              page: current,
              page_size: pageSize,
              ...searchFormValues,
            };
            
            try {
              const response = await materialCodeMappingApi.list(listParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取映射列表失败:', error);
              messageApi.error(error?.message || '获取映射列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建映射
            </Button>,
          ]}
          search={{
            labelWidth: 'auto',
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑物料编码映射' : '新建物料编码映射'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={MODAL_CONFIG.width}
        formRef={formRef}
        loading={formLoading}
        onFinish={handleSubmit}
      >
        <SafeProFormSelect
          name="materialUuid"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials.map(m => ({
            label: `${m.code} - ${m.name}`,
            value: m.uuid,
          }))}
          fieldProps={{
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => {
              const label = option?.label as string || '';
              return label.toLowerCase().includes(input.toLowerCase());
            },
          }}
        />
        <ProFormText
          name="internalCode"
          label="内部编码"
          placeholder="请输入内部编码（物料编码）"
          rules={[
            { required: true, message: '请输入内部编码' },
            { max: 50, message: '内部编码不能超过50个字符' },
          ]}
        />
        <ProFormText
          name="externalCode"
          label="外部编码"
          placeholder="请输入外部编码"
          rules={[
            { required: true, message: '请输入外部编码' },
            { max: 100, message: '外部编码不能超过100个字符' },
          ]}
        />
        <ProFormText
          name="externalSystem"
          label="外部系统"
          placeholder="请输入外部系统名称（如：ERP、WMS、MES等）"
          rules={[
            { required: true, message: '请输入外部系统名称' },
            { max: 50, message: '外部系统名称不能超过50个字符' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述（可选）"
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
          initialValue={true}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="物料编码映射详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        columns={detailColumns}
        dataSource={currentMapping}
        width={DRAWER_CONFIG.width}
      />
    </>
  );
};

export default MaterialCodeMappingPage;

