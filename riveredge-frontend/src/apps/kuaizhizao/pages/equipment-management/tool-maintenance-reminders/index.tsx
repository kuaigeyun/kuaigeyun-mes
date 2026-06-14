/**
 * 工装保养提醒页面
 *
 * 基于 next_maintenance_date、next_calibration_date 展示即将到期/已过期的工装保养、校准提醒。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getDueReminderLifecycle } from '../../../utils/equipmentLifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface ToolMaintenanceReminder {
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  reminder_type?: string;
  due_type?: string;
  due_date?: string;
  days_until_due?: number;
}

const ToolMaintenanceRemindersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const columns: ProColumns<ToolMaintenanceReminder>[] = [
    {
      title: '工装编号',
      dataIndex: 'tool_code',
      width: 120,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
          {r.tool_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '工装名称', dataIndex: 'tool_name', width: 180, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'reminder_type',
      width: 90,
      render: (_, r) => (r.reminder_type === 'maintenance' ? '保养' : r.reminder_type === 'calibration' ? '校准' : r.reminder_type),
    },
    {
      title: '到期日期',
      dataIndex: 'due_date',
      width: 120,
      render: (_, r) => (r.due_date ? dayjs(r.due_date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '剩余天数',
      dataIndex: 'days_until_due',
      width: 100,
      align: 'right',
      render: (_, r) => {
        const v = r.days_until_due ?? 0;
        if (v < 0) return <Tag color="red">已过期 {Math.abs(v)} 天</Tag>;
        return <span>{v} 天</span>;
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getDueReminderLifecycle(record as Record<string, unknown>);
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
  ];

  return (
    <ListPageTemplate>
      <UniTable<ToolMaintenanceReminder>
        headerTitle="工装保养校准提醒"
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey={(record) =>
          [record.tool_uuid, record.tool_code, record.reminder_type, record.due_type, record.due_date]
            .filter(Boolean)
            .join(':') || 'reminder-unknown'
        }
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listMaintenanceReminders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            due_type: params.due_type,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1200 }}
      />
    </ListPageTemplate>
  );
};

export default ToolMaintenanceRemindersPage;
