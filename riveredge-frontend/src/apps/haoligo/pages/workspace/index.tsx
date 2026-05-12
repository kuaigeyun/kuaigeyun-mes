import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, Row, Space, Spin, Statistic, Typography } from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  fetchHaoligoMeta,
  listEquipments,
  listHazardReports,
  listMolds,
  listWorkshops,
  type HaoligoMeta,
} from '../../services/haoligo';

const { Title, Paragraph, Text } = Typography;

/**
 * 好力 GO 整体工作台：汇总设备 / 模具 / 巡查关键数量与快捷入口。
 */
const WorkspacePage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<HaoligoMeta | null>(null);
  const [workshopCount, setWorkshopCount] = useState(0);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [moldTotal, setMoldTotal] = useState(0);
  const [hazardChecking, setHazardChecking] = useState(0);
  const [hazardRepairing, setHazardRepairing] = useState(0);
  const [hazardDone, setHazardDone] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, ws, eq, mo, h1, h2, h3] = await Promise.all([
        fetchHaoligoMeta(),
        listWorkshops(),
        listEquipments({ limit: 1 }),
        listMolds({ limit: 1 }),
        listHazardReports({ status: '检查中', limit: 1 }),
        listHazardReports({ status: '维修中', limit: 1 }),
        listHazardReports({ status: '已完成', limit: 1 }),
      ]);
      setMeta(m);
      setWorkshopCount(ws.length);
      setEquipmentTotal(eq.total);
      setMoldTotal(mo.total);
      setHazardChecking(h1.total);
      setHazardRepairing(h2.total);
      setHazardDone(h3.total);
    } catch (e) {
      message.error((e as Error).message || '工作台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="加载工作台…" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          工作台
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {meta?.display_name ?? '好力 GO'}：设备、模具、现场巡查统一入口。业务 API：
          <Text code>{meta?.api_prefix ?? '/api/v1/apps/haoligo'}</Text>
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
            <Statistic title="车间数" value={workshopCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
            <Statistic title="设备台账" value={equipmentTotal} suffix="台" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
            <Statistic title="模具档案" value={moldTotal} suffix="套" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
            <Statistic title="隐患单（检查中 / 维修中 / 已完成）" value={hazardChecking + hazardRepairing + hazardDone} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hazardChecking} / {hazardRepairing} / {hazardDone}
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title="快捷入口" size="small">
        <Space wrap size="middle">
          <Button type="primary" icon={<ToolOutlined />} onClick={() => navigate('/apps/haoligo/equipment')}>
            设备
            <ArrowRightOutlined />
          </Button>
          <Button icon={<AppstoreOutlined />} onClick={() => navigate('/apps/haoligo/molds')}>
            模具
            <ArrowRightOutlined />
          </Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/apps/haoligo/patrol')}>
            巡查
            <ArrowRightOutlined />
          </Button>
        </Space>
      </Card>
    </Space>
  );
};

export default WorkspacePage;
