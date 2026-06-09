/**
 * 设备故障维修管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的设备故障和维修记录。
 * 支持故障记录的 CRUD 操作和维修记录管理。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSwitch,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, message, Tabs, Modal, Descriptions } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const equipmentFaultDetailReqRef = useRef(0);
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
      messageApi.error(error.message || t('pages.system.equipmentFaults.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: EquipmentFault) => {
    const req = ++equipmentFaultDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getEquipmentFaultByUuid(record.uuid);
      if (equipmentFaultDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (equipmentFaultDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.equipmentFaults.getDetailFailed'));
      }
    } finally {
      if (equipmentFaultDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理删除故障记录
   */
  const handleDelete = async (record: EquipmentFault) => {
    try {
      await deleteEquipmentFault(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 批量删除故障记录
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let done = 0;
      let fail = 0;
      for (const uuid of keys) {
        try {
          await deleteEquipmentFault(String(uuid));
          done++;
        } catch {
          fail++;
        }
      }
      if (fail > 0) {
        messageApi.warning(t('pages.system.equipmentFaults.batchDeletePartial', { done, fail }));
      } else {
        messageApi.success(t('pages.system.equipmentFaults.batchDeleteSuccess', { count: done }));
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
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
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createEquipmentFault(values as CreateEquipmentFaultData);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error; // 重新抛出错误，让 FormModalTemplate 处理
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const faultTypeTextKey: Record<string, string> = {
    '机械故障': 'pages.system.equipmentFaults.typeMechanical',
    '电气故障': 'pages.system.equipmentFaults.typeElectrical',
    '软件故障': 'pages.system.equipmentFaults.typeSoftware',
    '其他': 'pages.system.equipmentFaults.typeOther',
  };
  const faultLevelTextKey: Record<string, string> = {
    '轻微': 'pages.system.equipmentFaults.levelMinor',
    '一般': 'pages.system.equipmentFaults.levelNormal',
    '严重': 'pages.system.equipmentFaults.levelSerious',
    '紧急': 'pages.system.equipmentFaults.levelUrgent',
  };

  const equipmentFaultDetailDescColumns = useMemo<ProDescriptionsItemProps<EquipmentFault>[]>(
    () => [
      { title: t('pages.system.equipmentFaults.columnFaultNo'), dataIndex: 'fault_no' },
      { title: t('pages.system.equipmentFaults.columnEquipment'), dataIndex: 'equipment_name' },
      { title: t('pages.system.equipmentFaults.columnFaultDate'), dataIndex: 'fault_date', valueType: 'dateTime' },
      {
        title: t('pages.system.equipmentFaults.columnFaultType'),
        dataIndex: 'fault_type',
        render: (_: unknown, record: EquipmentFault) =>
          faultTypeTextKey[record.fault_type] ? t(faultTypeTextKey[record.fault_type]) : record.fault_type,
      },
      {
        title: t('pages.system.equipmentFaults.columnFaultLevel'),
        dataIndex: 'fault_level',
        render: (_: unknown, record: EquipmentFault) =>
          faultLevelTextKey[record.fault_level] ? t(faultLevelTextKey[record.fault_level]) : record.fault_level,
      },
      { title: t('pages.system.equipmentFaults.columnFaultDesc'), dataIndex: 'fault_description', span: 2 },
      { title: t('pages.system.equipmentFaults.columnReporter'), dataIndex: 'reporter_name' },
      {
        title: t('pages.system.equipmentFaults.columnStatus'),
        dataIndex: 'status',
        render: (_: unknown, record: EquipmentFault) => {
          const statusMap: Record<string, { color: string; text: string }> = {
            '待处理': { color: 'default', text: t('pages.system.equipmentFaults.statusPending') },
            '处理中': { color: 'processing', text: t('pages.system.equipmentFaults.statusProcessing') },
            '已修复': { color: 'success', text: t('pages.system.equipmentFaults.statusFixed') },
            '已关闭': { color: 'error', text: t('pages.system.equipmentFaults.statusClosed') },
          };
          const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
          return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
        },
      },
      {
        title: t('pages.system.equipmentFaults.columnRepairRequired'),
        dataIndex: 'repair_required',
        render: (_: unknown, entity: EquipmentFault) => (
          <Tag color={entity?.repair_required ? 'success' : 'default'}>
            {entity?.repair_required ? t('pages.system.equipmentFaults.yes') : t('pages.system.equipmentFaults.no')}
          </Tag>
        ),
      },
      { title: t('pages.system.equipmentFaults.labelRemark'), dataIndex: 'remark', span: 2 },
      { title: t('pages.system.equipmentFaults.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('pages.system.equipmentFaults.labelUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  const columns: ProColumns<EquipmentFault>[] = [
    {
      title: t('pages.system.equipmentFaults.columnFaultNo'),
      dataIndex: 'fault_no',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('pages.system.equipmentFaults.columnEquipment'),
      dataIndex: 'equipment_name',
      width: 200,
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultDate'),
      dataIndex: 'fault_date',
      width: 150,
      valueType: 'date',
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultType'),
      dataIndex: 'fault_type',
      width: 120,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(faultTypeTextKey).map(([k, key]) => [k, { text: t(key) }])
      ),
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultLevel'),
      dataIndex: 'fault_level',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '轻微': { text: t('pages.system.equipmentFaults.levelMinor'), status: 'Default' },
        '一般': { text: t('pages.system.equipmentFaults.levelNormal'), status: 'Processing' },
        '严重': { text: t('pages.system.equipmentFaults.levelSerious'), status: 'Warning' },
        '紧急': { text: t('pages.system.equipmentFaults.levelUrgent'), status: 'Error' },
      },
      render: (_, record) => {
        const levelMap: Record<string, { color: string; text: string }> = {
          '轻微': { color: 'default', text: t('pages.system.equipmentFaults.levelMinor') },
          '一般': { color: 'processing', text: t('pages.system.equipmentFaults.levelNormal') },
          '严重': { color: 'warning', text: t('pages.system.equipmentFaults.levelSerious') },
          '紧急': { color: 'error', text: t('pages.system.equipmentFaults.levelUrgent') },
        };
        const levelInfo = levelMap[record.fault_level] || { color: 'default', text: record.fault_level };
        return <Tag color={levelInfo.color}>{levelInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultDesc'),
      dataIndex: 'fault_description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipmentFaults.columnReporter'),
      dataIndex: 'reporter_name',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipmentFaults.columnStatus'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: t('pages.system.equipmentFaults.statusPending'), status: 'Default' },
        '处理中': { text: t('pages.system.equipmentFaults.statusProcessing'), status: 'Processing' },
        '已修复': { text: t('pages.system.equipmentFaults.statusFixed'), status: 'Success' },
        '已关闭': { text: t('pages.system.equipmentFaults.statusClosed'), status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待处理': { color: 'default', text: t('pages.system.equipmentFaults.statusPending') },
          '处理中': { color: 'processing', text: t('pages.system.equipmentFaults.statusProcessing') },
          '已修复': { color: 'success', text: t('pages.system.equipmentFaults.statusFixed') },
          '已关闭': { color: 'error', text: t('pages.system.equipmentFaults.statusClosed') },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnRepairRequired'),
      dataIndex: 'repair_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.equipmentFaults.yes'), status: 'Success' },
        false: { text: t('pages.system.equipmentFaults.no'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.repair_required ? 'success' : 'default'}>
          {record.repair_required ? t('pages.system.equipmentFaults.yes') : t('pages.system.equipmentFaults.no')}
        </Tag>
      ),
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipmentFaults.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.equipmentFaults.columnActions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')}
              key="view"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              {t('pages.system.equipmentFaults.view')}
            </Button>,
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('pages.system.equipmentFaults.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.equipmentFaults.confirmDeleteOne')}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('pages.system.equipmentFaults.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentFault>
          columnPersistenceId="pages.system.equipment-faults.list"
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
          showCreateButton
          createButtonText={t('pages.system.equipmentFaults.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.equipmentFaults.batchDelete')}
          deleteConfirmTitle={t('pages.system.equipmentFaults.batchDeleteTitle')}
          deleteConfirmDescription={(c) => t('pages.system.equipmentFaults.batchDeleteDescription', { count: c })}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getEquipmentFaultList({ skip: 0, limit: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `equipment-faults-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
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
        title={isEdit ? t('pages.system.equipmentFaults.modalEdit') : t('pages.system.equipmentFaults.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormSelect
          name="equipment_uuid"
          label={t('pages.system.equipmentFaults.labelEquipment')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.equipmentRequired') }]}
          options={equipmentList.map((eq) => ({
            label: `${eq.name} (${eq.code})`,
            value: eq.uuid,
          }))}
          placeholder={t('pages.system.equipmentFaults.equipmentPlaceholder')}
        />
        <ProFormDatePicker
          name="fault_date"
          label={t('pages.system.equipmentFaults.columnFaultDate')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.faultDateRequired') }]}
          placeholder={t('pages.system.equipmentFaults.faultDatePlaceholder')}
          fieldProps={{ showTime: true }}
        />
        <ProFormSelect
          name="fault_type"
          label={t('pages.system.equipmentFaults.columnFaultType')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.faultTypeRequired') }]}
          options={[
            { label: t('pages.system.equipmentFaults.typeMechanical'), value: '机械故障' },
            { label: t('pages.system.equipmentFaults.typeElectrical'), value: '电气故障' },
            { label: t('pages.system.equipmentFaults.typeSoftware'), value: '软件故障' },
            { label: t('pages.system.equipmentFaults.typeOther'), value: '其他' },
          ]}
        />
        <ProFormSelect
          name="fault_level"
          label={t('pages.system.equipmentFaults.columnFaultLevel')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.faultLevelRequired') }]}
          options={[
            { label: t('pages.system.equipmentFaults.levelMinor'), value: '轻微' },
            { label: t('pages.system.equipmentFaults.levelNormal'), value: '一般' },
            { label: t('pages.system.equipmentFaults.levelSerious'), value: '严重' },
            { label: t('pages.system.equipmentFaults.levelUrgent'), value: '紧急' },
          ]}
        />
        <ProFormTextArea
          name="fault_description"
          label={t('pages.system.equipmentFaults.columnFaultDesc')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.faultDescRequired') }]}
          placeholder={t('pages.system.equipmentFaults.faultDescPlaceholder')}
          fieldProps={{ rows: 4 }}
        />
        <ProFormText
          name="reporter_name"
          label={t('pages.system.equipmentFaults.labelReporterName')}
          placeholder={t('pages.system.equipmentFaults.reporterPlaceholder')}
        />
        <ProFormSelect
          name="status"
          label={t('pages.system.equipmentFaults.columnStatus')}
          rules={[{ required: true, message: t('pages.system.equipmentFaults.statusRequired') }]}
          options={[
            { label: t('pages.system.equipmentFaults.statusPending'), value: '待处理' },
            { label: t('pages.system.equipmentFaults.statusProcessing'), value: '处理中' },
            { label: t('pages.system.equipmentFaults.statusFixed'), value: '已修复' },
            { label: t('pages.system.equipmentFaults.statusClosed'), value: '已关闭' },
          ]}
        />
        <ProFormSwitch
          name="repair_required"
          label={t('pages.system.equipmentFaults.labelRepairRequired')}
          initialValue={true}
        />
        <ProFormTextArea
          name="remark"
          label={t('pages.system.equipmentFaults.labelRemark')}
          placeholder={t('pages.system.equipmentFaults.remarkPlaceholder')}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <UniDetail
        title={t('pages.system.equipmentFaults.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(equipmentFaultDetailDescColumns, detailData)}
            />
          ) : null
        }
      />
    </>
  );
};

export default EquipmentFaultListPage;

