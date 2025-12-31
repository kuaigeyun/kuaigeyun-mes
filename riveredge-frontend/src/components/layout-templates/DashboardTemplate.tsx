/**
 * 工作台布局模板
 *
 * 提供统一的工作台首页布局，包括快捷操作、待办事项、数据看板、快捷入口
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Row, Col, Card, Button, Badge, theme, Space } from 'antd';
import { DASHBOARD_CONFIG, PAGE_SPACING, ANT_DESIGN_TOKENS } from './constants';

const { useToken } = theme;

/**
 * 快捷操作项
 */
export interface QuickAction {
  /** 标题 */
  title: string;
  /** 图标 */
  icon?: ReactNode;
  /** 点击事件 */
  onClick: () => void;
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 待办事项项
 */
export interface TodoItem {
  /** 标题 */
  title: string;
  /** 数量 */
  count: number;
  /** 点击事件 */
  onClick: () => void;
  /** 类型（用于颜色区分） */
  type?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * 数据看板项
 */
export interface DashboardStat {
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string;
  /** 前缀（如图标） */
  prefix?: ReactNode;
  /** 后缀（如单位） */
  suffix?: string;
  /** 数值样式颜色 */
  valueStyle?: React.CSSProperties;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 快捷入口项
 */
export interface QuickEntry {
  /** 标题 */
  title: string;
  /** 图标 */
  icon: ReactNode;
  /** 路径或点击事件 */
  path?: string;
  onClick?: () => void;
}

/**
 * 工作台模板属性
 */
export interface DashboardTemplateProps {
  /** 快捷操作列表 */
  quickActions?: QuickAction[];
  /** 待办事项列表 */
  todos?: TodoItem[];
  /** 数据看板列表 */
  stats?: DashboardStat[];
  /** 快捷入口列表 */
  quickEntries?: QuickEntry[];
  /** 自定义内容 */
  children?: ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 工作台布局模板
 *
 * @example
 * ```tsx
 * <DashboardTemplate
 *   quickActions={[
 *     { title: '一键报工', icon: <PlayCircleOutlined />, onClick: handleReport },
 *   ]}
 *   todos={[
 *     { title: '待下达工单', count: 5, onClick: handlePendingOrders },
 *   ]}
 *   stats={[
 *     { title: '今日生产', value: 100, suffix: '件' },
 *   ]}
 * />
 * ```
 */
export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({
  quickActions = [],
  todos = [],
  stats = [],
  quickEntries = [],
  children,
  className,
  style,
}) => {
  const { token } = useToken();

  return (
    <div
      className={className}
      style={{
        padding: `${PAGE_SPACING.PADDING}px`,
        backgroundColor: token.colorBgLayout,
        minHeight: '100%',
        ...style,
      }}
    >
      {/* 快捷操作区 */}
      {quickActions.length > 0 && (
        <Card
          title="快捷操作"
          style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}
        >
          <Row gutter={ANT_DESIGN_TOKENS.SPACING.MD}>
            {quickActions.map((action, index) => (
              <Col
                key={index}
                xs={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.xs * 12}
                sm={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.sm * 12}
                md={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.md * 6}
                lg={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.lg * 6}
                xl={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.xl * 6}
                xxl={DASHBOARD_CONFIG.QUICK_ACTION_COLUMNS.xxl * 6}
              >
                <Button
                  type={action.type || 'primary'}
                  icon={action.icon}
                  block
                  size="large"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  style={{ height: 'auto', padding: `${ANT_DESIGN_TOKENS.SPACING.MD}px` }}
                >
                  {action.title}
                </Button>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Row gutter={ANT_DESIGN_TOKENS.SPACING.MD}>
        {/* 左侧：待办事项 + 数据看板 */}
        <Col xs={24} lg={16}>
          {/* 待办事项区 */}
          {todos.length > 0 && (
            <Card
              title="待办事项"
              style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}
            >
              <Row gutter={ANT_DESIGN_TOKENS.SPACING.MD}>
                {todos.map((todo, index) => (
                  <Col
                    key={index}
                    xs={DASHBOARD_CONFIG.TODO_COLUMNS.xs * 24}
                    sm={DASHBOARD_CONFIG.TODO_COLUMNS.sm * 24}
                    md={DASHBOARD_CONFIG.TODO_COLUMNS.md * 12}
                    lg={DASHBOARD_CONFIG.TODO_COLUMNS.lg * 12}
                    xl={DASHBOARD_CONFIG.TODO_COLUMNS.xl * 12}
                    xxl={DASHBOARD_CONFIG.TODO_COLUMNS.xxl * 12}
                  >
                    <Card
                      hoverable
                      onClick={todo.onClick}
                      style={{ cursor: 'pointer' }}
                    >
                      <Space>
                        <Badge
                          count={todo.count}
                          showZero
                          style={{
                            backgroundColor: token.colorPrimary,
                          }}
                        />
                        <span>{todo.title}</span>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* 数据看板区 */}
          {stats.length > 0 && (
            <Card title="数据看板">
              <Row gutter={ANT_DESIGN_TOKENS.SPACING.MD}>
                {stats.map((stat, index) => (
                  <Col
                    key={index}
                    xs={DASHBOARD_CONFIG.STAT_COLUMNS.xs * 24}
                    sm={DASHBOARD_CONFIG.STAT_COLUMNS.sm * 12}
                    md={DASHBOARD_CONFIG.STAT_COLUMNS.md * 12}
                    lg={DASHBOARD_CONFIG.STAT_COLUMNS.lg * 8}
                    xl={DASHBOARD_CONFIG.STAT_COLUMNS.xl * 8}
                    xxl={DASHBOARD_CONFIG.STAT_COLUMNS.xxl * 8}
                  >
                    <Card
                      hoverable={!!stat.onClick}
                      onClick={stat.onClick}
                      style={{
                        cursor: stat.onClick ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: ANT_DESIGN_TOKENS.FONT_SIZE.XXL,
                            fontWeight: 600,
                            color: stat.valueStyle?.color || token.colorPrimary,
                            marginBottom: ANT_DESIGN_TOKENS.SPACING.XS,
                          }}
                        >
                          {stat.prefix}
                          {stat.value}
                          {stat.suffix && (
                            <span style={{ fontSize: ANT_DESIGN_TOKENS.FONT_SIZE.MD }}>
                              {stat.suffix}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: ANT_DESIGN_TOKENS.FONT_SIZE.SM,
                            color: token.colorTextSecondary,
                          }}
                        >
                          {stat.title}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}
        </Col>

        {/* 右侧：快捷入口 */}
        <Col xs={24} lg={8}>
          {quickEntries.length > 0 && (
            <Card title="快捷入口">
              <Row gutter={ANT_DESIGN_TOKENS.SPACING.MD}>
                {quickEntries.map((entry, index) => (
                  <Col
                    key={index}
                    xs={12}
                    sm={8}
                    md={8}
                    lg={12}
                    xl={12}
                    xxl={12}
                  >
                    <Card
                      hoverable
                      onClick={entry.onClick}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: ANT_DESIGN_TOKENS.SPACING.MD,
                      }}
                    >
                      <div style={{ fontSize: ANT_DESIGN_TOKENS.FONT_SIZE.XXL, marginBottom: ANT_DESIGN_TOKENS.SPACING.SM }}>
                        {entry.icon}
                      </div>
                      <div style={{ fontSize: ANT_DESIGN_TOKENS.FONT_SIZE.SM }}>
                        {entry.title}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}
        </Col>
      </Row>

      {/* 自定义内容 */}
      {children && (
        <div style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default DashboardTemplate;

