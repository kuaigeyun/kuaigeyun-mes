/**
 * 设备故障维修管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的设备故障和维修记录。
 * 支持故障记录的 CRUD 操作和维修记录管理。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, message, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getEquipmentFaultList,
  getEquipmentFaultByUuid,
  createEquipmentFault,
  updateEquipmentFault,
  deleteEquipmentFault,
  EquipmentFault,
  CreateEquipmentFaultData,
  UpdateEquipmentFaultData,
} from '../../../../services/equipmentFault';
import { getEquipmentList, Equipment } from '../../../../services/equipment';

/**
 * 设备故障维修管理列表页面组件
 */
const EquipmentFaultListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeTab, setActiveTab] = useState<'faults' | 'repairs'>('faults');
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFaultUuid, setCurrentFaultUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<EquipmentFault | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 设备列表（用于下拉选择）
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  /**
   * 加载设备列表
   */
  React.useEffect(() => {
    const loadEquipmentList = async () => {
      try {
        const response = await getEquipmentList({ limit: 1000 });
        setEquipmentList(response.items);
      } catch (error) {
        console.error('加载设备列表失败:', error);
      }
    };
    loadEquipmentList();
  }, []);

  /**
   * 处理新建故障记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFaultUuid(null);
    setFormInitialValues({
      status: '待处理',
      fault_type: '机械故障',
      fault_level: '一般',
      repair_required: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑故障记录
   */
  const handleEdit = async (record: EquipmentFault) => {
    try {
      setIsEdit(true);
      setCurrentFaultUuid(record.uuid);
      
      const detail = await getEquipmentFaultByUuid(record.uuid);
      setFormInitialValues({
        equipment_uuid: detail.equipment_uuid,
        fault_date: detail.fault_date,
        fault_type: detail.fault_type,
        fault_description: detail.fault_description,
        fault_level: detail.fault_level,
        reporter_id: detail.reporter_id,
        reporter_name: detail.reporter_name,
        status: detail.status,
        repair_required: detail.repair_required,
        remark: detail.remark,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取故障记录详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: EquipmentFault) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getEquipmentFaultByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取故障记录详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除故障记录
   */
  const handleDelete = async (record: EquipmentFault) => {
    try {
      await deleteEquipmentFault(record.uuid);
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
      
      if (isEdit && currentFaultUuid) {
        await updateEquipmentFault(currentFaultUuid, values as UpdateEquipmentFaultData);
        messageApi.success('更新成功');
      } else {
        await createEquipmentFault(values as CreateEquipmentFaultData);
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
  const columns: ProColumns<EquipmentFault>[] = [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
      width: 150,
      fixed: 'left',
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 200,
    },
    {
      title: '故障日期',
      dataIndex: 'fault_date',
      width: 150,
      valueType: 'date',
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '机械故障': { text: '机械故障' },
        '电气故障': { text: '电气故障' },
        '软件故障': { text: '软件故障' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '轻微': { text: '轻微', status: 'Default' },
        '一般': { text: '一般', status: 'Processing' },
        '严重': { text: '严重', status: 'Warning' },
        '紧急': { text: '紧急', status: 'Error' },
      },
      render: (_, record) => {
        const levelMap: Record<string, { color: string; text: string }> = {
          '轻微': { color: 'default', text: '轻微' },
          '一般': { color: 'processing', text: '一般' },
          '严重': { color: 'warning', text: '严重' },
          '紧急': { color: 'error', text: '紧急' },
        };
        const levelInfo = levelMap[record.fault_level] || { color: 'default', text: record.fault_level };
        return <Tag color={levelInfo.color}>{levelInfo.text}</Tag>;
      },
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '报告人',
      dataIndex: 'reporter_name',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: '待处理', status: 'Default' },
        '处理中': { text: '处理中', status: 'Processing' },
        '已修复': { text: '已修复', status: 'Success' },
        '已关闭': { text: '已关闭', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待处理': { color: 'default', text: '待处理' },
          '处理中': { color: 'processing', text: '处理中' },
          '已修复': { color: 'success', text: '已修复' },
          '已关闭': { color: 'error', text: '已关闭' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '需要维修',
      dataIndex: 'repair_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.repair_required ? 'success' : 'default'}>
          {record.repair_required ? '是' : '否'}
        </Tag>
      ),
      hideInSearch: true,
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
            title="确定要删除这个故障记录吗？"
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
        <UniTable<EquipmentFault>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, filter, searchFormValues) => {
            const response = await getEquipmentFaultList({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              equipment_uuid: searchFormValues?.equipment_uuid,
              status: searchFormValues?.status,
              fault_type: searchFormValues?.fault_type,
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
              新建故障记录
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
        title={isEdit ? '编辑故障记录' : '新建故障记录'}
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
        <ProFormSelect
          name="equipment_uuid"
          label="设备"
          rules={[{ required: true, message: '请选择设备' }]}
          options={equipmentList.map((eq) => ({
            label: `${eq.name} (${eq.code})`,
            value: eq.uuid,
          }))}
          placeholder="请选择设备"
        />
        <ProFormDatePicker
          name="fault_date"
          label="故障日期"
          rules={[{ required: true, message: '请选择故障日期' }]}
          placeholder="请选择故障日期"
          fieldProps={{ showTime: true }}
        />
        <ProFormSelect
          name="fault_type"
          label="故障类型"
          rules={[{ required: true, message: '请选择故障类型' }]}
          options={[
            { label: '机械故障', value: '机械故障' },
            { label: '电气故障', value: '电气故障' },
            { label: '软件故障', value: '软件故障' },
            { label: '其他', value: '其他' },
          ]}
        />
        <ProFormSelect
          name="fault_level"
          label="故障级别"
          rules={[{ required: true, message: '请选择故障级别' }]}
          options={[
            { label: '轻微', value: '轻微' },
            { label: '一般', value: '一般' },
            { label: '严重', value: '严重' },
            { label: '紧急', value: '紧急' },
          ]}
        />
        <ProFormTextArea
          name="fault_description"
          label="故障描述"
          rules={[{ required: true, message: '请输入故障描述' }]}
          placeholder="请输入故障描述"
          fieldProps={{ rows: 4 }}
        />
        <ProFormText
          name="reporter_name"
          label="报告人姓名"
          placeholder="请输入报告人姓名"
        />
        <ProFormSelect
          name="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态' }]}
          options={[
            { label: '待处理', value: '待处理' },
            { label: '处理中', value: '处理中' },
            { label: '已修复', value: '已修复' },
            { label: '已关闭', value: '已关闭' },
          ]}
        />
        <ProFormSwitch
          name="repair_required"
          label="是否需要维修"
          initialValue={true}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入备注"
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="故障记录详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          { title: '故障编号', dataIndex: 'fault_no' },
          { title: '设备名称', dataIndex: 'equipment_name' },
          { title: '故障日期', dataIndex: 'fault_date', valueType: 'dateTime' },
          { title: '故障类型', dataIndex: 'fault_type' },
          { title: '故障级别', dataIndex: 'fault_level' },
          { title: '故障描述', dataIndex: 'fault_description', span: 2 },
          { title: '报告人', dataIndex: 'reporter_name' },
          { title: '状态', dataIndex: 'status' },
          { title: '需要维修', dataIndex: 'repair_required', render: (value: boolean) => (value ? '是' : '否') },
          { title: '备注', dataIndex: 'remark', span: 2 },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default EquipmentFaultListPage;

