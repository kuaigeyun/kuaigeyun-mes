import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备维护提醒页面
 *
 * 展示设备维护计划到期提醒，支持查看、标记已读、标记已处理等操作。
 *
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Badge, Tag, notification, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { CheckOutlined, EyeOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { maintenanceReminderApi } from '../../../services/equipment';
import { ProFormTextArea } from '@ant-design/pro-components';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { getMaintenanceReminderLifecycle } from '../../../utils/equipmentLifecycle';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaizhizao.maintenanceReminder';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MaintenanceReminder[]>([]);

  // 详情相关状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReminder, setCurrentReminder] = useState<MaintenanceReminder | null>(null);

  const [reminderTrackingRefreshKey, setReminderTrackingRefreshKey] = useState(0);

  const reminderTracking = useDocumentTracking(
    detailVisible && currentReminder?.id ? 'maintenance_reminder' : undefined,
    currentReminder?.id,
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
      if (detailVisible && currentReminder?.uuid === record.uuid) {
        setCurrentReminder((prev) => (prev ? { ...prev, is_read: true } : null));
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
    setCurrentReminder(record);
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
      if (!currentReminder?.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }

      const drawerUuid = currentReminder.uuid;
      const updated = (await maintenanceReminderApi.markAsHandled({
        reminder_uuid: currentReminder.uuid,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      })) as MaintenanceReminder;

      messageApi.success(t(`${P}.markHandledSuccess`));
      setHandleModalVisible(false);
      actionRef.current?.reload();
      fetchUnreadCount();
      if (detailVisible && updated?.uuid === drawerUuid) {
        setCurrentReminder(updated);
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
  const handleViewDetail = async (record: MaintenanceReminder) => {
    setCurrentReminder(record);
    setDetailVisible(true);
    setReminderTrackingRefreshKey((k) => k + 1);
  };

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
          title: t(`${P}.col.equipmentCode`),
          dataIndex: 'equipment_code',
          width: 120,
          fixed: 'left',
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
        },
        {
          title: t(`${P}.col.reminderType`),
          dataIndex: 'reminder_type',
          width: 120,
          render: (_, record) => getReminderTypeTag(record.reminder_type || ''),
        },
        {
          title: t(`${P}.col.plannedMaintenanceDate`),
          dataIndex: 'planned_maintenance_date',
          width: 150,
          render: (_, record) =>
            record.planned_maintenance_date
              ? formatDateTime(record.planned_maintenance_date, 'YYYY-MM-DD HH:mm')
              : '-',
        },
        {
          title: t(`${P}.col.daysUntilDue`),
          dataIndex: 'days_until_due',
          width: 100,
          render: (_, record) => renderDaysUntilDue(record.days_until_due || 0),
        },
        {
          title: t(`${P}.col.reminderMessage`),
          dataIndex: 'reminder_message',
          ellipsis: true,
          width: 200,
        },
        {
          title: t(`${P}.col.reminderDate`),
          dataIndex: 'reminder_date',
          width: 150,
          render: (_, record) =>
            record.reminder_date ? formatDateTime(record.reminder_date, 'YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
          title: t(`${P}.col.lifecycle`),
          dataIndex: 'lifecycle_stage',
          fixed: 'right',
          align: 'left',
          hideInSearch: true,
          render: (_, record) => (
            <ListUniLifecycleCell lifecycle={getMaintenanceReminderLifecycle(record as Record<string, unknown>, t)} />
          ),
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

  return (
    <ListPageTemplate
      toolbarExtra={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space>
            <span>{t(`${P}.title`)}</span>
            {unreadCount > 0 && (
              <Badge count={unreadCount} showZero>
                <span style={{ fontSize: 16 }}>{t(`${P}.unreadBadge`)}</span>
              </Badge>
            )}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleCheckMaintenancePlans}>
              {t(`${P}.manualCheck`)}
            </Button>
          </Space>
        </div>
      }
    >
      <UniTable<MaintenanceReminder>
        headerTitle={t(`${P}.title`)}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-reminders"
        actionRef={actionRef}
        request={async (params) => {
          const response = await maintenanceReminderApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            reminder_type: params.reminder_type,
            is_read: params.is_read,
            is_handled: params.is_handled,
            keyword: (params as any).keyword,
          });

          // 更新未读数量
          if (response.unread_count !== undefined) {
            setUnreadCount(response.unread_count);
          }

          return {
            data: response.items || [],
            success: true,
            total: response.total || 0,
          };
        }}
        columns={columns}
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
          <Button {...rowActionKind('update')}
            key="batch-read"
            disabled={selectedRows.length === 0}
            onClick={() => handleBatchMarkAsRead(selectedRows)}
          >
            {t(`${P}.batchMarkRead`, { count: selectedRows.length })}
          </Button>,
        ]}
        scroll={{ x: 1600 }}
      />

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailVisible}
        zIndex={reminderDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReminder(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={2}
        customContent={
          currentReminder ? (
            <>
              <DetailDrawerSection title={t(`${P}.section.basicInfo`)}>
                <Descriptions
                  column={2}
                  size="small"
                  items={buildDescriptionItemsFromColumns(currentReminder, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.lifecycle`)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getMaintenanceReminderLifecycle(currentReminder as Record<string, unknown>, t);
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
                      read: currentReminder.is_read ? t(`${P}.yes`) : t(`${P}.no`),
                      readAt: currentReminder.read_at
                        ? `（${formatDateTime(currentReminder.read_at, 'YYYY-MM-DD HH:mm:ss')}）`
                        : '',
                      handled: currentReminder.is_handled ? t(`${P}.yes`) : t(`${P}.no`),
                      handledAt: currentReminder.handled_at
                        ? `（${formatDateTime(currentReminder.handled_at, 'YYYY-MM-DD HH:mm:ss')}，${currentReminder.handled_by_name || '-'}）`
                        : '',
                    })}
                  </Typography.Text>
                  {currentReminder.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="maintenance_reminder"
                      documentId={currentReminder.id}
                      active={detailVisible}
                      selfDocumentId={currentReminder.id}
                      renderBriefActions={(doc) => (
                        <EquipmentTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailVisible(false);
                            setCurrentReminder(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.detailInfo`)}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noDetailLines`)} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.operationHistory`)}>
                {reminderTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {reminderTracking.error && !reminderTracking.loading && (
                  <Typography.Text type="danger">{reminderTracking.error}</Typography.Text>
                )}
                {reminderTracking.data && !reminderTracking.loading && (
                  <DocumentTrackingTimelineBody data={reminderTracking.data} />
                )}
                {!reminderTracking.loading && !reminderTracking.data && !reminderTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
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
    </ListPageTemplate>
  );
};

export default MaintenanceRemindersPage;
