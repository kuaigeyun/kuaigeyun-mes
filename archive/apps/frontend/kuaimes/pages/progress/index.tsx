/**
 * 生产进度页面
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Typography } from 'antd';

const { Title } = Typography;

/**
 * 生产进度页面组件
 */
const ProgressPage: React.FC = () => {
  return (
    <PageContainer
      title="生产进度"
      breadcrumb={{}}
    >
      <Card>
        <Title level={4}>生产进度跟踪</Title>
        <p>生产进度跟踪功能开发中...</p>
      </Card>
    </PageContainer>
  );
};

export default ProgressPage;

