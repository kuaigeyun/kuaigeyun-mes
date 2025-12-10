/**
 * 生产订单列表页面
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Typography } from 'antd';

const { Title } = Typography;

/**
 * 生产订单列表页面组件
 */
const OrderListPage: React.FC = () => {
  return (
    <PageContainer
      title="生产订单"
      breadcrumb={{}}
    >
      <Card>
        <Title level={4}>生产订单管理</Title>
        <p>生产订单列表功能开发中...</p>
      </Card>
    </PageContainer>
  );
};

export default OrderListPage;

