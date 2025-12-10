/**
 * 工单列表页面
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Typography } from 'antd';

const { Title } = Typography;

/**
 * 工单列表页面组件
 */
const WorkOrderListPage: React.FC = () => {
  return (
    <PageContainer
      title="工单管理"
      breadcrumb={{}}
    >
      <Card>
        <Title level={4}>工单管理</Title>
        <p>工单列表功能开发中...</p>
      </Card>
    </PageContainer>
  );
};

export default WorkOrderListPage;

