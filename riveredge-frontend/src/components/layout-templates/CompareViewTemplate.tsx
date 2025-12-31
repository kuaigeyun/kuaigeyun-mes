/**
 * 对比视图布局模板
 *
 * 提供统一的对比视图布局，用于重复物料对比、版本对比等场景
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Card, Table, theme, Button, Space, Tag } from 'antd';
import { PAGE_SPACING, ANT_DESIGN_TOKENS } from './constants';
import type { ColumnsType } from 'antd/es/table';

const { useToken } = theme;

/**
 * 对比项
 */
export interface CompareItem {
  /** 唯一标识 */
  key: string;
  /** 字段名 */
  field: string;
  /** 字段标签 */
  label: string;
  /** 左侧值 */
  leftValue: ReactNode;
  /** 右侧值 */
  rightValue: ReactNode;
  /** 是否相同 */
  isSame?: boolean;
  /** 置信度（高/中/低） */
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * 对比视图模板属性
 */
export interface CompareViewTemplateProps {
  /** 左侧标题 */
  leftTitle: string;
  /** 右侧标题 */
  rightTitle: string;
  /** 对比项列表 */
  items: CompareItem[];
  /** 左侧操作按钮 */
  leftActions?: ReactNode;
  /** 右侧操作按钮 */
  rightActions?: ReactNode;
  /** 合并操作回调 */
  onMerge?: () => void;
  /** 忽略操作回调 */
  onIgnore?: () => void;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 对比视图布局模板
 *
 * @example
 * ```tsx
 * <CompareViewTemplate
 *   leftTitle="物料A"
 *   rightTitle="物料B"
 *   items={[
 *     { field: 'name', label: '物料名称', leftValue: '产品A', rightValue: '产品A', isSame: true },
 *   ]}
 *   onMerge={handleMerge}
 * />
 * ```
 */
export const CompareViewTemplate: React.FC<CompareViewTemplateProps> = ({
  leftTitle,
  rightTitle,
  items,
  leftActions,
  rightActions,
  onMerge,
  onIgnore,
  className,
  style,
}) => {
  const { token } = useToken();

  const columns: ColumnsType<CompareItem> = [
    {
      title: '字段',
      dataIndex: 'label',
      key: 'label',
      width: 150,
      fixed: 'left',
    },
    {
      title: leftTitle,
      dataIndex: 'leftValue',
      key: 'leftValue',
      width: 300,
      render: (value, record) => (
        <div>
          {value}
          {record.confidence && (
            <Tag
              color={
                record.confidence === 'high'
                  ? 'success'
                  : record.confidence === 'medium'
                  ? 'warning'
                  : 'default'
              }
              style={{ marginLeft: ANT_DESIGN_TOKENS.SPACING.XS }}
            >
              {record.confidence === 'high'
                ? '高置信度'
                : record.confidence === 'medium'
                ? '中置信度'
                : '低置信度'}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: rightTitle,
      dataIndex: 'rightValue',
      key: 'rightValue',
      width: 300,
      render: (value, record) => (
        <div>
          {value}
          {record.isSame && (
            <Tag color="success" style={{ marginLeft: ANT_DESIGN_TOKENS.SPACING.XS }}>
              相同
            </Tag>
          )}
        </div>
      ),
    },
  ];

  return (
    <div
      className={className}
      style={{
        padding: `${PAGE_SPACING.PADDING}px`,
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
        <div>
          <h3 style={{ margin: 0 }}>对比结果</h3>
        </div>
        <Space>
          {leftActions}
          {rightActions}
          {onIgnore && (
            <Button onClick={onIgnore}>忽略</Button>
          )}
          {onMerge && (
            <Button type="primary" onClick={onMerge}>
              建立映射关系
            </Button>
          )}
        </Space>
      </div>

      {/* 对比表格 */}
      <Card>
        <Table<CompareItem>
          columns={columns}
          dataSource={items}
          rowKey="key"
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default CompareViewTemplate;

