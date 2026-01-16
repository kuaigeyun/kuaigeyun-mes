/**
 * 设备维护提醒页面
 *
 * 展示设备维护计划到期提醒，支持查看、标记已读、标记已处理等操作。
 *
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, message, Badge, Tag, Modal, notification } from 'antd';
import { CheckOutlined, EyeOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { maintenanceReminderApi } from '../../../services/equipment';
import { ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';

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
  const { message: messageApi, notification: notificationApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MaintenanceReminder[]>([]);

  // 详情相关状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReminder, setCurrentReminder] = useState<MaintenanceReminder | null>(null);

  // 处理Modal
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const handleFormRef = useRef<any>(null);

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

      await maintenanceReminderApi.markAsHandled({
        reminder_uuid: currentReminder.uuid,
        remark: values.remark,
      });

      messageApi.success('已标记为已处理');
      setHandleModalVisible(false);
      actionRef.current?.reload();
      fetchUnreadCount();
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

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaintenanceReminder>[] = [
    {
      title: '设备编码',
      dataIndex: 'equipment_code',
      width: 120,
      fixed: 'left',
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
      title: '已读状态',
      dataIndex: 'is_read',
      width: 100,
      render: (_, record) => (
        <Badge
          status={record.is_read ? 'success' : 'error'}
          text={record.is_read ? '已读' : '未读'}
        />
      ),
    },
    {
      title: '处理状态',
      dataIndex: 'is_handled',
      width: 100,
      render: (_, record) => (
        <Badge
          status={record.is_handled ? 'success' : 'default'}
          text={record.is_handled ? '已处理' : '未处理'}
        />
      ),
    },
    {
      title: '提醒时间',
      dataIndex: 'reminder_date',
      width: 150,
      render: (_, record) =>
        record.reminder_date ? dayjs(record.reminder_date).format('YYYY-MM-DD HH:mm:ss') : '-',
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
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {!record.is_read && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleMarkAsRead(record)}
            >
              标记已读
            </Button>
          )}
          {!record.is_handled && (
            <Button
              type="link"
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
      title={
        <Space>
          <span>设备维护提醒</span>
          {unreadCount > 0 && (
            <Badge count={unreadCount} showZero>
              <span style={{ fontSize: 16 }}>未读提醒</span>
            </Badge>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleCheckMaintenancePlans}>
            手动检查
          </Button>
        </Space>
      }
    >
      <UniTable<MaintenanceReminder>
        actionRef={actionRef}
        request={async (params) => {
          const response = await maintenanceReminderApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            reminder_type: params.reminder_type,
            is_read: params.is_read,
            is_handled: params.is_handled,
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
          <Button
            key="batch-read"
            disabled={selectedRows.length === 0}
            onClick={() => handleBatchMarkAsRead(selectedRows)}
          >
            批量标记已读 ({selectedRows.length})
          </Button>,
        ]}
        scroll={{ x: 1400 }}
      />

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title="维护提醒详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={DRAWER_CONFIG.large}
      >
        {currentReminder && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>设备信息：</strong>
              <div style={{ marginTop: 8 }}>
                <p>设备编码：{currentReminder.equipment_code}</p>
                <p>设备名称：{currentReminder.equipment_name}</p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>提醒信息：</strong>
              <div style={{ marginTop: 8 }}>
                <p>提醒类型：{getReminderTypeTag(currentReminder.reminder_type || '')}</p>
                <p>计划维护日期：{currentReminder.planned_maintenance_date ? dayjs(currentReminder.planned_maintenance_date).format('YYYY-MM-DD HH:mm') : '-'}</p>
                <p>
                  距离到期：
                  {currentReminder.days_until_due !== undefined && currentReminder.days_until_due < 0
                    ? `已过期 ${Math.abs(currentReminder.days_until_due)} 天`
                    : currentReminder.days_until_due === 0
                    ? '今天到期'
                    : `${currentReminder.days_until_due} 天后`}
                </p>
                <p>提醒消息：{currentReminder.reminder_message}</p>
                <p>提醒时间：{currentReminder.reminder_date ? dayjs(currentReminder.reminder_date).format('YYYY-MM-DD HH:mm:ss') : '-'}</p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>状态信息：</strong>
              <div style={{ marginTop: 8 }}>
                <p>
                  已读状态：
                  <Badge
                    status={currentReminder.is_read ? 'success' : 'error'}
                    text={currentReminder.is_read ? '已读' : '未读'}
                    style={{ marginLeft: 8 }}
                  />
                  {currentReminder.read_at && `（${dayjs(currentReminder.read_at).format('YYYY-MM-DD HH:mm:ss')}）`}
                </p>
                <p>
                  处理状态：
                  <Badge
                    status={currentReminder.is_handled ? 'success' : 'default'}
                    text={currentReminder.is_handled ? '已处理' : '未处理'}
                    style={{ marginLeft: 8 }}
                  />
                  {currentReminder.handled_at && `（${dayjs(currentReminder.handled_at).format('YYYY-MM-DD HH:mm:ss')}，处理人：${currentReminder.handled_by_name || '-'}）`}
                </p>
              </div>
            </div>
          </div>
        )}
      </DetailDrawerTemplate>

      {/* 标记已处理Modal */}
      <FormModalTemplate
        title="标记为已处理"
        open={handleModalVisible}
        onCancel={() => setHandleModalVisible(false)}
        setFormRef={(ref: any) => { handleFormRef.current = ref; }}
        onFinish={handleMarkAsHandledSubmit}
        formProps={{
          layout: 'vertical',
        }}
      >
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
