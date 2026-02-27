/**
 * 设备故障维修管理页面
 *
 * 提供设备故障和维修记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持故障记录、维修流程、维修记录、故障分析等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { equipmentFaultApi, equipmentApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface EquipmentFault {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  fault_no?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  fault_date?: string;
  fault_type?: string;
  fault_level?: string;
  fault_description?: string;
  status?: string;
  repair_required?: boolean;
  created_at?: string;
  updated_at?: string;
}

const EquipmentFaultsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑故障记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFault, setCurrentFault] = useState<EquipmentFault | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [faultDetail, setFaultDetail] = useState<EquipmentFault | null>(null);

  /**
   * 处理新建故障记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFault(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑故障记录
   */
  const handleEdit = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error('故障记录UUID不存在');
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setIsEdit(true);
      setCurrentFault(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_uuid: detail.equipment_uuid,
          fault_date: detail.fault_date ? dayjs(detail.fault_date) : null,
          fault_type: detail.fault_type,
          fault_level: detail.fault_level,
          fault_description: detail.fault_description,
          status: detail.status,
          repair_required: detail.repair_required,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取故障记录详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error('故障记录UUID不存在');
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setFaultDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取故障记录详情失败');
    }
  };

  /**
   * 处理删除故障记录
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
      const records = keys as any[];
      await Promise.all(records.map(record => {
        if (record.uuid) {
          return equipmentFaultApi.delete(record.uuid);
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
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        fault_date: values.fault_date ? values.fault_date.format('YYYY-MM-DD') : null,
      };

      if (isEdit && currentFault?.uuid) {
        await equipmentFaultApi.update(currentFault.uuid, submitData);
        messageApi.success('故障记录更新成功');
      } else {
        await equipmentFaultApi.create(submitData);
        messageApi.success('故障记录创建成功');
      }
      setModalVisible(false);
      setCurrentFault(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理创建维修记录
   */
  const handleCreateRepair = async (record: EquipmentFault) => {
    Modal.confirm({
      title: '确认创建维修记录',
      content: `确定要为故障"${record.fault_no}"创建维修记录吗？`,
      onOk: async () => {
        try {
          if (!record.uuid) {
            messageApi.error('故障记录UUID不存在');
            return;
          }
          // TODO: 打开创建维修记录的Modal
          messageApi.info('创建维修记录功能开发中');
        } catch (error: any) {
          messageApi.error(error.message || '创建失败');
        }
      },
    });
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<EquipmentFault>[] = [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
    },
    {
      title: '设备编码',
      dataIndex: 'equipment_code',
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
    },
    {
      title: '故障日期',
      dataIndex: 'fault_date',
      valueType: 'date',
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      render: (level) => {
        const levelMap: Record<string, { text: string; color: string }> = {
          '轻微': { text: '轻微', color: 'default' },
          '一般': { text: '一般', color: 'warning' },
          '严重': { text: '严重', color: 'error' },
        };
        const config = levelMap[level || ''] || { text: level || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待处理': { text: '待处理', color: 'default' },
          '处理中': { text: '处理中', color: 'processing' },
          '已修复': { text: '已修复', color: 'success' },
          '已关闭': { text: '已关闭', color: 'default' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '需要维修',
      dataIndex: 'repair_required',
      render: (repairRequired) => (
        <Tag color={repairRequired ? 'warning' : 'success'}>
          {repairRequired ? '是' : '否'}
        </Tag>
      ),
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
  const columns: ProColumns<EquipmentFault>[] = [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '设备编码',
      dataIndex: 'equipment_code',
      width: 140,
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '故障日期',
      dataIndex: 'fault_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
      width: 120,
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      width: 100,
      render: (level) => {
        const levelMap: Record<string, { text: string; color: string }> = {
          '轻微': { text: '轻微', color: 'default' },
          '一般': { text: '一般', color: 'warning' },
          '严重': { text: '严重', color: 'error' },
        };
        const config = levelMap[level || ''] || { text: level || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待处理': { text: '待处理', color: 'default' },
          '处理中': { text: '处理中', color: 'processing' },
          '已修复': { text: '已修复', color: 'success' },
          '已关闭': { text: '已关闭', color: 'default' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '需要维修',
      dataIndex: 'repair_required',
      width: 100,
      render: (repairRequired) => (
        <Tag color={repairRequired ? 'warning' : 'success'}>
          {repairRequired ? '是' : '否'}
        </Tag>
      ),
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
          {record.repair_required && record.status !== '已修复' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleCreateRepair(record)}
            >
              创建维修
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除故障记录"${record.fault_no}"吗？`,
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
        <UniTable<EquipmentFault>
          headerTitle="设备故障维修管理"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentFaultApi.list({
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
              messageApi.error('获取故障记录列表失败');
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
              新建故障记录
            </Button>,
          ]}
          onDelete={handleDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑故障记录 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑故障记录' : '新建故障记录'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentFault(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="equipment_uuid"
          label="关联设备"
          placeholder="请选择设备"
          request={async () => {
            try {
              const response = await equipmentApi.list({ limit: 1000 });
              return (response.items || []).map((eq: any) => ({
                label: `${eq.code} - ${eq.name}`,
                value: eq.uuid,
              }));
            } catch (error) {
              return [];
            }
          }}
          rules={[{ required: true, message: '请选择设备' }]}
        />
        <ProFormDatePicker
          name="fault_date"
          label="故障日期"
          placeholder="请选择故障日期"
          rules={[{ required: true, message: '请选择故障日期' }]}
        />
        <ProFormSelect
          name="fault_type"
          label="故障类型"
          placeholder="请选择故障类型"
          options={[
            { label: '机械故障', value: '机械故障' },
            { label: '电气故障', value: '电气故障' },
            { label: '软件故障', value: '软件故障' },
            { label: '其他', value: '其他' },
          ]}
          rules={[{ required: true, message: '请选择故障类型' }]}
        />
        <ProFormSelect
          name="fault_level"
          label="故障级别"
          placeholder="请选择故障级别"
          options={[
            { label: '轻微', value: '轻微' },
            { label: '一般', value: '一般' },
            { label: '严重', value: '严重' },
          ]}
          rules={[{ required: true, message: '请选择故障级别' }]}
        />
        <ProFormTextArea
          name="fault_description"
          label="故障描述"
          placeholder="请输入故障描述"
          rules={[{ required: true, message: '请输入故障描述' }]}
          fieldProps={{ rows: 4 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          options={[
            { label: '待处理', value: '待处理' },
            { label: '处理中', value: '处理中' },
            { label: '已修复', value: '已修复' },
            { label: '已关闭', value: '已关闭' },
          ]}
          rules={[{ required: true, message: '请选择状态' }]}
        />
        <ProFormSelect
          name="repair_required"
          label="需要维修"
          placeholder="请选择是否需要维修"
          options={[
            { label: '是', value: true },
            { label: '否', value: false },
          ]}
          rules={[{ required: true, message: '请选择是否需要维修' }]}
        />
      </FormModalTemplate>

      {/* 故障记录详情 Drawer */}
      <DetailDrawerTemplate
        title="故障记录详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setFaultDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={faultDetail}
        columns={detailColumns}
      />
    </>
  );
};

export default EquipmentFaultsPage;

