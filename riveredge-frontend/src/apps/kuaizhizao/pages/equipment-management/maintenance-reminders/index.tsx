import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备维护提醒页面
 *
 * 展示设备维护计划到期提醒，支持查看、标记已读、标记已处理等操作。
 *
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Tag, notification, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { CheckOutlined, EyeOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { FormModalTemplate, DetailDrawerTemplate, DRAWER_CONFIG, MultiTabListPageTemplate, detailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';
import { maintenanceReminderApi, equipmentApi } from '../../../services/equipment';
import { ProFormTextArea } from '@ant-design/pro-components';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { getMaintenanceReminderLifecycle } from '../../../utils/equipmentLifecycle';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  normalizeEquipmentListResponse,
  resolveReminderListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.maintenanceReminder';

interface MaintenanceReminder {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  maintenance_plan_id?: number;
  maintenance_plan_uuid?: string;
  equipment_id?: number;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  reminder_type?: string;
  reminder_date?: string;
  planned_maintenance_date?: string;
  days_until_due?: number;
  reminder_message?: string;
  is_read?: boolean;
  read_at?: string;
  read_by?: number;
  is_handled?: boolean;
  handled_at?: string;
  handled_by?: number;
  handled_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

const MaintenanceRemindersPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const reminderDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi, notification: notificationApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const calibrationActionRef = useRef<ActionType>(null);
  const [activeTabKey, setActiveTabKey] = useState('maintenance');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MaintenanceReminder[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, setDetail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MaintenanceReminder>();
  const [handleTarget, setHandleTarget] = useState<MaintenanceReminder | null>(null);

  const [reminderTrackingRefreshKey, setReminderTrackingRefreshKey] = useState(0);

  const reminderTracking = useDocumentTracking(
    detailVisible && detail?.id ? 'maintenance_reminder' : undefined,
    detail?.id,
    reminderTrackingRefreshKey,
  );

  // 处理Modal
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const handleFormRef = useRef<ProFormInstance>();

  /**
   * 获取未读提醒数量
   */
  const fetchUnreadCount = async () => {
    try {
      const data = await maintenanceReminderApi.getUnreadCount();
      setUnreadCount(data.unread_count || 0);

      // 如果有未读提醒，显示通知
      if (data.unread_count > 0) {
        notificationApi.info({
          message: t(`${P}.notificationTitle`),
          description: t(`${P}.notificationDescription`, { count: data.unread_count }),
          duration: 5,
          placement: 'topRight',
        });
      }
    } catch (error: any) {
      console.error('获取未读数量失败:', error);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    fetchUnreadCount();
    // 每30秒刷新一次未读数量
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  /**
   * 处理标记为已读
   */
  const handleMarkAsRead = async (record: MaintenanceReminder) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }

      await maintenanceReminderApi.markAsRead({
        reminder_uuids: [record.uuid],
      });

      messageApi.success(t(`${P}.markReadSuccess`));
      actionRef.current?.reload();
      fetchUnreadCount();
      if (detailVisible && detail?.uuid === record.uuid) {
        setDetail((prev) => (prev ? { ...prev, is_read: true } : null));
        setReminderTrackingRefreshKey((k) => k + 1);
      }
    } catch (error: any) {
      messageApi.error(t(`${P}.markReadFailed`, { message: error.message || t('common.unknownError') }));
    }
  };

  /**
   * 处理标记为已处理
   */
  const handleMarkAsHandled = async (record: MaintenanceReminder) => {
    setHandleTarget(record);
    setHandleModalVisible(true);
    setTimeout(() => {
      handleFormRef.current?.resetFields();
    }, 100);
  };

  /**
   * 提交标记为已处理
   */
  const handleMarkAsHandledSubmit = async (values: any) => {
    try {
      if (!handleTarget?.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }

      const drawerUuid = handleTarget.uuid;
      const updated = (await maintenanceReminderApi.markAsHandled({
        reminder_uuid: handleTarget.uuid,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      })) as MaintenanceReminder;

      messageApi.success(t(`${P}.markHandledSuccess`));
      setHandleModalVisible(false);
      setHandleTarget(null);
      actionRef.current?.reload();
      fetchUnreadCount();
      if (detailVisible && updated?.uuid === drawerUuid) {
        setDetail(updated);
        setReminderTrackingRefreshKey((k) => k + 1);
      }
    } catch (error: any) {
      messageApi.error(t(`${P}.markHandledFailed`, { message: error.message || t('common.unknownError') }));
    }
  };

  /**
   * 批量标记为已读
   */
  const handleBatchMarkAsRead = async (selectedRows: MaintenanceReminder[]) => {
    try {
      const uuids = selectedRows.map((row) => row.uuid).filter(Boolean) as string[];
      if (uuids.length === 0) {
        messageApi.warning(t(`${P}.selectReminders`));
        return;
      }

      await maintenanceReminderApi.markAsRead({
        reminder_uuids: uuids,
      });

      messageApi.success(t(`${P}.batchMarkReadSuccess`, { count: uuids.length }));
      setSelectedRowKeys([]);
      setSelectedRows([]);
      actionRef.current?.reload();
      fetchUnreadCount();
    } catch (error: any) {
      messageApi.error(t(`${P}.batchMarkReadFailed`, { message: error.message || t('common.unknownError') }));
    }
  };

  /**
   * 处理查看详情
   */
  const handleViewDetail = useCallback(
    (record: MaintenanceReminder) => {
      if (!record.uuid) return;
      setReminderTrackingRefreshKey((k) => k + 1);
      void openDetail(async () => record as MaintenanceReminder);
    },
    [openDetail],
  );

  /**
   * 手动检查维护计划
   */
  const handleCheckMaintenancePlans = async () => {
    try {
      const result = await maintenanceReminderApi.checkMaintenancePlans({
        advance_days: 7,
      });

      messageApi.success(t(`${P}.checkSuccess`, { count: result.reminder_count || 0 }));
      actionRef.current?.reload();
      fetchUnreadCount();
    } catch (error: any) {
      messageApi.error(t(`${P}.checkFailed`, { message: error.message || t('common.unknownError') }));
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<MaintenanceReminder>[] = useMemo(
    () => {
      const getReminderTypeTag = (type: string) => {
        if (type === 'overdue') {
          return <Tag color="red">{t(`${P}.reminderType.overdue`)}</Tag>;
        }
        if (type === 'due_soon') {
          return <Tag color="orange">{t(`${P}.reminderType.dueSoon`)}</Tag>;
        }
        return <Tag>{type}</Tag>;
      };

      const renderDaysUntilDue = (days: number) => {
        if (days < 0) {
          return <Tag color="red">{t(`${P}.daysOverdue`, { days: Math.abs(days) })}</Tag>;
        }
        if (days === 0) {
          return <Tag color="orange">{t(`${P}.dueToday`)}</Tag>;
        }
        return <Tag color="blue">{t(`${P}.daysRemaining`, { days })}</Tag>;
      };

      return [
        {
          title: t(`${P}.col.equipmentCode`),
          dataIndex: 'equipment_code',
          render: (_, r) => (
            <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
          ),
        },
        { title: t(`${P}.col.equipmentName`), dataIndex: 'equipment_name' },
        {
          title: t(`${P}.col.reminderType`),
          dataIndex: 'reminder_type',
          render: (_, r) => getReminderTypeTag(r.reminder_type || ''),
        },
        {
          title: t(`${P}.col.plannedMaintenanceDate`),
          dataIndex: 'planned_maintenance_date',
          render: (_, r) =>
            r.planned_maintenance_date ? formatDateTime(r.planned_maintenance_date, 'YYYY-MM-DD HH:mm') : '-',
        },
        {
          title: t(`${P}.col.daysUntilDue`),
          dataIndex: 'days_until_due',
          render: (_, r) => renderDaysUntilDue(r.days_until_due ?? 0),
        },
        { title: t(`${P}.col.reminderMessage`), dataIndex: 'reminder_message' },
        {
          title: t(`${P}.col.reminderDate`),
          dataIndex: 'reminder_date',
          valueType: 'dateTime',
        },
      ];
    },
    [t],
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaintenanceReminder>[] = useMemo(
    () => {
      const getReminderTypeTag = (type: string) => {
        if (type === 'overdue') {
          return <Tag color="red">{t(`${P}.reminderType.overdue`)}</Tag>;
        }
        if (type === 'due_soon') {
          return <Tag color="orange">{t(`${P}.reminderType.dueSoon`)}</Tag>;
        }
        return <Tag>{type}</Tag>;
      };

      const renderDaysUntilDue = (days: number) => {
        if (days < 0) {
          return <Tag color="red">{t(`${P}.daysOverdue`, { days: Math.abs(days) })}</Tag>;
        }
        if (days === 0) {
          return <Tag color="orange">{t(`${P}.dueToday`)}</Tag>;
        }
        return <Tag color="blue">{t(`${P}.daysRemaining`, { days })}</Tag>;
      };

      return [
        {
          title: t(`${P}.col.reminderDate`),
          dataIndex: 'reminder_date_range',
          valueType: 'dateRange',
          hideInTable: true,
          formItemProps: formDateRangeFormItemProps,
          search: { order: 10 } as ProColumns['search'],
        },
        {
          title: t(`${P}.col.reminderType`),
          dataIndex: 'reminder_type',
          valueType: 'select',
          valueEnum: {
            due_soon: { text: t(`${P}.reminderType.dueSoon`) },
            overdue: { text: t(`${P}.reminderType.overdue`) },
          },
          hideInTable: true,
          search: { order: 20 } as ProColumns['search'],
        },
        {
          title: t(`${P}.col.equipmentCode`),
          dataIndex: 'equipment_code',
          width: 120,
          fixed: 'left',
          sorter: true,
          search: { order: 30 } as ProColumns['search'],
          render: (_, r) => (
            <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
              {r.equipment_code ?? '-'}
            </Typography.Text>
          ),
        },
        {
          title: t(`${P}.col.equipmentName`),
          dataIndex: 'equipment_name',
          width: 150,
          sorter: true,
          hideInSearch: true,
        },
        {
          title: t(`${P}.col.reminderType`),
          dataIndex: 'reminder_type',
          width: 120,
          sorter: true,
          hideInSearch: true,
          render: (_, record) => getReminderTypeTag(record.reminder_type || ''),
        },
        {
          title: t(`${P}.col.plannedMaintenanceDate`),
          dataIndex: 'planned_maintenance_date',
          width: 132,
          uniTableKeepWidth: true,
          sorter: true,
          hideInSearch: true,
          render: (_, record) =>
            record.planned_maintenance_date
              ? formatDateTime(record.planned_maintenance_date, 'YYYY-MM-DD HH:mm')
              : '-',
        },
        {
          title: t(`${P}.col.daysUntilDue`),
          dataIndex: 'days_until_due',
          width: 100,
          sorter: true,
          hideInSearch: true,
          render: (_, record) => renderDaysUntilDue(record.days_until_due || 0),
        },
        {
          title: t(`${P}.col.reminderMessage`),
          dataIndex: 'reminder_message',
          ellipsis: true,
          width: 200,
          sorter: true,
          hideInSearch: true,
        },
        {
          title: t(`${P}.col.reminderDate`),
          dataIndex: 'reminder_date',
          width: 132,
          uniTableKeepWidth: true,
          sorter: true,
          hideInSearch: true,
          render: (_, record) =>
            record.reminder_date ? formatDateTime(record.reminder_date, 'YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
          title: t('common.actions'),
          valueType: 'option',
          width: 200,
          fixed: 'right',
          render: (_, record) => (
            <Space>
              <Button key="view" {...rowActionKind('read')}
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
              >
                {t('common.view')}
              </Button>
              {!record.is_read && (
                <Button key="approve" {...rowActionKind('audit')}
                  icon={<CheckOutlined />}
                  onClick={() => handleMarkAsRead(record)}
                >
                  {t(`${P}.action.markRead`)}
                </Button>
              )}
              {!record.is_handled && (
                <Button key="approve" {...rowActionKind('audit')}
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleMarkAsHandled(record)}
                >
                  {t(`${P}.action.markHandled`)}
                </Button>
              )}
            </Space>
          ),
        },
      ];
    },
    [t],
  );

  interface EquipmentCalibrationReminder {
    equipment_uuid?: string;
    equipment_code?: string;
    equipment_name?: string;
    due_date?: string;
    days_until_due?: number;
    due_type?: string;
  }

  const calibrationColumns: ProColumns<EquipmentCalibrationReminder>[] = useMemo(
    () => [
      {
        title: t(`${P}.calibration.colEquipmentCode`),
        dataIndex: 'equipment_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
            {r.equipment_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.calibration.colEquipmentName`), dataIndex: 'equipment_name', width: 160, ellipsis: true },
      {
        title: t(`${P}.calibration.colDueDate`),
        dataIndex: 'due_date',
        width: 120,
        hideInSearch: true,
        render: (_, r) => (r.due_date ? formatDateTime(r.due_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.calibration.colDaysUntilDue`),
        dataIndex: 'days_until_due',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (_, r) => {
          const v = r.days_until_due ?? 0;
          if (v < 0) return <Tag color="red">{t(`${P}.calibration.overdueDays`, { count: Math.abs(v) })}</Tag>;
          return <span>{t(`${P}.calibration.daysRemaining`, { count: v })}</span>;
        },
      },
      {
        title: t(`${P}.calibration.colReminderStatus`),
        dataIndex: 'due_type',
        width: 100,
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t(`${P}.calibration.statusDueSoon`), status: 'Warning' },
          overdue: { text: t(`${P}.calibration.statusOverdue`), status: 'Error' },
        },
      },
    ],
    [t],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        preserveMounted
        tabs={[
          {
            key: 'maintenance',
            label: t(`${P}.tabMaintenance`),
            children: (
              <UniTable<MaintenanceReminder>
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-reminders"
        actionRef={actionRef}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolveReminderListParams(searchFormValues, sort);
          const response = await maintenanceReminderApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            ...listParams,
          });

          if (response.unread_count !== undefined) {
            setUnreadCount(response.unread_count);
          }

          const { data, total } = normalizeEquipmentListResponse(response);
          return {
            data: data as MaintenanceReminder[],
            success: true,
            total,
          };
        }}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
          searchText: t(`${P}.search`),
          resetText: t(`${P}.reset`),
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys);
            setSelectedRows(rows as MaintenanceReminder[]);
          },
        }}
        toolBarRender={() => [
          <Button key="manual-check" icon={<ReloadOutlined />} onClick={handleCheckMaintenancePlans}>
            {t(`${P}.manualCheck`)}
          </Button>,
          <Button {...rowActionKind('update')}
            key="batch-read"
            disabled={selectedRows.length === 0}
            onClick={() => handleBatchMarkAsRead(selectedRows)}
          >
            {t(`${P}.batchMarkRead`, { count: selectedRows.length })}
          </Button>,
        ]}
              />
            ),
          },
          {
            key: 'calibration',
            label: t(`${P}.tabCalibration`),
            children: (
              <UniTable<EquipmentCalibrationReminder>
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-reminders.calibration"
                actionRef={calibrationActionRef}
                showAdvancedSearch
                skipFuzzyPinyinClientFilter
                rowKey={(record) =>
                  [record.equipment_uuid, record.due_date, record.due_type].filter(Boolean).join(':') ||
                  'calibration-reminder-unknown'
                }
                columns={calibrationColumns}
                request={async (params) => {
                  const res = await equipmentApi.listCalibrationReminders({
                    skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                    limit: params.pageSize || 20,
                    due_type: params.due_type as string | undefined,
                  });
                  return { data: res.items || [], success: true, total: res.total || 0 };
                }}
                search={{ labelWidth: 'auto' }}
                pagination={{ defaultPageSize: 20 }}
              />
            ),
          },
        ]}
      />

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailVisible}
        loading={detailLoading}
        zIndex={reminderDetailDrawerZIndex}
        onClose={() => {
          closeDetail();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          detail ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(detailBaseColumns, detail)}
            />
          ) : undefined
        }
        basicTitle={t(`${P}.section.basicInfo`)}
        collaborationTitle={t(`${P}.section.lifecycle`)}
        collaborationLifecycle={
          detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const lc = getMaintenanceReminderLifecycle(detail as Record<string, unknown>, t);
                const mainStages = lc.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <UniLifecycleStepper
                    steps={mainStages}
                    showLabels
                    status={lc.status}
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                );
              })()}
              <Typography.Text type="secondary">
                {t(`${P}.readHandleStatus`, {
                  read: detail.is_read ? t(`${P}.yes`) : t(`${P}.no`),
                  readAt: detail.read_at
                    ? `（${formatDateTime(detail.read_at, 'YYYY-MM-DD HH:mm:ss')}）`
                    : '',
                  handled: detail.is_handled ? t(`${P}.yes`) : t(`${P}.no`),
                  handledAt: detail.handled_at
                    ? `（${formatDateTime(detail.handled_at, 'YYYY-MM-DD HH:mm:ss')}，${detail.handled_by_name || '-'}）`
                    : '',
                })}
              </Typography.Text>
            </div>
          ) : undefined
        }
        traceDocument={
          detail?.id != null
            ? {
                documentType: 'maintenance_reminder',
                documentId: detail.id,
                selfDocumentId: detail.id,
                renderBriefActions: (doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={closeDetail}
                  />
                ),
              }
            : null
        }
        timeline={
          reminderTracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : reminderTracking.error ? (
            <Typography.Text type="danger">{reminderTracking.error}</Typography.Text>
          ) : reminderTracking.data ? (
            <DocumentTrackingTimelineBody data={reminderTracking.data} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
          )
        }
        timelineTitle={t(`${P}.section.operationHistory`)}
      />

      {/* 标记已处理Modal */}
      <FormModalTemplate
        title={t(`${P}.handleModal`)}
        open={handleModalVisible}
        onClose={() => setHandleModalVisible(false)}
        formRef={handleFormRef}
        layout="vertical"
        onFinish={handleMarkAsHandledSubmit}
      >
        <DocumentAttachmentsField category="maintenance_reminder_attachments" />
        <ProFormTextArea
          name="remark"
          label={t(`${P}.form.handleRemark`)}
          placeholder={t(`${P}.form.handleRemarkPlaceholder`)}
        />
      </FormModalTemplate>
    </>
  );
};

export default MaintenanceRemindersPage;
