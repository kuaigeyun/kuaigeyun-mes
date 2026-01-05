/**
 * 设备管理页面
 *
 * 提供设备的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持设备基础信息管理、序列号管理、关联工作中心等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormJsonSchema } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Modal, Tabs, Table, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { equipmentApi } from '../../../services/equipment';
import { workshopApi } from '../../../../master-data/services/factory';
import dayjs from 'dayjs';

interface Equipment {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: any;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  work_center_id?: number;
  work_center_code?: string;
  work_center_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const EquipmentPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑设备）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<Equipment | null>(null);

  // 追溯相关状态
  const [traceVisible, setTraceVisible] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);

  /**
   * 处理新建设备
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEquipment(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑设备
   */
  const handleEdit = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setIsEdit(true);
      setCurrentEquipment(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          type: detail.type,
          category: detail.category,
          brand: detail.brand,
          model: detail.model,
          serial_number: detail.serial_number,
          manufacturer: detail.manufacturer,
          supplier: detail.supplier,
          purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
          installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
          warranty_period: detail.warranty_period,
          workstation_id: detail.workstation_id,
          work_center_id: detail.work_center_id,
          status: detail.status,
          is_active: detail.is_active,
          description: detail.description,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取设备详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setEquipmentDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取设备详情失败');
    }
  };

  /**
   * 处理删除设备
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
      const records = keys as any[];
      await Promise.all(records.map(record => {
        if (record.uuid) {
          return equipmentApi.delete(record.uuid);
        }
        return Promise.resolve();
      }));
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理查看设备追溯
   */
  const handleTrace = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const data = await equipmentApi.getTrace(record.uuid);
      setTraceData(data);
      setTraceVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备追溯失败');
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null,
      };

      if (isEdit && currentEquipment?.uuid) {
        await equipmentApi.update(currentEquipment.uuid, submitData);
        messageApi.success('设备更新成功');
      } else {
        await equipmentApi.create(submitData);
        messageApi.success('设备创建成功');
      }
      setModalVisible(false);
      setCurrentEquipment(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<Equipment>[] = [
    {
      title: '设备编码',
      dataIndex: 'code',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
    },
    {
      title: '设备类型',
      dataIndex: 'type',
    },
    {
      title: '设备分类',
      dataIndex: 'category',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
    },
    {
      title: '型号',
      dataIndex: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: '安装日期',
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: '保修期（月）',
      dataIndex: 'warranty_period',
    },
    {
      title: '工位',
      dataIndex: 'workstation_name',
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '维修中': { text: '维修中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
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
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<Equipment>[] = [
    {
      title: '设备编码',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '设备分类',
      dataIndex: 'category',
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '维修中': { text: '维修中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right',
      render: (_text, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
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
            icon={<HistoryOutlined />}
            onClick={() => handleTrace(record)}
          >
            追溯
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除设备"${record.name}"吗？`,
                onOk: () => handleDelete([record]),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Equipment>
          headerTitle="设备管理"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取设备列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建设备
            </Button>,
          ]}
          onDelete={handleDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑设备 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑设备' : '新建设备'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentEquipment(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="name"
          label="设备名称"
          placeholder="请输入设备名称"
          rules={[{ required: true, message: '请输入设备名称' }]}
        />
        <ProFormSelect
          name="type"
          label="设备类型"
          placeholder="请选择设备类型"
          options={[
            { label: '加工设备', value: '加工设备' },
            { label: '检测设备', value: '检测设备' },
            { label: '包装设备', value: '包装设备' },
            { label: '其他', value: '其他' },
          ]}
        />
        <ProFormText
          name="category"
          label="设备分类"
          placeholder="请输入设备分类（如：CNC、注塑机、冲压机等）"
        />
        <ProFormText
          name="brand"
          label="品牌"
          placeholder="请输入品牌"
        />
        <ProFormText
          name="model"
          label="型号"
          placeholder="请输入型号"
        />
        <ProFormText
          name="serial_number"
          label="序列号"
          placeholder="请输入序列号"
        />
        <ProFormText
          name="manufacturer"
          label="制造商"
          placeholder="请输入制造商"
        />
        <ProFormText
          name="supplier"
          label="供应商"
          placeholder="请输入供应商"
        />
        <ProFormDatePicker
          name="purchase_date"
          label="采购日期"
          placeholder="请选择采购日期"
        />
        <ProFormDatePicker
          name="installation_date"
          label="安装日期"
          placeholder="请选择安装日期"
        />
        <ProFormDigit
          name="warranty_period"
          label="保修期（月）"
          placeholder="请输入保修期（月）"
          min={0}
        />
        <ProFormSelect
          name="workstation_id"
          label="关联工位"
          placeholder="请选择工位（可选）"
          request={async () => {
            try {
              const workshops = await workshopApi.list({ limit: 1000 });
              // TODO: 需要从workshop中获取工位列表，这里先返回空数组
              return [];
            } catch (error) {
              return [];
            }
          }}
        />
        <ProFormSelect
          name="work_center_id"
          label="关联工作中心"
          placeholder="请选择工作中心（可选）"
          request={async () => {
            try {
              // TODO: 需要从工作中心API获取列表
              return [];
            } catch (error) {
              return [];
            }
          }}
        />
        <ProFormSelect
          name="status"
          label="设备状态"
          placeholder="请选择设备状态"
          options={[
            { label: '正常', value: '正常' },
            { label: '维修中', value: '维修中' },
            { label: '停用', value: '停用' },
            { label: '报废', value: '报废' },
          ]}
          rules={[{ required: true, message: '请选择设备状态' }]}
        />
        <ProFormSelect
          name="is_active"
          label="是否启用"
          placeholder="请选择是否启用"
          options={[
            { label: '启用', value: true },
            { label: '停用', value: false },
          ]}
          rules={[{ required: true, message: '请选择是否启用' }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述（可选）"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 设备详情 Drawer */}
      <DetailDrawerTemplate
        title="设备详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setEquipmentDetail(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={equipmentDetail}
        columns={detailColumns}
      />
    </>
  );
};

export default EquipmentPage;

