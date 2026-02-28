/**
 * 工装保养提醒页面
 *
 * 基于 next_maintenance_date、next_calibration_date 展示即将到期/已过期的工装保养、校准提醒。
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
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

  const columns: ProColumns<ToolMaintenanceReminder>[] = [
    { title: '工装编码', dataIndex: 'tool_code', width: 120 },
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
      title: '状态',
      dataIndex: 'due_type',
      width: 100,
      render: (_, r) => {
        const t = r.due_type;
        if (t === 'overdue') return <Tag color="red">已过期</Tag>;
        if (t === 'due_soon') return <Tag color="orange">即将到期</Tag>;
        return <Tag>{t || '-'}</Tag>;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ToolMaintenanceReminder>
        actionRef={actionRef}
        rowKey={(_, __, index) => `reminder-${index}`}
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listMaintenanceReminders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            due_type: params.due_type,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />
    </ListPageTemplate>
  );
};

export default ToolMaintenanceRemindersPage;
