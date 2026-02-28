/**
 * 模具保养提醒页面
 *
 * 基于使用次数（maintenance_interval）展示即将到期/已过期的模具保养提醒。
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';

interface MoldMaintenanceReminder {
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  total_usage_count?: number;
  maintenance_interval?: number;
  next_maintenance_at_count?: number;
  usages_until_due?: number;
  reminder_type?: string;
}

const MoldMaintenanceRemindersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<MoldMaintenanceReminder>[] = [
    { title: '模具编码', dataIndex: 'mold_code', width: 120 },
    { title: '模具名称', dataIndex: 'mold_name', width: 180, ellipsis: true },
    { title: '当前使用次数', dataIndex: 'total_usage_count', width: 120, align: 'right' },
    { title: '保养间隔', dataIndex: 'maintenance_interval', width: 100, align: 'right' },
    { title: '下次保养次数', dataIndex: 'next_maintenance_at_count', width: 120, align: 'right' },
    {
      title: '剩余次数',
      dataIndex: 'usages_until_due',
      width: 100,
      align: 'right',
      render: (_, r) => {
        const v = r.usages_until_due ?? 0;
        if (v < 0) return <Tag color="red">已过期 {Math.abs(v)} 次</Tag>;
        return <span>{v}</span>;
      },
    },
    {
      title: '状态',
      dataIndex: 'reminder_type',
      width: 100,
      render: (_, r) => {
        const t = r.reminder_type;
        if (t === 'overdue') return <Tag color="red">已过期</Tag>;
        if (t === 'due_soon') return <Tag color="orange">即将到期</Tag>;
        return <Tag>{t || '-'}</Tag>;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldMaintenanceReminder>
        actionRef={actionRef}
        rowKey="mold_uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listMaintenanceReminders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            reminder_type: params.reminder_type,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />
    </ListPageTemplate>
  );
};

export default MoldMaintenanceRemindersPage;
