/**
 * 销售分析页面
 * 
 * 提供销售数据分析功能，包括销售趋势、业绩统计等。
 */

import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';

/**
 * 销售分析页面组件
 */
const AnalysisPage: React.FC = () => {
  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月销售额"
              value={0}
              prefix="¥"
              precision={2}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月订单数"
              value={0}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="线索转化率"
              value={0}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="商机转化率"
              value={0}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Card title="销售趋势分析">
        <div>销售趋势图表（待实现）</div>
      </Card>
    </div>
  );
};

export default AnalysisPage;
