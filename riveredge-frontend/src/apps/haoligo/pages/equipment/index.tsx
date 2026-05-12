import React, { useCallback, useEffect, useState } from 'react';
import { App, Card, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchHaoligoMeta, listEquipments, listWorkshops, type EquipmentRow, type HaoligoMeta, type WorkshopRow } from '../../services/haoligo';

const { Text, Paragraph } = Typography;

const EquipmentPage: React.FC = () => {
  const { message } = App.useApp();
  const [meta, setMeta] = useState<HaoligoMeta | null>(null);
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [totalEq, setTotalEq] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, ws, eq] = await Promise.all([
        fetchHaoligoMeta(),
        listWorkshops(),
        listEquipments({ limit: 100 }),
      ]);
      setMeta(m);
      setWorkshops(ws);
      setEquipments(eq.items);
      setTotalEq(eq.total);
    } catch (e) {
      message.error((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const wsColumns: ColumnsType<WorkshopRow> = [
    { title: '代号', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name' },
  ];

  const eqColumns: ColumnsType<EquipmentRow> = [
    { title: '设备代号', dataIndex: 'asset_code', width: 120 },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: '类别ID', dataIndex: 'category_id', width: 88 },
    { title: '车间ID', dataIndex: 'workshop_id', width: 88 },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading} title="设备主数据">
        {meta && (
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            API 前缀：<Text code>{meta.api_prefix}</Text> · 数据表前缀 <Text code>haoligo_*</Text>，与快制造设备模块隔离。
          </Paragraph>
        )}
        <Text strong>车间（{workshops.length}）</Text>
        <Table<WorkshopRow>
          style={{ marginTop: 8 }}
          size="small"
          rowKey="id"
          columns={wsColumns}
          dataSource={workshops}
          pagination={false}
        />
        <Text strong style={{ display: 'block', marginTop: 20 }}>
          设备台账（本页 {equipments.length} / 共 {totalEq}）
        </Text>
        <Table<EquipmentRow>
          style={{ marginTop: 8 }}
          size="small"
          rowKey="id"
          columns={eqColumns}
          dataSource={equipments}
          pagination={false}
        />
      </Card>
    </Space>
  );
};

export default EquipmentPage;
