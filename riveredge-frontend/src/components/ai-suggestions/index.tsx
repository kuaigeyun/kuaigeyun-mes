/**
 * AI智能建议组件
 *
 * 提供AI智能建议的展示界面，支持侧边栏、悬浮窗、弹窗等形式。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, Empty, Spin, Drawer, FloatButton, Badge, message, theme } from 'antd';
import { BulbOutlined, CloseOutlined, RightOutlined, CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api';
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

  /**
   * 获取建议类型图标和颜色
   */
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

  /**
   * 获取优先级颜色
   */
  const getPriorityColor = (priority: string) => {
    const priorityMap: Record<string, string> = {
      low: 'default',
      medium: 'processing',
      high: 'warning',
      urgent: 'error',
    };
    return priorityMap[priority] || 'default';
  };

  /**
   * 加载建议
   */
  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (context) {
        params.context = JSON.stringify(context);
      }
      const response = await apiRequest(`/core/ai/suggestions/${scene}`, {
        method: 'GET',
        params,
      });
      setSuggestions(response.data || []);
    } catch (error: any) {
      message.error(error.message || '获取建议失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理操作点击
   */
  const handleActionClick = (action: string) => {
    if (onActionClick) {
      onActionClick(action);
    } else {
      // 默认行为：如果是URL，则跳转
      if (action.startsWith('/')) {
        window.location.href = action;
      }
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [scene, context]);

  // 如果没有建议，不显示
  if (suggestions.length === 0 && !loading) {
    return null;
  }

  // 悬浮按钮模式
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
              <span>AI智能建议</span>
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
          />
        </Drawer>
      </>
    );
  }

  // 内联模式
  if (displayMode === 'inline') {
    return (
      <Card
        title={
          <Space>
            <BulbOutlined />
            <span>AI智能建议</span>
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
        />
      </Card>
    );
  }

  // 默认返回空
  return null;
};

/**
 * 建议列表组件
 */
interface SuggestionsListProps {
  suggestions: Suggestion[];
  loading: boolean;
  onActionClick: (action: string) => void;
  getTypeInfo: (type: string) => { icon: React.ReactNode; color: string };
  getPriorityColor: (priority: string) => string;
  onRefresh: () => void;
}

const SuggestionsList: React.FC<SuggestionsListProps> = ({
  suggestions,
  loading,
  onActionClick,
  getTypeInfo,
  getPriorityColor,
  onRefresh,
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
                  <Tag color={priorityColor} size="small">
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

