/**
 * KU-AI 智能建议组件
 *
 * 提供智能建议的展示界面，支持侧边栏、悬浮窗、弹窗等形式。
 * 调用 KU-AI 应用 API：/apps/kuaiai/suggestions
 */

import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, Empty, Spin, Drawer, FloatButton, Badge, message, theme } from 'antd';
import { BulbOutlined, RightOutlined, CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getSuggestions } from '../../services/ai-suggestions';
import './index.less';

interface Suggestion {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  content: string;
  action?: string;
  action_label?: string;
  metadata?: any;
  created_at?: string;
}

interface AISuggestionsProps {
  scene: string;
  context?: any;
  displayMode?: 'drawer' | 'float' | 'inline';
  onActionClick?: (action: string) => void;
}

const { useToken } = theme;

const AISuggestions: React.FC<AISuggestionsProps> = ({
  scene,
  context,
  displayMode = 'float',
  onActionClick,
}) => {
  const { token } = useToken();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const getTypeInfo = (type: string) => {
    const typeMap: Record<string, { icon: React.ReactNode; color: string }> = {
      info: { icon: <InfoCircleOutlined />, color: 'blue' },
      warning: { icon: <WarningOutlined />, color: 'orange' },
      error: { icon: <ExclamationCircleOutlined />, color: 'red' },
      success: { icon: <CheckCircleOutlined />, color: 'green' },
      optimization: { icon: <BulbOutlined />, color: 'purple' },
    };
    return typeMap[type] || { icon: <InfoCircleOutlined />, color: 'default' };
  };

  const getPriorityColor = (priority: string) => {
    const priorityMap: Record<string, string> = {
      low: 'default',
      medium: 'processing',
      high: 'warning',
      urgent: 'error',
    };
    return priorityMap[priority] || 'default';
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await getSuggestions(scene, context);
      setSuggestions((response as any)?.data || []);
    } catch (error: any) {
      message.error(error.message || '获取建议失败');
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: string) => {
    if (onActionClick) {
      onActionClick(action);
    } else if (action.startsWith('/')) {
      window.location.href = action;
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [scene, context]);

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  if (displayMode === 'float') {
    return (
      <>
        <FloatButton
          icon={<BulbOutlined />}
          type="primary"
          style={{ right: 24, bottom: 24 }}
          badge={{ count: suggestions.length, overflowCount: 99 }}
          onClick={() => setDrawerVisible(true)}
        />
        <Drawer
          title={
            <Space>
              <BulbOutlined />
              <span>KU-AI 智能建议</span>
              <Badge count={suggestions.length} showZero />
            </Space>
          }
          placement="right"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          size={400}
        >
          <SuggestionsList
            suggestions={suggestions}
            loading={loading}
            onActionClick={handleActionClick}
            getTypeInfo={getTypeInfo}
            getPriorityColor={getPriorityColor}
            onRefresh={loadSuggestions}
            token={token}
          />
        </Drawer>
      </>
    );
  }

  if (displayMode === 'inline') {
    return (
      <Card
        title={
          <Space>
            <BulbOutlined />
            <span>KU-AI 智能建议</span>
            <Badge count={suggestions.length} showZero />
          </Space>
        }
        extra={
          <Button type="link" size="small" onClick={loadSuggestions}>
            刷新
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <SuggestionsList
          suggestions={suggestions}
          loading={loading}
          onActionClick={handleActionClick}
          getTypeInfo={getTypeInfo}
          getPriorityColor={getPriorityColor}
          onRefresh={loadSuggestions}
          token={token}
        />
      </Card>
    );
  }

  return null;
};

interface SuggestionsListProps {
  suggestions: Suggestion[];
  loading: boolean;
  onActionClick: (action: string) => void;
  getTypeInfo: (type: string) => { icon: React.ReactNode; color: string };
  getPriorityColor: (priority: string) => string;
  onRefresh: () => void;
  token: ReturnType<typeof theme.useToken>['token'];
}

const SuggestionsList: React.FC<SuggestionsListProps> = ({
  suggestions,
  loading,
  onActionClick,
  getTypeInfo,
  getPriorityColor,
  token,
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Empty
        description="暂无建议"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <List
      dataSource={suggestions}
      renderItem={(item) => {
        const typeInfo = getTypeInfo(item.type);
        const priorityColor = getPriorityColor(item.priority);
        return (
          <List.Item
            style={{
              padding: '12px 0',
              borderBottom: `1px solid ${token.colorBorder}`,
            }}
          >
            <List.Item.Meta
              avatar={
                <Tag color={typeInfo.color} icon={typeInfo.icon}>
                  {item.type === 'info' ? '提示' : item.type === 'warning' ? '警告' : item.type === 'error' ? '错误' : item.type === 'success' ? '成功' : '优化'}
                </Tag>
              }
              title={
                <Space>
                  <span>{item.title}</span>
                  <Tag color={priorityColor} style={{ fontSize: 12, marginInlineEnd: 0 }}>
                    {item.priority === 'low' ? '低' : item.priority === 'medium' ? '中' : item.priority === 'high' ? '高' : '紧急'}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>{item.content}</div>
                  {item.action && (
                    <Button
                      type="link"
                      size="small"
                      icon={<RightOutlined />}
                      onClick={() => onActionClick(item.action!)}
                    >
                      {item.action_label || '查看详情'}
                    </Button>
                  )}
                </div>
              }
            />
          </List.Item>
        );
      }}
    />
  );
};

export default AISuggestions;
