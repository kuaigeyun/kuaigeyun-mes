import React from 'react';
import { Alert, Progress, Space, Tabs, Typography } from 'antd';

interface UnscheduledOrderItem {
  work_order_id: number;
  work_order_code: string;
  reason: string;
}

interface ConflictItem {
  type?: string;
  work_order_code?: string;
  message?: string;
}

interface DailyLoadItem {
  day: string;
  hours: number;
  rate: number;
}

interface SchedulingDiagnosticsTabsProps {
  lastRunPayload: {
    statistics?: any;
    unscheduled_orders?: UnscheduledOrderItem[];
    conflicts?: ConflictItem[];
  } | null;
  dailyLoadPreview: DailyLoadItem[];
}

const SchedulingDiagnosticsTabs: React.FC<SchedulingDiagnosticsTabsProps> = ({ lastRunPayload, dailyLoadPreview }) => (
  <Tabs
    size="small"
    items={[
      {
        key: 'unscheduled',
        label: `本次未排工单（诊断）(${lastRunPayload?.unscheduled_orders?.length || 0})`,
        children: (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {(lastRunPayload?.unscheduled_orders || []).slice(0, 20).map((item) => (
              <Alert
                key={`${item.work_order_id}-${item.reason}`}
                type="warning"
                showIcon
                message={`${item.work_order_code}：${item.reason}`}
              />
            ))}
            {(!lastRunPayload?.unscheduled_orders || lastRunPayload.unscheduled_orders.length === 0) && (
              <Typography.Text type="secondary">本次排程无未排工单</Typography.Text>
            )}
          </Space>
        ),
      },
      {
        key: 'conflicts',
        label: `冲突清单 (${lastRunPayload?.conflicts?.length || 0})`,
        children: (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {(lastRunPayload?.conflicts || []).slice(0, 20).map((item, idx) => (
              <Alert
                key={`${item.work_order_code || 'unknown'}-${idx}`}
                type="error"
                showIcon
                message={`${item.type || 'conflict'}：${item.work_order_code || '-'} ${item.message || ''}`}
              />
            ))}
            {(!lastRunPayload?.conflicts || lastRunPayload.conflicts.length === 0) && (
              <Typography.Text type="secondary">暂无冲突记录</Typography.Text>
            )}
          </Space>
        ),
      },
      {
        key: 'resource-load',
        label: '资源负荷',
        children: (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {dailyLoadPreview.map((item) => (
              <div key={item.day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Typography.Text style={{ width: 56 }}>{item.day}</Typography.Text>
                <Progress
                  percent={item.rate}
                  size="small"
                  style={{ flex: 1, margin: 0 }}
                  strokeColor={item.rate >= 90 ? '#ff4d4f' : item.rate >= 70 ? '#faad14' : '#1677ff'}
                />
                <Typography.Text type="secondary" style={{ width: 70, textAlign: 'right' }}>
                  {item.hours}h
                </Typography.Text>
              </div>
            ))}
            {dailyLoadPreview.length === 0 && <Typography.Text type="secondary">暂无负荷数据</Typography.Text>}
          </Space>
        ),
      },
    ]}
  />
);

export default SchedulingDiagnosticsTabs;
