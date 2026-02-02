/**
 * 计算结果显示布局模板
 *
 * 提供统一的计算结果显示布局，用于MRP/LRP运算结果展示
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Card, Tabs, theme, Collapse, Typography, Tag, Space } from 'antd';
import { PAGE_SPACING, ANT_DESIGN_TOKENS } from './constants';

const { useToken } = theme;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 计算说明项
 */
export interface CalculationExplanation {
  /** 标题 */
  title: string;
  /** 内容 */
  content: ReactNode;
  /** 使用的参数 */
  usedParameters?: string[];
  /** 计算逻辑 */
  calculationLogic?: string;
  /** 参数影响分析 */
  parameterImpact?: Array<{
    parameter: string;
    impact: string;
    value: string;
  }>;
}

/**
 * 计算结果模板属性
 */
export interface CalculationResultTemplateProps {
  /** 结果标题 */
  title: string;
  /** 主要结果内容 */
  mainContent: ReactNode;
  /** 计算说明 */
  explanation?: CalculationExplanation;
  /** 标签页内容（工单建议、采购建议等） */
  tabs?: Array<{
    key: string;
    label: string;
    content: ReactNode;
  }>;
  /** 操作按钮 */
  actions?: ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 计算结果显示布局模板
 *
 * @example
 * ```tsx
 * <CalculationResultTemplate
 *   title="MRP运算结果"
 *   mainContent={<MRPResultSummary />}
 *   explanation={{
 *     title: '计算说明',
 *     content: '基于以下参数计算...',
 *     usedParameters: ['当前库存', '安全库存'],
 *   }}
 *   tabs={[
 *     { key: 'workOrders', label: '工单建议', content: <WorkOrderSuggestions /> },
 *     { key: 'purchases', label: '采购建议', content: <PurchaseSuggestions /> },
 *   ]}
 * />
 * ```
 */
export const CalculationResultTemplate: React.FC<CalculationResultTemplateProps> = ({
  title,
  mainContent,
  explanation,
  tabs = [],
  actions,
  className,
  style,
}) => {
  const { token } = useToken();

  return (
    <div
      className={className}
      style={{
        padding: `0 ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px`,
        ...style,
      }}
    >
      {/* 标题和操作按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: PAGE_SPACING.BLOCK_GAP,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {actions && <Space>{actions}</Space>}
      </div>

      {/* 主要结果内容 */}
      <Card style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
        {mainContent}
      </Card>

      {/* 计算说明 */}
      {explanation && (
        <Card
          title={explanation.title}
          style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}
        >
          <Collapse ghost>
            <Panel header="查看计算说明" key="explanation">
              <div style={{ marginBottom: ANT_DESIGN_TOKENS.SPACING.MD }}>
                <Paragraph>{explanation.content}</Paragraph>
              </div>

              {explanation.usedParameters && explanation.usedParameters.length > 0 && (
                <div style={{ marginBottom: ANT_DESIGN_TOKENS.SPACING.MD }}>
                  <Text strong>使用的参数：</Text>
                  <div style={{ marginTop: ANT_DESIGN_TOKENS.SPACING.SM }}>
                    <Space wrap>
                      {explanation.usedParameters.map((param, index) => (
                        <Tag key={index} color="blue">
                          {param}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              )}

              {explanation.calculationLogic && (
                <div style={{ marginBottom: ANT_DESIGN_TOKENS.SPACING.MD }}>
                  <Text strong>计算逻辑：</Text>
                  <Paragraph code style={{ marginTop: ANT_DESIGN_TOKENS.SPACING.SM }}>
                    {explanation.calculationLogic}
                  </Paragraph>
                </div>
              )}

              {explanation.parameterImpact && explanation.parameterImpact.length > 0 && (
                <div>
                  <Text strong>参数影响分析：</Text>
                  <div style={{ marginTop: ANT_DESIGN_TOKENS.SPACING.SM }}>
                    {explanation.parameterImpact.map((impact, index) => (
                      <div
                        key={index}
                        style={{
                          padding: ANT_DESIGN_TOKENS.SPACING.SM,
                          backgroundColor: token.colorFillAlter,
                          borderRadius: ANT_DESIGN_TOKENS.BORDER_RADIUS.BASE,
                          marginBottom: ANT_DESIGN_TOKENS.SPACING.XS,
                        }}
                      >
                        <Text strong>{impact.parameter}：</Text>
                        <Text>{impact.impact}</Text>
                        <Tag color="blue" style={{ marginLeft: ANT_DESIGN_TOKENS.SPACING.XS }}>
                          {impact.value}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </Collapse>
        </Card>
      )}

      {/* 标签页内容 */}
      {tabs.length > 0 && (
        <Card>
          <Tabs
            items={tabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              children: tab.content,
            }))}
          />
        </Card>
      )}
    </div>
  );
};

export default CalculationResultTemplate;

