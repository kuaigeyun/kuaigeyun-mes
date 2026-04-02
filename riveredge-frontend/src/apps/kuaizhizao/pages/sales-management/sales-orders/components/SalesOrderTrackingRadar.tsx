import React, { useEffect, useState } from 'react';
import { Card, Progress, Row, Col, Typography, Spin, Tag } from 'antd';
import { RocketOutlined, ToolOutlined, TruckOutlined } from '@ant-design/icons';
import { getSalesOrderTracking, SalesOrderTrackingResponse } from '../../../../services/sales-order';

const { Title, Text } = Typography;

interface SalesOrderTrackingRadarProps {
  salesOrderId: number;
}

export const SalesOrderTrackingRadar: React.FC<SalesOrderTrackingRadarProps> = ({ salesOrderId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SalesOrderTrackingResponse | null>(null);

  useEffect(() => {
    if (salesOrderId) {
      loadData();
    }
  }, [salesOrderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getSalesOrderTracking(salesOrderId);
      setData(res);
    } catch (e) {
      console.error('Failed to load tracking data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const renderProgressCard = (title: string, percent: number, icon: React.ReactNode, color: string, details: React.ReactNode) => (
    <Card 
      size="small" 
      headStyle={{ borderBottom: 'none', paddingBottom: 0 }}
      bodyStyle={{ paddingTop: 8 }}
      style={{ height: '100%', borderRadius: 8, border: `1px solid ${color}40`, background: `linear-gradient(to bottom right, ${color}05, ${color}15)` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ backgroundColor: color, color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          {icon}
        </div>
        <Title level={5} style={{ margin: 0 }}>{title}</Title>
      </div>
      <Progress 
        percent={percent} 
        strokeColor={{ '0%': `${color}80`, '100%': color }}
        status={percent === 100 ? 'success' : 'active'}
        strokeWidth={10}
      />
      <div style={{ marginTop: 16 }}>
        {details}
      </div>
    </Card>
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={8}>
          {renderProgressCard(
            '备料与采购', 
            data.material_prep_progress, 
            <RocketOutlined />, 
            '#1890ff',
            data.material_shortages.length > 0 ? (
              <div>
                <Text type="danger" strong style={{ fontSize: 13 }}>发现物料缺口</Text>
                <div style={{ maxHeight: 100, overflowY: 'auto', marginTop: 8 }}>
                  {data.material_shortages.map(item => (
                    <div key={item.material_code} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <Text ellipsis style={{ maxWidth: 120 }} title={item.material_name}>{item.material_name}</Text>
                      <Text type="danger">缺 {item.shortage_quantity}</Text>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>所有物料已齐套或无需备料。</Text>
            )
          )}
      </Col>
      <Col span={8}>
          {renderProgressCard(
            '生产进度', 
            data.production_progress, 
            <ToolOutlined />, 
            '#fa8c16',
            data.work_orders.length > 0 ? (
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {data.work_orders.map(wo => (
                  <div key={wo.work_order_id} style={{ fontSize: 12, marginBottom: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>{wo.work_order_code}</Text>
                      <Tag color="orange" style={{ margin: 0 }}>{wo.status}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                      <span>计划: {wo.quantity}</span>
                      <span>已完工: <Text type="success">{wo.completed_quantity}</Text></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>暂未下推工单。</Text>
            )
          )}
      </Col>
      <Col span={8}>
          {renderProgressCard(
            '发货与交付', 
            data.delivery_progress, 
            <TruckOutlined />, 
            '#52c41a',
            data.deliveries.length > 0 ? (
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {data.deliveries.map(del => (
                  <div key={del.delivery_id} style={{ fontSize: 12, marginBottom: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>{del.delivery_code}</Text>
                      <Tag color="green" style={{ margin: 0 }}>{del.status}</Tag>
                    </div>
                    <div>发货日期: {del.delivery_date ?? '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>暂无发货记录。</Text>
            )
          )}
      </Col>
    </Row>
  );
};
