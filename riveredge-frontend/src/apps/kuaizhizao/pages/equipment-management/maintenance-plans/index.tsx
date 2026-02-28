/**
 * 维护保养计划管理页面
 *
 * 提供维护保养计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持维护保养计划创建、自动生成、提醒预警、执行记录等。
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
import { maintenancePlanApi, equipmentApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface MaintenancePlan {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  plan_no?: string;
  plan_name?: string;
  plan_type?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  maintenance_type?: string;
  maintenance_cycle?: number;
  maintenance_cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

const MaintenancePlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑维护计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<MaintenancePlan | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<MaintenancePlan | null>(null);

  // 执行维护保养 Modal 状态
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executePlan, setExecutePlan] = useState<MaintenancePlan | null>(null);
  const executeFormRef = useRef<any>(null);

  /**
   * 处理新建维护计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑维护计划
   */
  const handleEdit = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error('维护计划UUID不存在');
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setIsEdit(true);
      setCurrentPlan(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          plan_name: detail.plan_name,
          plan_type: detail.plan_type,
          equipment_uuid: detail.equipment_uuid,
          maintenance_type: detail.maintenance_type,
          maintenance_cycle: detail.maintenance_cycle,
          maintenance_cycle_unit: detail.maintenance_cycle_unit,
          planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : null,
          planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : null,
          status: detail.status,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取维护计划详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error('维护计划UUID不存在');
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setPlanDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取维护计划详情失败');
    }
  };

  /**
   * 处理批量删除维护计划（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条保养计划吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await maintenancePlanApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        planned_start_date: values.planned_start_date ? values.planned_start_date.format('YYYY-MM-DD') : null,
        planned_end_date: values.planned_end_date ? values.planned_end_date.format('YYYY-MM-DD') : null,
      };

      if (isEdit && currentPlan?.uuid) {
        await maintenancePlanApi.update(currentPlan.uuid, submitData);
        messageApi.success('维护计划更新成功');
      } else {
        await maintenancePlanApi.create(submitData);
        messageApi.success('维护计划创建成功');
      }
      setModalVisible(false);
      setCurrentPlan(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 打开执行维护保养 Modal
   */
  const handleExecute = (record: MaintenancePlan) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error('维护计划或设备信息不完整');
      return;
    }
    setExecutePlan(record);
    setExecuteModalVisible(true);
    setTimeout(() => {
      executeFormRef.current?.setFieldsValue({
        execution_date: dayjs(),
        execution_result: '正常',
        execution_content: `执行维护计划：${record.plan_name}`,
      });
    }, 100);
  };

  /**
   * 提交执行维护保养
   */
  const handleExecuteSubmit = async (values: any) => {
    if (!executePlan?.uuid || !executePlan?.equipment_uuid) return;
    try {
      await maintenancePlanApi.execute({
        equipment_uuid: executePlan.equipment_uuid,
        maintenance_plan_uuid: executePlan.uuid,
        execution_date: values.execution_date?.format?.('YYYY-MM-DD HH:mm:ss') ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        execution_content: values.execution_content,
        execution_result: values.execution_result ?? '正常',
        status: '已确认',
      });
      messageApi.success('执行记录已提交');
      setExecuteModalVisible(false);
      setExecutePlan(null);
      executeFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '提交失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<MaintenancePlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
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
      title: '维护类型',
      dataIndex: 'maintenance_type',
    },
    {
      title: '维护周期',
      dataIndex: 'maintenance_cycle',
      render: (_, record) => record ? `${record.maintenance_cycle ?? ''} ${record.maintenance_cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      valueType: 'date',
    },
    {
      title: '计划结束日期',
      dataIndex: 'planned_end_date',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待执行': { text: '待执行', color: 'default' },
          '执行中': { text: '执行中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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
  const columns: ProColumns<MaintenancePlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      width: 120,
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
      title: '维护类型',
      dataIndex: 'maintenance_type',
      width: 120,
    },
    {
      title: '维护周期',
      dataIndex: 'maintenance_cycle',
      width: 120,
      render: (_, record) => record ? `${record.maintenance_cycle ?? ''} ${record.maintenance_cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待执行': { text: '待执行', color: 'default' },
          '执行中': { text: '执行中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      valueType: 'date',
      width: 120,
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
      width: 220,
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
          {record.status === '待执行' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleExecute(record)}
            >
              执行
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
                content: `确定要删除维护计划"${record.plan_name}"吗？`,
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
        <UniTable<MaintenancePlan>
          headerTitle="维护保养计划管理"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await maintenancePlanApi.list({
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
              messageApi.error('获取维护计划列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText="新建保养计划"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      {/* 创建/编辑维护计划 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑维护计划' : '新建维护计划'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPlan(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="plan_name"
          label="计划名称"
          placeholder="请输入计划名称"
          rules={[{ required: true, message: '请输入计划名称' }]}
        />
        <ProFormSelect
          name="plan_type"
          label="计划类型"
          placeholder="请选择计划类型"
          options={[
            { label: '定期维护', value: '定期维护' },
            { label: '预防性维护', value: '预防性维护' },
            { label: '故障后维护', value: '故障后维护' },
          ]}
          rules={[{ required: true, message: '请选择计划类型' }]}
        />
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
        <ProFormSelect
          name="maintenance_type"
          label="维护类型"
          placeholder="请选择维护类型"
          options={[
            { label: '日常保养', value: '日常保养' },
            { label: '定期保养', value: '定期保养' },
            { label: '大修', value: '大修' },
            { label: '小修', value: '小修' },
          ]}
          rules={[{ required: true, message: '请选择维护类型' }]}
        />
        <ProFormDigit
          name="maintenance_cycle"
          label="维护周期"
          placeholder="请输入维护周期"
          min={1}
          rules={[{ required: true, message: '请输入维护周期' }]}
        />
        <ProFormSelect
          name="maintenance_cycle_unit"
          label="周期单位"
          placeholder="请选择周期单位"
          options={[
            { label: '天', value: '天' },
            { label: '周', value: '周' },
            { label: '月', value: '月' },
            { label: '年', value: '年' },
          ]}
          rules={[{ required: true, message: '请选择周期单位' }]}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始日期"
          placeholder="请选择计划开始日期"
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束日期"
          placeholder="请选择计划结束日期"
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          options={[
            { label: '待执行', value: '待执行' },
            { label: '执行中', value: '执行中' },
            { label: '已完成', value: '已完成' },
            { label: '已取消', value: '已取消' },
          ]}
          rules={[{ required: true, message: '请选择状态' }]}
        />
      </FormModalTemplate>

      {/* 执行维护保养 Modal */}
      <FormModalTemplate
        title="执行维护保养"
        open={executeModalVisible}
        onClose={() => {
          setExecuteModalVisible(false);
          setExecutePlan(null);
          executeFormRef.current?.resetFields();
        }}
        onFinish={handleExecuteSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={executeFormRef}
      >
        <ProFormDatePicker
          name="execution_date"
          label="执行日期"
          placeholder="请选择执行日期"
          rules={[{ required: true, message: '请选择执行日期' }]}
          fieldProps={{ showTime: true }}
        />
        <ProFormSelect
          name="execution_result"
          label="执行结果"
          placeholder="请选择执行结果"
          options={[
            { label: '正常', value: '正常' },
            { label: '异常', value: '异常' },
            { label: '待处理', value: '待处理' },
          ]}
        />
        <ProFormTextArea
          name="execution_content"
          label="执行内容"
          placeholder="请输入执行内容"
          fieldProps={{ rows: 4 }}
        />
      </FormModalTemplate>

      {/* 维护计划详情 Drawer */}
      <DetailDrawerTemplate
        title="维护计划详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setPlanDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={planDetail}
        columns={detailColumns}
      />
    </>
  );
};

export default MaintenancePlansPage;

