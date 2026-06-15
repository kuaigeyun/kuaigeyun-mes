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
import { App, Button, Space, message, Badge, Tag, Modal, notification, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { CheckOutlined, EyeOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { maintenanceReminderApi } from '../../../services/equipment';
import { ProFormTextArea } from '@ant-design/pro-components';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { getMaintenanceReminderLifecycle } from '../../../utils/equipmentLifecycle';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
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
          message: '维护提醒',
          description: `您有 ${data.unread_count} 条未读维护提醒`,
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
   * 获取提醒类型标签
   */
  const getReminderTypeTag = (type: string) => {
    if (type === 'overdue') {
      return <Tag color="red">已过期</Tag>;
    } else if (type === 'due_soon') {
      return <Tag color="orange">即将到期</Tag>;
    }
    return <Tag>{type}</Tag>;
  };

  /**
   * 处理标记为已读
   */
  const handleMarkAsRead = async (record: MaintenanceReminder) => {
    try {
      if (!record.uuid) {
        messageApi.error('提醒UUID不存在');
        return;
      }

      await maintenanceReminderApi.markAsRead({
        reminder_uuids: [record.uuid],
      });

      messageApi.success('已标记为已读');
      actionRef.current?.reload();
      fetchUnreadCount();
      if (detailVisible && currentReminder?.uuid === record.uuid) {
        setCurrentReminder((prev) => (prev ? { ...prev, is_read: true } : null));
        setReminderTrackingRefreshKey((k) => k + 1);
      }
    } catch (error: any) {
      messageApi.error(`标记已读失败: ${error.message || '未知错误'}`);
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
        messageApi.error('提醒UUID不存在');
        return;
      }

      const drawerUuid = currentReminder.uuid;
      const updated = (await maintenanceReminderApi.markAsHandled({
        reminder_uuid: currentReminder.uuid,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      })) as MaintenanceReminder;

      messageApi.success('已标记为已处理');
      setHandleModalVisible(false);
      actionRef.current?.reload();
      fetchUnreadCount();
      if (detailVisible && updated?.uuid === drawerUuid) {
        setCurrentReminder(updated);
        setReminderTrackingRefreshKey((k) => k + 1);
      }
    } catch (error: any) {
      messageApi.error(`标记已处理失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 批量标记为已读
   */
  const handleBatchMarkAsRead = async (selectedRows: MaintenanceReminder[]) => {
    try {
      const uuids = selectedRows.map((row) => row.uuid).filter(Boolean) as string[];
      if (uuids.length === 0) {
        messageApi.warning('请选择要标记的提醒');
        return;
      }

      await maintenanceReminderApi.markAsRead({
        reminder_uuids: uuids,
      });

      messageApi.success(`已标记 ${uuids.length} 条提醒为已读`);
      setSelectedRowKeys([]);
      setSelectedRows([]);
      actionRef.current?.reload();
      fetchUnreadCount();
    } catch (error: any) {
      messageApi.error(`批量标记已读失败: ${error.message || '未知错误'}`);
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

      messageApi.success(`检查完成，创建了 ${result.reminder_count || 0} 条提醒`);
      actionRef.current?.reload();
      fetchUnreadCount();
    } catch (error: any) {
      messageApi.error(`检查维护计划失败: ${error.message || '未知错误'}`);
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<MaintenanceReminder>[] = useMemo(
    () => [
      {
        title: '设备编号',
        dataIndex: 'equipment_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '设备名称', dataIndex: 'equipment_name' },
      {
        title: '提醒类型',
        dataIndex: 'reminder_type',
        render: (_, r) => getReminderTypeTag(r.reminder_type || ''),
      },
      {
        title: '计划维护日期',
        dataIndex: 'planned_maintenance_date',
        render: (_, r) =>
          r.planned_maintenance_date ? dayjs(r.planned_maintenance_date).format('YYYY-MM-DD HH:mm') : '-',
      },
      {
        title: '距离到期',
        dataIndex: 'days_until_due',
        render: (_, r) => {
          const days = r.days_until_due ?? 0;
          if (days < 0) return <Tag color="red">已过期 {Math.abs(days)} 天</Tag>;
          if (days === 0) return <Tag color="orange">今天到期</Tag>;
          return <Tag color="blue">{days} 天后</Tag>;
        },
      },
      { title: '提醒消息', dataIndex: 'reminder_message' },
      {
        title: '提醒时间',
        dataIndex: 'reminder_date',
        valueType: 'dateTime',
      },
    ],
    []
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaintenanceReminder>[] = [
    {
      title: '设备编号',
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
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 150,
    },
    {
      title: '提醒类型',
      dataIndex: 'reminder_type',
      width: 120,
      render: (_, record) => getReminderTypeTag(record.reminder_type || ''),
    },
    {
      title: '计划维护日期',
      dataIndex: 'planned_maintenance_date',
      width: 150,
      render: (_, record) =>
        record.planned_maintenance_date
          ? dayjs(record.planned_maintenance_date).format('YYYY-MM-DD HH:mm')
          : '-',
    },
    {
      title: '距离到期',
      dataIndex: 'days_until_due',
      width: 100,
      render: (_, record) => {
        const days = record.days_until_due || 0;
        if (days < 0) {
          return <Tag color="red">已过期 {Math.abs(days)} 天</Tag>;
        } else if (days === 0) {
          return <Tag color="orange">今天到期</Tag>;
        } else {
          return <Tag color="blue">{days} 天后</Tag>;
        }
      },
    },
    {
      title: '提醒消息',
      dataIndex: 'reminder_message',
      ellipsis: true,
      width: 200,
    },
    {
      title: '提醒时间',
      dataIndex: 'reminder_date',
      width: 150,
      render: (_, record) =>
        record.reminder_date ? dayjs(record.reminder_date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaintenanceReminderLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {!record.is_read && (
            <Button key="approve" {...rowActionKind('audit')}
              icon={<CheckOutlined />}
              onClick={() => handleMarkAsRead(record)}
            >
              标记已读
            </Button>
          )}
          {!record.is_handled && (
            <Button key="approve" {...rowActionKind('audit')}
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkAsHandled(record)}
            >
              标记已处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

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
            <span>设备维护提醒</span>
            {unreadCount > 0 && (
              <Badge count={unreadCount} showZero>
                <span style={{ fontSize: 16 }}>未读提醒</span>
              </Badge>
            )}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleCheckMaintenancePlans}>
              手动检查
            </Button>
          </Space>
        </div>
      }
    >
      <UniTable<MaintenanceReminder>
        headerTitle="设备维护提醒"
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
          searchText: '搜索',
          resetText: '重置',
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
            批量标记已读 ({selectedRows.length})
          </Button>,
        ]}
        scroll={{ x: 1600 }}
      />

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title="维护提醒详情"
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
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={2}
                  size="small"
                  items={buildDescriptionItemsFromColumns(currentReminder, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getMaintenanceReminderLifecycle(currentReminder as Record<string, unknown>);
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
                    已读/处理状态：已读 {currentReminder.is_read ? '是' : '否'}
                    {currentReminder.read_at ? `（${dayjs(currentReminder.read_at).format('YYYY-MM-DD HH:mm:ss')}）` : ''}
                    ；已处理 {currentReminder.is_handled ? '是' : '否'}
                    {currentReminder.handled_at
                      ? `（${dayjs(currentReminder.handled_at).format('YYYY-MM-DD HH:mm:ss')}，${currentReminder.handled_by_name || '-'}）`
                      : ''}
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
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="维护提醒无明细行" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 标记已处理Modal */}
      <FormModalTemplate
        title="标记为已处理"
        open={handleModalVisible}
        onClose={() => setHandleModalVisible(false)}
        formRef={handleFormRef}
        layout="vertical"
        onFinish={handleMarkAsHandledSubmit}
      >
        <DocumentAttachmentsField category="maintenance_reminder_attachments" />
        <ProFormTextArea
          name="remark"
          label="处理备注"
          placeholder="请输入处理备注（可选）"
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MaintenanceRemindersPage;
