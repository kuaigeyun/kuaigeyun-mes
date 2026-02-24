/**
 * 工作时间段配置管理页面
 *
 * 提供工作时间段配置的CRUD功能，用于配置组织的工作时间段。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { apiRequest } from '../../../services/api';

/**
 * 工作时间段配置接口定义
 */
interface WorkingHoursConfig {
  id?: number;
  name?: string;
  scope_type?: string;
  scope_id?: number;
  scope_name?: string;
  day_of_week?: number;
  start_date?: string;
  end_date?: string;
  working_hours?: Array<{ start: string; end: string }>;
  is_enabled?: boolean;
  priority?: number;
  remarks?: string;
  created_at?: string;
}

/**
 * 工作时间段配置管理页面组件
 */
const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const;
const SCOPE_TYPE_KEYS: Record<string, string> = {
  all: 'scopeAll',
  warehouse: 'scopeWarehouse',
  work_center: 'scopeWorkCenter',
  department: 'scopeDepartment',
};

const WorkingHoursConfigsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<WorkingHoursConfig | null>(null);

  /**
   * 处理新建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: WorkingHoursConfig) => {
    if (record.id) {
      setIsEdit(true);
      setCurrentId(record.id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const detailData = await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'GET' });
        formRef.current?.setFieldsValue({
          name: detailData.name,
          scope_type: detailData.scope_type,
          scope_id: detailData.scope_id,
          day_of_week: detailData.day_of_week,
          start_date: detailData.start_date,
          end_date: detailData.end_date,
          working_hours: detailData.working_hours,
          is_enabled: detailData.is_enabled,
          priority: detailData.priority,
          remarks: detailData.remarks,
        });
      } catch (error) {
        messageApi.error('获取配置详情失败');
      }
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: WorkingHoursConfig) => {
    if (record.id) {
      try {
        await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'DELETE' });
        messageApi.success(t('pages.system.workingHoursConfigs.deleteSuccess'));
        actionRef.current?.reload();
      } catch (error) {
        messageApi.error(t('pages.system.workingHoursConfigs.deleteFailed'));
      }
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: WorkingHoursConfig) => {
    if (record.id) {
      try {
        const detailData = await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'GET' });
        setCurrentRecord(detailData);
        setDetailDrawerVisible(true);
      } catch (error) {
        messageApi.error(t('pages.system.workingHoursConfigs.getDetailFailed'));
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<WorkingHoursConfig>[] = [
    {
      title: t('pages.system.workingHoursConfigs.columnName'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('pages.system.workingHoursConfigs.columnScopeType'),
      dataIndex: 'scope_type',
      width: 120,
      valueEnum: {
        all: { text: t('pages.system.workingHoursConfigs.scopeAll'), status: 'default' },
        warehouse: { text: t('pages.system.workingHoursConfigs.scopeWarehouse'), status: 'processing' },
        work_center: { text: t('pages.system.workingHoursConfigs.scopeWorkCenter'), status: 'success' },
        department: { text: t('pages.system.workingHoursConfigs.scopeDepartment'), status: 'warning' },
      },
    },
    {
      title: t('pages.system.workingHoursConfigs.columnScopeName'),
      dataIndex: 'scope_name',
      width: 150,
      ellipsis: true,
      render: (_, record) => record.scope_name || t('pages.system.workingHoursConfigs.scopeAll'),
    },
    {
      title: t('pages.system.workingHoursConfigs.columnDayOfWeek'),
      dataIndex: 'day_of_week',
      width: 100,
      render: (_, record) => {
        if (record.day_of_week === null || record.day_of_week === undefined) {
          return t('pages.system.workingHoursConfigs.dayAll');
        }
        return t(`pages.system.workingHoursConfigs.${DAY_KEYS[record.day_of_week]}`) || '-';
      },
    },
    {
      title: t('pages.system.workingHoursConfigs.columnWorkingHours'),
      dataIndex: 'working_hours',
      width: 200,
      ellipsis: true,
      render: (_, record) => {
        if (!record.working_hours || record.working_hours.length === 0) {
          return '-';
        }
        return record.working_hours.map((h: any) => `${h.start}-${h.end}`).join(', ');
      },
    },
    {
      title: t('pages.system.workingHoursConfigs.columnEnabled'),
      dataIndex: 'is_enabled',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_enabled ? 'success' : 'default'}>
          {record.is_enabled ? t('pages.system.workingHoursConfigs.enabled') : t('pages.system.workingHoursConfigs.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.workingHoursConfigs.columnPriority'),
      dataIndex: 'priority',
      width: 80,
      align: 'right',
    },
    {
      title: t('pages.system.workingHoursConfigs.columnCreatedAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('pages.system.workingHoursConfigs.columnActions'),
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            {t('pages.system.workingHoursConfigs.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.workingHoursConfigs.edit')}
          </Button>
          <Popconfirm
            title={t('pages.system.workingHoursConfigs.confirmDelete')}
            onConfirm={() => handleDelete(record)}
            okText={t('pages.system.workingHoursConfigs.commonOk')}
            cancelText={t('pages.system.workingHoursConfigs.commonCancel')}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('pages.system.workingHoursConfigs.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 处理表单提交
   */
  const handleFormFinish = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && currentId) {
        await apiRequest(`/core/working-hours-configs/${currentId}`, {
          method: 'PUT',
          data: values,
        });
        messageApi.success(t('pages.system.workingHoursConfigs.updateSuccess'));
      } else {
        await apiRequest('/core/working-hours-configs', {
          method: 'POST',
          data: values,
        });
        messageApi.success(t('pages.system.workingHoursConfigs.createSuccess'));
      }
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.workingHoursConfigs.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('pages.system.workingHoursConfigs.headerTitle')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/core/working-hours-configs', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error(t('pages.system.workingHoursConfigs.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton
        createButtonText={t('pages.system.workingHoursConfigs.createButton')}
        onCreate={handleCreate}
        showAdvancedSearch={true}
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, _keys, pageData) => {
          try {
            const result = await apiRequest('/core/working-hours-configs', {
              method: 'GET',
              params: { skip: 0, limit: 10000 },
            });
            const items = Array.isArray(result) ? result : [];
            const toExport = type === 'currentPage' && pageData?.length ? pageData : items;
            if (toExport.length === 0) {
              messageApi.warning(t('pages.system.workingHoursConfigs.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `working-hours-configs-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.workingHoursConfigs.exportSuccess', { count: toExport.length }));
          } catch (error: any) {
            messageApi.error(t('pages.system.workingHoursConfigs.exportFailed'));
          }
        }}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.workingHoursConfigs.modalEdit') : t('pages.system.workingHoursConfigs.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleFormFinish}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        layout="vertical"
        grid={true}
        initialValues={{
          scope_type: 'all',
          is_enabled: true,
          priority: 0,
          working_hours: [{ start: '09:00', end: '18:00' }],
        }}
      >
        <ProFormText
          name="name"
          label={t('pages.system.workingHoursConfigs.labelName')}
          placeholder={t('pages.system.workingHoursConfigs.namePlaceholder')}
          rules={[{ required: true, message: t('pages.system.workingHoursConfigs.nameRequired') }]}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="scope_type"
          label={t('pages.system.workingHoursConfigs.labelScopeType')}
          placeholder={t('pages.system.workingHoursConfigs.scopeTypePlaceholder')}
          rules={[{ required: true, message: t('pages.system.workingHoursConfigs.scopeTypeRequired') }]}
          options={[
            { label: t('pages.system.workingHoursConfigs.scopeAll'), value: 'all' },
            { label: t('pages.system.workingHoursConfigs.scopeWarehouse'), value: 'warehouse' },
            { label: t('pages.system.workingHoursConfigs.scopeWorkCenter'), value: 'work_center' },
            { label: t('pages.system.workingHoursConfigs.scopeDepartment'), value: 'department' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="day_of_week"
          label={t('pages.system.workingHoursConfigs.labelDayOfWeek')}
          placeholder={t('pages.system.workingHoursConfigs.dayOfWeekPlaceholder')}
          options={[
            { label: t('pages.system.workingHoursConfigs.dayAll'), value: null },
            { label: t('pages.system.workingHoursConfigs.dayMon'), value: 0 },
            { label: t('pages.system.workingHoursConfigs.dayTue'), value: 1 },
            { label: t('pages.system.workingHoursConfigs.dayWed'), value: 2 },
            { label: t('pages.system.workingHoursConfigs.dayThu'), value: 3 },
            { label: t('pages.system.workingHoursConfigs.dayFri'), value: 4 },
            { label: t('pages.system.workingHoursConfigs.daySat'), value: 5 },
            { label: t('pages.system.workingHoursConfigs.daySun'), value: 6 },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="start_date"
          label={t('pages.system.workingHoursConfigs.labelStartDate')}
          placeholder={t('pages.system.workingHoursConfigs.startDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="end_date"
          label={t('pages.system.workingHoursConfigs.labelEndDate')}
          placeholder={t('pages.system.workingHoursConfigs.endDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label={t('pages.system.workingHoursConfigs.labelEnabled')}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="priority"
          label={t('pages.system.workingHoursConfigs.labelPriority')}
          placeholder={t('pages.system.workingHoursConfigs.priorityPlaceholder')}
          fieldProps={{ min: 0 }}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="remarks"
          label={t('pages.system.workingHoursConfigs.labelRemarks')}
          placeholder={t('pages.system.workingHoursConfigs.remarksPlaceholder')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`${t('pages.system.workingHoursConfigs.detailTitle')} - ${currentRecord?.name || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>{t('pages.system.workingHoursConfigs.columnName')}：</strong>{currentRecord.name}</p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnScopeType')}：</strong>{currentRecord.scope_type && SCOPE_TYPE_KEYS[currentRecord.scope_type] ? t(`pages.system.workingHoursConfigs.${SCOPE_TYPE_KEYS[currentRecord.scope_type]}`) : currentRecord.scope_type || '-'}</p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnScopeName')}：</strong>{currentRecord.scope_name || t('pages.system.workingHoursConfigs.scopeAll')}</p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnDayOfWeek')}：</strong>
                {currentRecord.day_of_week === null || currentRecord.day_of_week === undefined
                  ? t('pages.system.workingHoursConfigs.dayAll')
                  : t(`pages.system.workingHoursConfigs.${DAY_KEYS[currentRecord.day_of_week]}`)}
              </p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnWorkingHours')}：</strong>
                {currentRecord.working_hours && currentRecord.working_hours.length > 0
                  ? currentRecord.working_hours.map((h: any) => `${h.start}-${h.end}`).join(', ')
                  : '-'}
              </p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnEnabled')}：</strong>
                <Tag color={currentRecord.is_enabled ? 'success' : 'default'}>
                  {currentRecord.is_enabled ? t('pages.system.workingHoursConfigs.enabled') : t('pages.system.workingHoursConfigs.disabled')}
                </Tag>
              </p>
              <p><strong>{t('pages.system.workingHoursConfigs.columnPriority')}：</strong>{currentRecord.priority}</p>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default WorkingHoursConfigsPage;

