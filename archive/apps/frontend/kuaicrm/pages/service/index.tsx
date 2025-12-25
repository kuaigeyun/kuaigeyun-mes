/**
 * 客户服务页面
 * 
 * 提供客户服务管理功能，包括服务工单、保修、投诉等。
 */

import React from 'react';
import { Card, Tabs } from 'antd';
import { FileTextOutlined, SafetyOutlined, WarningOutlined } from '@ant-design/icons';

/**
 * 客户服务页面组件
 */
const ServicePage: React.FC = () => {
  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <Card>
        <Tabs
          items={[
            {
              key: 'workorders',
              label: (
                <span>
                  <FileTextOutlined />
                  服务工单
                </span>
              ),
              children: <div>服务工单管理（待实现）</div>,
            },
            {
              key: 'warranties',
              label: (
                <span>
                  <SafetyOutlined />
                  保修管理
                </span>
              ),
              children: <div>保修管理（待实现）</div>,
            },
            {
              key: 'complaints',
              label: (
                <span>
                  <WarningOutlined />
                  投诉处理
                </span>
              ),
              children: <div>投诉处理（待实现）</div>,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ServicePage;
