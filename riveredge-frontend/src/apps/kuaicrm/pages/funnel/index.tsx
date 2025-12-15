/**
 * 销售漏斗页面
 * 
 * 展示销售漏斗视图，包括各阶段数据、转化率、销售预测等。
 */

import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Table, Tag, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { funnelApi } from '../../services/process';
import type { FunnelView, FunnelStage } from '../../types/process';

/**
 * 销售漏斗页面组件
 */
const FunnelPage: React.FC = () => {
  const [funnelData, setFunnelData] = useState<FunnelView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFunnelData();
  }, []);

  /**
   * 加载漏斗数据
   */
  const loadFunnelData = async () => {
    try {
      setLoading(true);
      const data = await funnelApi.getView();
      setFunnelData(data);
    } catch (error: any) {
      message.error(error.message || '加载漏斗数据失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '转化率',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      render: (rate: number) => `${rate?.toFixed(2) || 0}%`,
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总线索数"
              value={funnelData?.totalLeads || 0}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总商机数"
              value={funnelData?.totalOpportunities || 0}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总金额"
              value={funnelData?.totalAmount || 0}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均转化率"
              value={funnelData?.stages?.[0]?.conversionRate || 0}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Card title="销售漏斗详情" loading={loading}>
        <Table
          columns={columns}
          dataSource={funnelData?.stages || []}
          rowKey="stage"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default FunnelPage;
