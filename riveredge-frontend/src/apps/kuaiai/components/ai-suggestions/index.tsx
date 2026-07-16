/**
 * KU-AI 智能建议组件
 *
 * 提供智能建议的展示界面，支持侧边栏、悬浮窗、弹窗等形式。
 * - 传入 suggestions：受控展示（业务侧本地提示，如物料防重）
 * - 未传 suggestions：调用 /apps/kuaiai/suggestions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, List, Tag, Button, Space, Empty, Spin, Drawer, FloatButton, Badge, message, theme } from 'antd';
import { BulbOutlined, RightOutlined, CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getSuggestions } from '../../services/ai-suggestions';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../components/layout-templates/constants';
import './index.less';

export interface SuggestionItem {
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
  scene?: string;
  context?: any;
  displayMode?: 'drawer' | 'float' | 'inline';
  onActionClick?: (action: string) => void;
  /** 受控建议列表；传入后不再请求 API */
  suggestions?: SuggestionItem[];
  /** 加载中（受控模式可用） */
  loading?: boolean;
  /** 浮层 zIndex（盖住业务 Modal） */
  zIndex?: number;
  /** 有新建议时是否自动打开抽屉 */
  autoOpen?: boolean;
  title?: string;
}

const { useToken } = theme;

const AISuggestions: React.FC<AISuggestionsProps> = ({
  scene,
  context,
  displayMode = 'float',
  onActionClick,
  suggestions: controlledSuggestions,
  loading: controlledLoading,
  zIndex,
  autoOpen = false,
  title = 'KU-AI 智能建议',
}) => {
  const { token } = useToken();
  const [fetchedSuggestions, setFetchedSuggestions] = useState<SuggestionItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const overlayZIndex = zIndex ?? token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const isControlled = controlledSuggestions !== undefined;
  const suggestions = isControlled ? controlledSuggestions : fetchedSuggestions;
  const loading = isControlled ? Boolean(controlledLoading) : fetchLoading;

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
    if (isControlled || !scene) return;
    setFetchLoading(true);
    try {
      const response = await getSuggestions(scene, context);
      setFetchedSuggestions((response as any)?.data || []);
    } catch (error: any) {
      message.error(error.message || '获取建议失败');
    } finally {
      setFetchLoading(false);
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
    if (!isControlled) {
      void loadSuggestions();
    }
  }, [scene, context, isControlled]);

  const suggestionKey = useMemo(
    () => suggestions.map((s) => s.id).join('|'),
    [suggestions],
  );

  useEffect(() => {
    if (autoOpen && suggestions.length > 0) {
      setDrawerVisible(true);
    }
    if (suggestions.length === 0) {
      setDrawerVisible(false);
    }
  }, [autoOpen, suggestionKey, suggestions.length]);

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  const list = (
    <SuggestionsList
      suggestions={suggestions}
      loading={loading}
      onActionClick={handleActionClick}
      getTypeInfo={getTypeInfo}
      getPriorityColor={getPriorityColor}
      onRefresh={isControlled ? () => undefined : loadSuggestions}
      token={token}
      showRefresh={!isControlled}
    />
  );

  if (displayMode === 'float') {
    return (
      <>
        <FloatButton
          icon={<BulbOutlined />}
          type="primary"
          style={{ right: 24, bottom: 24, zIndex: overlayZIndex }}
          badge={{ count: suggestions.length, overflowCount: 99 }}
          onClick={() => setDrawerVisible(true)}
        />
        <Drawer
          className="ai-suggestions-drawer"
          title={
            <Space>
              <BulbOutlined />
              <span>{title}</span>
              <Badge count={suggestions.length} showZero />
            </Space>
          }
          placement="right"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          size={400}
          zIndex={overlayZIndex}
          destroyOnHidden
        >
          {list}
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
            <span>{title}</span>
            <Badge count={suggestions.length} showZero />
          </Space>
        }
        extra={
          !isControlled ? (
            <Button type="link" size="small" onClick={() => void loadSuggestions()}>
              刷新
            </Button>
          ) : null
        }
        style={{ marginBottom: 16 }}
      >
        {list}
      </Card>
    );
  }

  return null;
};

interface SuggestionsListProps {
  suggestions: SuggestionItem[];
  loading: boolean;
  onActionClick: (action: string) => void;
  getTypeInfo: (type: string) => { icon: React.ReactNode; color: string };
  getPriorityColor: (priority: string) => string;
  onRefresh: () => void;
  token: ReturnType<typeof theme.useToken>['token'];
  showRefresh?: boolean;
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
      className="ai-suggestions-list"
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
