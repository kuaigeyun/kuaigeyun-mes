import React, { useCallback, useEffect, useState } from 'react';
import { App, Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listHazardReports, type HazardRow } from '../../services/haoligo';

const { Paragraph } = Typography;

const statusColors: Record<string, string> = {
  检查中: 'processing',
  维修中: 'warning',
  已完成: 'success',
};

const PatrolPage: React.FC = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState<HazardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHazardReports({ limit: 100 });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      message.error((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<HazardRow> = [
    { title: '区域', dataIndex: 'workshop_area', width: 120, ellipsis: true },
    { title: '问题类型', dataIndex: 'issue_type_code', width: 110 },
    { title: '问题描述', dataIndex: 'problem_summary', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    { title: '反馈时间', dataIndex: 'reported_at', width: 180 },
  ];

  return (
    <Card loading={loading} title="现场巡查 · 检查隐患单">
      <Paragraph type="secondary">
        表单字段与统计看板按 PLAN 场景 C 扩展；当前对接 <Typography.Text code>/patrol/hazard-reports</Typography.Text>。
      </Paragraph>
      <Table<HazardRow> rowKey="id" columns={columns} dataSource={rows} pagination={{ total, pageSize: 100, showTotal: (t) => `共 ${t} 条` }} />
    </Card>
  );
};

export default PatrolPage;
