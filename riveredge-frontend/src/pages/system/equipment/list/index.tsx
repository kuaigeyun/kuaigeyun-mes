/**
 * 设备管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的设备。
 * 支持设备的 CRUD 操作。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormJsonSchema } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getEquipmentList,
  getEquipmentByUuid,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  Equipment,
  CreateEquipmentData,
  UpdateEquipmentData,
} from '../../../../services/equipment';

/**
 * 设备管理列表页面组件
 */
const EquipmentListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipmentUuid, setCurrentEquipmentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Equipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建设备
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEquipmentUuid(null);
    setFormInitialValues({
      status: '正常',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑设备
   */
  const handleEdit = async (record: Equipment) => {
    try {
      setIsEdit(true);
      setCurrentEquipmentUuid(record.uuid);
      
      const detail = await getEquipmentByUuid(record.uuid);
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date,
        installation_date: detail.installation_date,
        warranty_period: detail.warranty_period,
        technical_parameters: detail.technical_parameters,
        workstation_id: detail.workstation_id,
        workstation_code: detail.workstation_code,
        workstation_name: detail.workstation_name,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Equipment) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getEquipmentByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除设备
   */
  const handleDelete = async (record: Equipment) => {
    try {
      await deleteEquipment(record.uuid);
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
      
      if (isEdit && currentEquipmentUuid) {
        await updateEquipment(currentEquipmentUuid, values as UpdateEquipmentData);
        messageApi.success('更新成功');
      } else {
        await createEquipment(values as CreateEquipmentData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error; // 重新抛出错误，让 FormModalTemplate 处理
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Equipment>[] = [
    {
      title: '设备编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '加工设备': { text: '加工设备' },
        '检测设备': { text: '检测设备' },
        '包装设备': { text: '包装设备' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '设备分类',
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '关联工位',
      dataIndex: 'workstation_name',
      width: 150,
      hideInSearch: true,
      render: (_, record) => record.workstation_name || '-',
    },
    {
      title: '设备状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: '正常', status: 'Success' },
        '维修中': { text: '维修中', status: 'Warning' },
        '停用': { text: '停用', status: 'Default' },
        '报废': { text: '报废', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '正常': { color: 'success', text: '正常' },
          '维修中': { color: 'warning', text: '维修中' },
          '停用': { color: 'default', text: '停用' },
          '报废': { color: 'error', text: '报废' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
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
            title="确定要删除这个设备吗？"
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
      <ListPageTemplate>
        <UniTable<Equipment>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, filter, searchFormValues) => {
            const response = await getEquipmentList({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              type: searchFormValues?.type,
              category: searchFormValues?.category,
              status: searchFormValues?.status,
              is_active: searchFormValues?.is_active,
              search: searchFormValues?.keyword,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" onClick={handleCreate}>
              新建设备
            </Button>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑设备' : '新建设备'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="code"
          label="设备编码"
          placeholder="设备编码（可选，不填则自动生成）"
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label="设备名称"
          rules={[{ required: true, message: '请输入设备名称' }]}
          placeholder="请输入设备名称"
        />
        <ProFormSelect
          name="type"
          label="设备类型"
          placeholder="请选择设备类型（可选）"
          options={[
            { label: '加工设备', value: '加工设备' },
            { label: '检测设备', value: '检测设备' },
            { label: '包装设备', value: '包装设备' },
            { label: '其他', value: '其他' },
          ]}
          allowClear
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
          fieldProps={{ min: 0 }}
        />
        <ProFormText
          name="workstation_code"
          label="工位编码"
          placeholder="请输入工位编码（可选）"
        />
        <ProFormText
          name="workstation_name"
          label="工位名称"
          placeholder="请输入工位名称（可选）"
        />
        <ProFormSelect
          name="status"
          label="设备状态"
          rules={[{ required: true, message: '请选择设备状态' }]}
          options={[
            { label: '正常', value: '正常' },
            { label: '维修中', value: '维修中' },
            { label: '停用', value: '停用' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入设备描述"
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="设备详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          { title: '设备编码', dataIndex: 'code' },
          { title: '设备名称', dataIndex: 'name' },
          { title: '设备类型', dataIndex: 'type' },
          { title: '设备分类', dataIndex: 'category' },
          { title: '品牌', dataIndex: 'brand' },
          { title: '型号', dataIndex: 'model' },
          { title: '序列号', dataIndex: 'serial_number' },
          { title: '制造商', dataIndex: 'manufacturer' },
          { title: '供应商', dataIndex: 'supplier' },
          { title: '采购日期', dataIndex: 'purchase_date' },
          { title: '安装日期', dataIndex: 'installation_date' },
          { title: '保修期（月）', dataIndex: 'warranty_period' },
          { title: '关联工位', dataIndex: 'workstation_name' },
          {
            title: '设备状态',
            dataIndex: 'status',
            render: (value: string) => {
              const statusMap: Record<string, string> = {
                '正常': '正常',
                '维修中': '维修中',
                '停用': '停用',
                '报废': '报废',
              };
              return statusMap[value] || value;
            },
          },
          {
            title: '是否启用',
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? '启用' : '禁用'),
          },
          { title: '描述', dataIndex: 'description', span: 2 },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default EquipmentListPage;

