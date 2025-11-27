/**
 * 插件占位页面
 * 
 * 用于预览插件菜单效果，显示当前路由路径和菜单信息
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { useLocation } from 'react-router-dom';
import { Card, Typography, Tag, Space } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * 插件占位页面组件
 */
export default function PluginPlaceholderPage() {
  const location = useLocation();
  const pathname = location.pathname;

  // 从路径中提取模块信息
  const pathParts = pathname.split('/').filter(Boolean);
  const moduleName = pathParts[0] || '未知模块';
  const subModule = pathParts[1] || '';
  const page = pathParts[2] || '';

  return (
    <PageContainer
      title={`${moduleName.toUpperCase()} - ${subModule || '首页'}`}
      subTitle="插件占位页面（用于预览菜单效果）"
      breadcrumb={false}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="middle">
            <Title level={4}>
              <ExperimentOutlined /> 当前页面信息
            </Title>
            <div>
              <Text strong>路由路径：</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{pathname}</Tag>
            </div>
            <div>
              <Text strong>模块名称：</Text>
              <Tag color="green" style={{ marginLeft: 8 }}>{moduleName}</Tag>
            </div>
            {subModule && (
              <div>
                <Text strong>子模块：</Text>
                <Tag color="orange" style={{ marginLeft: 8 }}>{subModule}</Tag>
              </div>
            )}
            {page && (
              <div>
                <Text strong>页面：</Text>
                <Tag color="purple" style={{ marginLeft: 8 }}>{page}</Tag>
              </div>
            )}
          </Space>
        </Card>

        <Card>
          <Title level={4}>说明</Title>
          <Paragraph>
            这是一个插件占位页面，用于预览插件菜单的显示效果。
            当插件系统正式实现后，这些页面将被实际的插件页面替换。
          </Paragraph>
          <Paragraph>
            <Text strong>当前功能：</Text>
            <ul>
              <li>显示当前路由路径信息</li>
              <li>展示菜单层级结构</li>
              <li>验证菜单导航功能</li>
            </ul>
          </Paragraph>
        </Card>
      </Space>
    </PageContainer>
  );
}

