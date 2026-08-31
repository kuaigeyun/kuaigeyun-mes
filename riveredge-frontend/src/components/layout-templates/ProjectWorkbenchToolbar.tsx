/**
 * 项目类工作台顶栏：返回 + 标题 + 状态徽章（左），操作按钮（右，简洁无图标）
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

export interface ProjectWorkbenchToolbarProps {
  backLabel: string;
  onBack: () => void;
  title: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ProjectWorkbenchToolbar({
  backLabel,
  onBack,
  title,
  status,
  actions,
}: ProjectWorkbenchToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
      }}
    >
      <Space wrap align="center">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          {backLabel}
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {status}
      </Space>
      {actions ? (
        <Space wrap align="center">
          {actions}
        </Space>
      ) : null}
    </div>
  );
}
