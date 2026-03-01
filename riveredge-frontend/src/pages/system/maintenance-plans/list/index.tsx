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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(error.message || t('pages.system.maintenancePlans.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.system.maintenancePlans.getDetailFailed'));
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
      messageApi.success(t('pages.system.maintenancePlans.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.maintenancePlans.deleteFailed'));
    }
  };

  /**
   * 批量删除维护计划
   */
  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.maintenancePlans.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('pages.system.maintenancePlans.confirmBatchDelete', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
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
            messageApi.warning(t('pages.system.maintenancePlans.batchDeletePartial', { done, fail }));
          } else {
            messageApi.success(t('pages.system.maintenancePlans.batchDeleteSuccess', { count: done }));
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || t('pages.system.maintenancePlans.batchDeleteFailed'));
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
        messageApi.success(t('pages.system.maintenancePlans.updateSuccess'));
      } else {
        await createMaintenancePlan(values as CreateMaintenancePlanData);
        messageApi.success(t('pages.system.maintenancePlans.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.maintenancePlans.operationFailed'));
      throw error; // 重新抛出错误，让 FormModalTemplate 处理
    } finally {
      setFormLoading(false);
    }
  };

  const planTypeKey: Record<string, string> = {
    '定期保养': 'pages.system.maintenancePlans.planTypeRegular',
    '预防性维护': 'pages.system.maintenancePlans.planTypePreventive',
    '故障维修': 'pages.system.maintenancePlans.planTypeFault',
    '其他': 'pages.system.maintenancePlans.planTypeOther',
  };
  const maintenanceTypeKey: Record<string, string> = {
    '日常保养': 'pages.system.maintenancePlans.maintenanceDaily',
    '一级保养': 'pages.system.maintenancePlans.maintenanceLevel1',
    '二级保养': 'pages.system.maintenancePlans.maintenanceLevel2',
    '三级保养': 'pages.system.maintenancePlans.maintenanceLevel3',
    '大修': 'pages.system.maintenancePlans.maintenanceOverhaul',
  };
  const cycleTypeKey: Record<string, string> = {
    '按时间': 'pages.system.maintenancePlans.cycleByTime',
    '按使用次数': 'pages.system.maintenancePlans.cycleByCount',
    '按运行时长': 'pages.system.maintenancePlans.cycleByRuntime',
  };
  const detailStatusKey: Record<string, string> = {
    '待执行': 'pages.system.maintenancePlans.statusPending',
    '执行中': 'pages.system.maintenancePlans.statusRunning',
    '已完成': 'pages.system.maintenancePlans.statusCompleted',
    '已取消': 'pages.system.maintenancePlans.statusCancelled',
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaintenancePlan>[] = [
    {
      title: t('pages.system.maintenancePlans.columnPlanNo'),
      dataIndex: 'plan_no',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('pages.system.maintenancePlans.columnPlanName'),
      dataIndex: 'plan_name',
      width: 200,
    },
    {
      title: t('pages.system.maintenancePlans.columnEquipment'),
      dataIndex: 'equipment_name',
      width: 200,
    },
    {
      title: t('pages.system.maintenancePlans.columnPlanType'),
      dataIndex: 'plan_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '定期保养': { text: t('pages.system.maintenancePlans.planTypeRegular') },
        '预防性维护': { text: t('pages.system.maintenancePlans.planTypePreventive') },
        '故障维修': { text: t('pages.system.maintenancePlans.planTypeFault') },
        '其他': { text: t('pages.system.maintenancePlans.planTypeOther') },
      },
    },
    {
      title: t('pages.system.maintenancePlans.columnMaintenanceType'),
      dataIndex: 'maintenance_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '日常保养': { text: t('pages.system.maintenancePlans.maintenanceDaily') },
        '一级保养': { text: t('pages.system.maintenancePlans.maintenanceLevel1') },
        '二级保养': { text: t('pages.system.maintenancePlans.maintenanceLevel2') },
        '三级保养': { text: t('pages.system.maintenancePlans.maintenanceLevel3') },
        '大修': { text: t('pages.system.maintenancePlans.maintenanceOverhaul') },
      },
    },
    {
      title: t('pages.system.maintenancePlans.columnCycleType'),
      dataIndex: 'cycle_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '按时间': { text: t('pages.system.maintenancePlans.cycleByTime') },
        '按使用次数': { text: t('pages.system.maintenancePlans.cycleByCount') },
        '按运行时长': { text: t('pages.system.maintenancePlans.cycleByRuntime') },
      },
    },
    {
      title: t('pages.system.maintenancePlans.columnCycleValue'),
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
      title: t('pages.system.maintenancePlans.columnPlannedStart'),
      dataIndex: 'planned_start_date',
      width: 150,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: t('pages.system.maintenancePlans.columnPlannedEnd'),
      dataIndex: 'planned_end_date',
      width: 150,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: t('pages.system.maintenancePlans.columnResponsible'),
      dataIndex: 'responsible_person_name',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.maintenancePlans.columnStatus'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: t('pages.system.maintenancePlans.statusPending'), status: 'Default' },
        '执行中': { text: t('pages.system.maintenancePlans.statusRunning'), status: 'Processing' },
        '已完成': { text: t('pages.system.maintenancePlans.statusCompleted'), status: 'Success' },
        '已取消': { text: t('pages.system.maintenancePlans.statusCancelled'), status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待执行': { color: 'default', text: t('pages.system.maintenancePlans.statusPending') },
          '执行中': { color: 'processing', text: t('pages.system.maintenancePlans.statusRunning') },
          '已完成': { color: 'success', text: t('pages.system.maintenancePlans.statusCompleted') },
          '已取消': { color: 'error', text: t('pages.system.maintenancePlans.statusCancelled') },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.maintenancePlans.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.maintenancePlans.columnActions'),
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
            {t('pages.system.maintenancePlans.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.maintenancePlans.edit')}
          </Button>
          <Popconfirm
            title={t('pages.system.maintenancePlans.confirmDelete')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('pages.system.maintenancePlans.delete')}
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
          createButtonText={t('pages.system.maintenancePlans.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.maintenancePlans.batchDelete')}
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
                messageApi.warning(t('pages.system.maintenancePlans.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `maintenance-plans-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.maintenancePlans.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.maintenancePlans.exportFailed'));
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
        title={isEdit ? t('pages.system.maintenancePlans.modalEdit') : t('pages.system.maintenancePlans.modalCreate')}
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
          label={t('pages.system.maintenancePlans.labelPlanName')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.planNameRequired') }]}
          placeholder={t('pages.system.maintenancePlans.planNamePlaceholder')}
        />
        <ProFormSelect
          name="equipment_uuid"
          label={t('pages.system.maintenancePlans.labelEquipment')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.equipmentRequired') }]}
          options={equipmentList.map((eq) => ({
            label: `${eq.name} (${eq.code})`,
            value: eq.uuid,
          }))}
          placeholder={t('pages.system.maintenancePlans.equipmentPlaceholder')}
        />
        <ProFormSelect
          name="plan_type"
          label={t('pages.system.maintenancePlans.labelPlanType')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.planTypeRequired') }]}
          options={[
            { label: t('pages.system.maintenancePlans.planTypeRegular'), value: '定期保养' },
            { label: t('pages.system.maintenancePlans.planTypePreventive'), value: '预防性维护' },
            { label: t('pages.system.maintenancePlans.planTypeFault'), value: '故障维修' },
            { label: t('pages.system.maintenancePlans.planTypeOther'), value: '其他' },
          ]}
        />
        <ProFormSelect
          name="maintenance_type"
          label={t('pages.system.maintenancePlans.labelMaintenanceType')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.maintenanceTypeRequired') }]}
          options={[
            { label: t('pages.system.maintenancePlans.maintenanceDaily'), value: '日常保养' },
            { label: t('pages.system.maintenancePlans.maintenanceLevel1'), value: '一级保养' },
            { label: t('pages.system.maintenancePlans.maintenanceLevel2'), value: '二级保养' },
            { label: t('pages.system.maintenancePlans.maintenanceLevel3'), value: '三级保养' },
            { label: t('pages.system.maintenancePlans.maintenanceOverhaul'), value: '大修' },
          ]}
        />
        <ProFormSelect
          name="cycle_type"
          label={t('pages.system.maintenancePlans.labelCycleType')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.cycleTypeRequired') }]}
          options={[
            { label: t('pages.system.maintenancePlans.cycleByTime'), value: '按时间' },
            { label: t('pages.system.maintenancePlans.cycleByCount'), value: '按使用次数' },
            { label: t('pages.system.maintenancePlans.cycleByRuntime'), value: '按运行时长' },
          ]}
        />
        <ProFormDigit
          name="cycle_value"
          label={t('pages.system.maintenancePlans.labelCycleValue')}
          placeholder={t('pages.system.maintenancePlans.cycleValuePlaceholder')}
          fieldProps={{ min: 0 }}
        />
        <ProFormText
          name="cycle_unit"
          label={t('pages.system.maintenancePlans.labelCycleUnit')}
          placeholder={t('pages.system.maintenancePlans.cycleUnitPlaceholder')}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label={t('pages.system.maintenancePlans.labelPlannedStart')}
          placeholder={t('pages.system.maintenancePlans.plannedStartPlaceholder')}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label={t('pages.system.maintenancePlans.labelPlannedEnd')}
          placeholder={t('pages.system.maintenancePlans.plannedEndPlaceholder')}
        />
        <ProFormText
          name="responsible_person_name"
          label={t('pages.system.maintenancePlans.labelResponsible')}
          placeholder={t('pages.system.maintenancePlans.responsiblePlaceholder')}
        />
        <ProFormSelect
          name="status"
          label={t('pages.system.maintenancePlans.labelStatus')}
          rules={[{ required: true, message: t('pages.system.maintenancePlans.statusRequired') }]}
          options={[
            { label: t('pages.system.maintenancePlans.statusPending'), value: '待执行' },
            { label: t('pages.system.maintenancePlans.statusRunning'), value: '执行中' },
            { label: t('pages.system.maintenancePlans.statusCompleted'), value: '已完成' },
            { label: t('pages.system.maintenancePlans.statusCancelled'), value: '已取消' },
          ]}
        />
        <ProFormTextArea
          name="remark"
          label={t('pages.system.maintenancePlans.labelRemark')}
          placeholder={t('pages.system.maintenancePlans.remarkPlaceholder')}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.maintenancePlans.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          { title: t('pages.system.maintenancePlans.columnPlanNo'), dataIndex: 'plan_no' },
          { title: t('pages.system.maintenancePlans.columnPlanName'), dataIndex: 'plan_name' },
          { title: t('pages.system.maintenancePlans.columnEquipment'), dataIndex: 'equipment_name' },
          { title: t('pages.system.maintenancePlans.columnPlanType'), dataIndex: 'plan_type', render: (v: string) => (planTypeKey[v] ? t(planTypeKey[v]) : v) },
          { title: t('pages.system.maintenancePlans.columnMaintenanceType'), dataIndex: 'maintenance_type', render: (v: string) => (maintenanceTypeKey[v] ? t(maintenanceTypeKey[v]) : v) },
          { title: t('pages.system.maintenancePlans.columnCycleType'), dataIndex: 'cycle_type', render: (v: string) => (cycleTypeKey[v] ? t(cycleTypeKey[v]) : v) },
          {
            title: t('pages.system.maintenancePlans.columnCycleValue'),
            dataIndex: 'cycle_value',
            render: (value: number, record: MaintenancePlan) => {
              if (value && record.cycle_unit) {
                return `${value} ${record.cycle_unit}`;
              }
              return value || '-';
            },
          },
          { title: t('pages.system.maintenancePlans.columnCycleUnit'), dataIndex: 'cycle_unit' },
          { title: t('pages.system.maintenancePlans.columnPlannedStart'), dataIndex: 'planned_start_date' },
          { title: t('pages.system.maintenancePlans.columnPlannedEnd'), dataIndex: 'planned_end_date' },
          { title: t('pages.system.maintenancePlans.columnResponsible'), dataIndex: 'responsible_person_name' },
          { title: t('pages.system.maintenancePlans.columnStatus'), dataIndex: 'status', render: (v: string) => (detailStatusKey[v] ? t(detailStatusKey[v]) : v) },
          { title: t('pages.system.maintenancePlans.labelRemark'), dataIndex: 'remark', span: 2 },
          { title: t('pages.system.maintenancePlans.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('pages.system.maintenancePlans.columnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default MaintenancePlanListPage;

