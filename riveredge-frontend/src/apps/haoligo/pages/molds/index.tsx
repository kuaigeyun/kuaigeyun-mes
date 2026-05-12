import React, { useCallback, useEffect, useState } from 'react';
import { App, Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listMolds, type MoldRow } from '../../services/haoligo';

const { Paragraph } = Typography;

const statusColors: Record<string, string> = {
  在用: 'green',
  在修: 'orange',
  停用: 'default',
  待用: 'blue',
  报废: 'red',
};

const MoldsPage: React.FC = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState<MoldRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMolds({ limit: 100 });
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

  const columns: ColumnsType<MoldRow> = [
    { title: '模具编码', dataIndex: 'mold_code', width: 140 },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    { title: '总制造数量', dataIndex: 'total_manufacture_qty', width: 120 },
    { title: '外协厂商', dataIndex: 'outsource_vendor_name', ellipsis: true, width: 160 },
  ];

  return (
    <Card loading={loading} title="模具主数据">
      <Paragraph type="secondary">
        模具台账与移动单据 API 将按实施迭代；当前列表对接 <Typography.Text code>/molds</Typography.Text>。
      </Paragraph>
      <Table<MoldRow> rowKey="id" columns={columns} dataSource={rows} pagination={{ total, pageSize: 100, showTotal: (t) => `共 ${t} 条` }} />
    </Card>
  );
};

export default MoldsPage;
