import React from 'react';
import { Card, Row, Col, Progress, Table, Typography, Tag, Spin } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard } from '@ant-design/pro-components';
import { 
  ToolOutlined, 
  CalendarOutlined, 
  DashboardOutlined,
  SettingOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  BuildOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mesDashboardService } from '../../../services/dashboard';
import { equipmentFaultApi, maintenancePlanApi } from '../../../services/equipment';

const { Text } = Typography;

const EquipmentDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // 1. 获取汇总数据
  const { data: summary, loading: summaryLoading } = useRequest(mesDashboardService.getEquipmentSummary);
  
  // 2. 获取最近故障报修
  const { data: recentFaultsResult, loading: faultsLoading } = useRequest(async () => {
    const res = await equipmentFaultApi.list({ limit: 6 });
    return Array.isArray(res) ? res : (res?.items || []);
  });
  
  // 3. 获取最近保养记录
  const { data: recentMaintenanceResult, loading: maintenanceLoading } = useRequest(async () => {
    // 假设 list 返回的是执行记录，或者我们可以展示计划
    const res = await maintenancePlanApi.list({ limit: 6 });
    return Array.isArray(res) ? res : (res?.items || []);
  });

  const recentFaults = recentFaultsResult || [];
  const recentMaintenance = recentMaintenanceResult || [];
  const s = summary as any;

  /** 与其他看板统一的 KPI 卡片样式 */
  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '16px 24px',
    color: '#fff',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  };

  const kpiSideBlock = (lines: { label: string; value: React.ReactNode }[]) => (
    <div
      style={{
        flexShrink: 0,
        paddingLeft: 18,
        marginLeft: 8,
        borderLeft: '1px solid rgba(255, 255, 255, 0.28)',
        minWidth: 82,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {lines.map((line) => (
        <div key={String(line.label)}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.25 }}>{line.label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>{line.value}</div>
        </div>
      ))}
    </div>
  );

  const shortcuts = [
    {
      title: '设备台账',
      icon: <BuildOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/equipment-management/list',
    },
    {
      title: '保养计划',
      icon: <CalendarOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/equipment-management/maintenance',
    },
    {
      title: '故障报修',
      icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/equipment-management/faults',
    },
    {
      title: '备品备件',
      icon: <SettingOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/equipment-management/spare-parts',
    },
  ];

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={summaryLoading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/equipment-management/faults?status=维修中')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <ToolOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>报修/故障中</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.faulty_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        {s?.faulty_count > 0 ? `当前有 ${s.faulty_count} 台设备停机待修` : '全厂设备运行状态良好'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '设备总计', value: s?.total_count ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/equipment-management/list')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
                    boxShadow: '0 4px 12px rgba(250, 173, 20, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>需校验/计量</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.calibration_needed ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        含已逾期或本月需校验设备
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '逾期校验', value: <span style={{ color: s?.calibration_needed > 0 ? '#fff' : 'rgba(255,255,255,0.7)' }}>{s?.calibration_needed ?? 0}</span> },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <DashboardOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>综合效率 OEE</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.average_oee ?? 0}%
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={s?.average_oee ?? 0}
                          showInfo={false}
                          strokeColor="#fff"
                          railColor="rgba(255, 255, 255, 0.2)"
                          size={6}
                        />
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '稼动率', value: '88.2%' },
                      { label: '故障率', value: '1.5%' },
                    ])}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷功能 */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              {shortcuts.map((sc) => (
                <Col xs={12} sm={12} md={6} key={sc.path}>
                  <Card
                    hoverable
                    onClick={() => navigate(sc.path)}
                    styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
                    style={{ borderRadius: 10 }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sc.icon}
                    </div>
                    <Text strong style={{ fontSize: 14 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 业务表格 */}
          <Col xs={24} lg={12}>
            <ProCard
              title="最近故障报修"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/equipment-management/faults')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={faultsLoading}
                dataSource={recentFaults}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '报修单号',
                    dataIndex: 'fault_no',
                    render: (text, record: any) => <a onClick={() => navigate(`/apps/kuaizhizao/equipment-management/faults/${record.uuid}`)}>{text}</a>
                  },
                  { title: '设备', dataIndex: 'equipment_name', ellipsis: true },
                  {
                    title: '当前状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status) => {
                      let color = 'default';
                      const s = String(status).toLowerCase();
                      if (s.includes('repair') || s.includes('维修')) color = 'processing';
                      if (s.includes('fixed') || s.includes('已') || s.includes('完成')) color = 'success';
                      if (s.includes('fault') || s.includes('故障')) color = 'error';
                      return <Tag color={color}>{status}</Tag>;
                    }
                  },
                ]}
              />
            </ProCard>
          </Col>

          <Col xs={24} lg={12}>
            <ProCard
              title="保养执行动态"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/equipment-management/maintenance')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={maintenanceLoading}
                dataSource={recentMaintenance}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '维护名称',
                    dataIndex: 'name',
                    ellipsis: true,
                    render: (text, record: any) => <a onClick={() => navigate(`/apps/kuaizhizao/equipment-management/maintenance/${record.uuid}`)}>{text}</a>
                  },
                  { title: '执行周期', dataIndex: 'period_type', width: 80, render: (t) => <Tag>{t === 'daily' ? '日' : t === 'weekly' ? '周' : '月'}</Tag> },
                  {
                    title: '下次计划',
                    dataIndex: 'next_execution_date',
                    width: 110,
                    align: 'right',
                    render: (t) => <Text type="secondary" style={{ fontSize: 12 }}>{t || '—'}</Text>
                  },
                ]}
              />
            </ProCard>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default EquipmentDashboard;
