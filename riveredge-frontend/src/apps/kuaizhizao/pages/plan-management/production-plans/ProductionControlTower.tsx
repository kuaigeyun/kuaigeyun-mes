import React from 'react';
import { Card, Row, Col, Progress, Table, Tag, Typography, Empty, Badge } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { RocketOutlined, AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../../../services/api';

const { Text } = Typography;

const ProductionControlTower: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, loading } = useRequest(async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary');
  }, {
    pollingInterval: 30000, // 每 30 秒轮询一次
  });

  if (!summary && loading) {
    return <Card loading />;
  }

  if (!summary) {
    return <Empty description="暂无管控数据" />;
  }

  const navigateToWorkOrder = (code: string) => {
    navigate(`/apps/kuaizhizao/production-execution/work-orders?code=${code}`);
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row gutter={[16, 16]}>
        {/* 核心指标 */}
        <Col span={24}>
          <StatisticCard.Group gutter={16}>
            <div 
              style={{ cursor: 'pointer', flex: 1 }} 
              onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
            >
              <StatisticCard
                statistic={{
                  title: '在制工单总数',
                  value: summary.total_wip_count,
                  icon: <RocketOutlined style={{ color: '#1890ff' }} />,
                }}
              />
            </div>
            <StatisticCard
              statistic={{
                title: '异常风险订单',
                value: summary.total_risk_count,
                icon: <AlertOutlined style={{ color: '#ff4d4f' }} />,
                status: summary.total_risk_count > 0 ? 'error' : 'success',
              }}
            />
            <StatisticCard
              statistic={{
                title: '平均齐套率',
                value: 
                  summary.material_readiness.length > 0 
                    ? Number((summary.material_readiness.reduce((acc: number, cur: any) => acc + cur.readiness_rate, 0) / summary.material_readiness.length).toFixed(1))
                    : 100,
                suffix: '%',
                icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
              }}
            />
          </StatisticCard.Group>
        </Col>

        {/* 齐套性分析表 */}
        <Col span={12}>
          <ProCard title="工单齐套性监控 (前10)" headerBordered style={{ height: '100%' }}>
            <Table
              size="small"
              dataSource={summary.material_readiness.slice(0, 10)}
              pagination={false}
              rowKey="work_order_id"
              columns={[
                { 
                  title: '工单', 
                  dataIndex: 'work_order_code', 
                  width: 120,
                  render: (text: string) => (
                    <a onClick={() => navigateToWorkOrder(text)}>{text}</a>
                  )
                },
                { title: '产品', dataIndex: 'product_name', ellipsis: true },
                { 
                  title: '齐套进度', 
                  dataIndex: 'readiness_rate', 
                  width: 140,
                  render: (val: number) => (
                    <Progress 
                        percent={val} 
                        size="small" 
                        status={val === 100 ? 'success' : val < 50 ? 'exception' : 'active'} 
                        strokeColor={val === 100 ? '#52c41a' : val >= 80 ? '#faad14' : '#ff4d4f'}
                    />
                  )
                },
                { 
                  title: '缺料', 
                  dataIndex: 'shortage_count', 
                  width: 60,
                  render: (count: number) => count > 0 ? <Tag color="error">{count} 种</Tag> : <Badge status="success" text="齐套" />
                }
              ]}
            />
          </ProCard>
        </Col>

        {/* 资源负荷热图 */}
        <Col span={12}>
          <ProCard title="工作中心负荷预警 (未来14天)" headerBordered style={{ height: '100%' }}>
            {summary.resource_load.map((wc: any) => (
              <div key={wc.work_center_id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong>{wc.work_center_name}</Text>
                  <Text type="secondary">{wc.load_hours} / {wc.capacity_hours} hrs ({wc.load_rate}%)</Text>
                </div>
                <Progress 
                  percent={Math.min(wc.load_rate, 100)} 
                  strokeColor={wc.load_rate > 90 ? '#ff4d4f' : wc.load_rate > 70 ? '#faad14' : '#52c41a'}
                  status={wc.load_rate > 100 ? 'exception' : 'normal'}
                />
              </div>
            ))}
            {summary.resource_load.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无负荷数据" />}
          </ProCard>
        </Col>

        {/* 交期风险订单 */}
        <Col span={24}>
          <ProCard title="交期风险追踪" headerBordered collapsible defaultCollapsed={false}>
            <Table
              size="small"
              dataSource={summary.delivery_risks}
              pagination={{ pageSize: 5 }}
              rowKey="work_order_id"
              columns={[
                { 
                  title: '风险类型', 
                  dataIndex: 'risk_type', 
                  width: 100,
                  render: (val: string) => <Tag color={val === 'delayed' ? 'volcano' : 'warning'}>{val === 'delayed' ? '实际延期' : '预计风险'}</Tag>
                },
                { 
                  title: '工单编码', 
                  dataIndex: 'work_order_code', 
                  width: 140,
                  render: (text: string) => (
                    <a onClick={() => navigateToWorkOrder(text)}>{text}</a>
                  )
                },
                { title: '产品', dataIndex: 'product_name' },
                { title: '计划结束', dataIndex: 'planned_end_date', width: 120 },
                { title: '异常说明', dataIndex: 'risk_desc', render: (text: string) => <Text type="danger">{text}</Text> }
              ]}
            />
          </ProCard>
        </Col>
      </Row>
    </div>
  );
};

export default ProductionControlTower;
