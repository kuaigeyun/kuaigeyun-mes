/**
 * 维护保养计划管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的设备维护保养计划。
 * 支持维护计划的 CRUD 操作和维护执行记录管理。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, message, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getMaintenancePlanList,
  getMaintenancePlanByUuid,
  createMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  MaintenancePlan,
  CreateMaintenancePlanData,
  UpdateMaintenancePlanData,
} from '../../../../services/maintenancePlan';
import { getEquipmentList, Equipment } from '../../../../services/equipment';

/**
 * 维护保养计划管理列表页面组件
 */
const MaintenancePlanListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMaintenancePlanUuid, setCurrentMaintenancePlanUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MaintenancePlan | null>(null);
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
   * 处理新建维护计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMaintenancePlanUuid(null);
    setFormInitialValues({
      status: '待执行',
      plan_type: '定期保养',
      maintenance_type: '日常保养',
      cycle_type: '按时间',
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑维护计划
   */
  const handleEdit = async (record: MaintenancePlan) => {
    try {
      setIsEdit(true);
      setCurrentMaintenancePlanUuid(record.uuid);
      
      const detail = await getMaintenancePlanByUuid(record.uuid);
      setFormInitialValues({
        plan_name: detail.plan_name,
        equipment_uuid: detail.equipment_uuid,
        plan_type: detail.plan_type,
        maintenance_type: detail.maintenance_type,
        cycle_type: detail.cycle_type,
        cycle_value: detail.cycle_value,
        cycle_unit: detail.cycle_unit,
        planned_start_date: detail.planned_start_date,
        planned_end_date: detail.planned_end_date,
        responsible_person_id: detail.responsible_person_id,
        responsible_person_name: detail.responsible_person_name,
        status: detail.status,
        remark: detail.remark,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取维护计划详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: MaintenancePlan) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMaintenancePlanByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取维护计划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除维护计划
   */
  const handleDelete = async (record: MaintenancePlan) => {
    try {
      await deleteMaintenancePlan(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 批量删除维护计划
   */
  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请先选择要删除的维护计划');
      return;
    }
    Modal.confirm({
      title: `确定要删除选中的 ${keys.length} 个维护计划吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0;
          let fail = 0;
          for (const uuid of keys) {
            try {
              await deleteMaintenancePlan(String(uuid));
              done++;
            } catch {
              fail++;
            }
          }
          if (fail > 0) {
            messageApi.warning(`删除完成：成功 ${done} 个，失败 ${fail} 个`);
          } else {
            messageApi.success(`已删除 ${done} 个维护计划`);
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentMaintenancePlanUuid) {
        await updateMaintenancePlan(currentMaintenancePlanUuid, values as UpdateMaintenancePlanData);
        messageApi.success('更新成功');
      } else {
        await createMaintenancePlan(values as CreateMaintenancePlanData);
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
  const columns: ProColumns<MaintenancePlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
      width: 150,
      fixed: 'left',
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      width: 200,
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 200,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '定期保养': { text: '定期保养' },
        '预防性维护': { text: '预防性维护' },
        '故障维修': { text: '故障维修' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '保养类型',
      dataIndex: 'maintenance_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '日常保养': { text: '日常保养' },
        '一级保养': { text: '一级保养' },
        '二级保养': { text: '二级保养' },
        '三级保养': { text: '三级保养' },
        '大修': { text: '大修' },
      },
    },
    {
      title: '周期类型',
      dataIndex: 'cycle_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '按时间': { text: '按时间' },
        '按使用次数': { text: '按使用次数' },
        '按运行时长': { text: '按运行时长' },
      },
    },
    {
      title: '周期值',
      dataIndex: 'cycle_value',
      width: 100,
      hideInSearch: true,
      render: (_, record) => {
        if (record.cycle_value && record.cycle_unit) {
          return `${record.cycle_value} ${record.cycle_unit}`;
        }
        return '-';
      },
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      width: 150,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '计划结束日期',
      dataIndex: 'planned_end_date',
      width: 150,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person_name',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: '待执行', status: 'Default' },
        '执行中': { text: '执行中', status: 'Processing' },
        '已完成': { text: '已完成', status: 'Success' },
        '已取消': { text: '已取消', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待执行': { color: 'default', text: '待执行' },
          '执行中': { color: 'processing', text: '执行中' },
          '已完成': { color: 'success', text: '已完成' },
          '已取消': { color: 'error', text: '已取消' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
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
            title="确定要删除这个维护计划吗？"
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
        <UniTable<MaintenancePlan>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, filter, searchFormValues) => {
            const response = await getMaintenancePlanList({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              equipment_uuid: searchFormValues?.equipment_uuid,
              status: searchFormValues?.status,
              plan_type: searchFormValues?.plan_type,
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
          showCreateButton
          createButtonText="新建维护计划"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getMaintenancePlanList({ skip: 0, limit: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `maintenance-plans-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑维护计划' : '新建维护计划'}
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
          name="plan_name"
          label="计划名称"
          rules={[{ required: true, message: '请输入计划名称' }]}
          placeholder="请输入计划名称"
        />
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
        <ProFormSelect
          name="plan_type"
          label="计划类型"
          rules={[{ required: true, message: '请选择计划类型' }]}
          options={[
            { label: '定期保养', value: '定期保养' },
            { label: '预防性维护', value: '预防性维护' },
            { label: '故障维修', value: '故障维修' },
            { label: '其他', value: '其他' },
          ]}
        />
        <ProFormSelect
          name="maintenance_type"
          label="保养类型"
          rules={[{ required: true, message: '请选择保养类型' }]}
          options={[
            { label: '日常保养', value: '日常保养' },
            { label: '一级保养', value: '一级保养' },
            { label: '二级保养', value: '二级保养' },
            { label: '三级保养', value: '三级保养' },
            { label: '大修', value: '大修' },
          ]}
        />
        <ProFormSelect
          name="cycle_type"
          label="周期类型"
          rules={[{ required: true, message: '请选择周期类型' }]}
          options={[
            { label: '按时间', value: '按时间' },
            { label: '按使用次数', value: '按使用次数' },
            { label: '按运行时长', value: '按运行时长' },
          ]}
        />
        <ProFormDigit
          name="cycle_value"
          label="周期值"
          placeholder="请输入周期值"
          fieldProps={{ min: 0 }}
        />
        <ProFormText
          name="cycle_unit"
          label="周期单位"
          placeholder="请输入周期单位（如：天、次、小时）"
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
        <ProFormText
          name="responsible_person_name"
          label="负责人姓名"
          placeholder="请输入负责人姓名"
        />
        <ProFormSelect
          name="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态' }]}
          options={[
            { label: '待执行', value: '待执行' },
            { label: '执行中', value: '执行中' },
            { label: '已完成', value: '已完成' },
            { label: '已取消', value: '已取消' },
          ]}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入备注"
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="维护计划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          { title: '计划编号', dataIndex: 'plan_no' },
          { title: '计划名称', dataIndex: 'plan_name' },
          { title: '设备名称', dataIndex: 'equipment_name' },
          { title: '计划类型', dataIndex: 'plan_type' },
          { title: '保养类型', dataIndex: 'maintenance_type' },
          { title: '周期类型', dataIndex: 'cycle_type' },
          {
            title: '周期值',
            dataIndex: 'cycle_value',
            render: (value: number, record: MaintenancePlan) => {
              if (value && record.cycle_unit) {
                return `${value} ${record.cycle_unit}`;
              }
              return value || '-';
            },
          },
          { title: '周期单位', dataIndex: 'cycle_unit' },
          { title: '计划开始日期', dataIndex: 'planned_start_date' },
          { title: '计划结束日期', dataIndex: 'planned_end_date' },
          { title: '负责人', dataIndex: 'responsible_person_name' },
          { title: '状态', dataIndex: 'status' },
          { title: '备注', dataIndex: 'remark', span: 2 },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default MaintenancePlanListPage;

