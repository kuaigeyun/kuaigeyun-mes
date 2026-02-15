/**
 * 详情 Drawer 布局模板
 *
 * 提供统一的详情 Drawer 布局，使用 ProDescriptions 展示详情信息
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Drawer, theme } from 'antd';
import { ProDescriptions, ProDescriptionsItemType } from '@ant-design/pro-components';
import { DRAWER_CONFIG } from './constants';

const { useToken } = theme;

/**
 * 详情 Drawer 模板属性
 */
export interface DetailDrawerTemplateProps<T = any> {
  /** Drawer 标题 */
  title: string;
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 数据源 */
  dataSource?: T;
  /** ProDescriptions 列配置 */
  columns: ProDescriptionsItemType<T>[];
  /** Drawer 宽度（默认：标准宽度） */
  width?: number | string;
  /** 加载状态 */
  loading?: boolean;
  /** 列数（默认：2） */
  column?: number;
  /** 自定义内容（可选，如果提供则覆盖默认的 ProDescriptions） */
  customContent?: ReactNode;
  /** Drawer 头部额外内容（如操作按钮） */
  extra?: ReactNode;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 详情 Drawer 布局模板
 *
 * @example
 * ```tsx
 * <DetailDrawerTemplate
 *   title="客户详情"
 *   open={drawerVisible}
 *   onClose={() => setDrawerVisible(false)}
 *   dataSource={customerDetail}
 *   columns={[
 *     { title: '客户编码', dataIndex: 'code' },
 *     { title: '客户名称', dataIndex: 'name' },
 *   ]}
 * />
 * ```
 */
export const DetailDrawerTemplate = <T extends Record<string, any> = Record<string, any>>({
  title,
  open,
  onClose,
  dataSource,
  columns,
  width = DRAWER_CONFIG.STANDARD_WIDTH,
  loading = false,
  column = 2,
  customContent,
  extra,
  className,
}: DetailDrawerTemplateProps<T>) => {
  const { token } = useToken();

  // Ant Design 6: 使用 size 替代已废弃的 width
  // size='default' | 'large'；自定义宽度通过 styles.body 设置
  const isLarge = typeof width === 'number' ? width > 500 : false;
  const size: 'default' | 'large' = isLarge ? 'large' : 'default';
  const bodyStyle = typeof width === 'number' && width > 0
    ? { width: width, maxWidth: '100%' }
    : undefined;

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      size={size}
      styles={bodyStyle ? { body: bodyStyle } : undefined}
      loading={loading}
      className={className}
      extra={extra}
    >
      {customContent || (
        // ⚠️ 注意：ProDescriptions 组件会触发 Ant Design 的 contentStyle 弃用警告
        // 这是 ProComponents 库内部的问题，无法直接修复，需要等待库更新
        // 警告信息：[antd: Descriptions] `contentStyle` is deprecated. Please use `styles.content` instead.
        <ProDescriptions<T>
          dataSource={dataSource}
          column={column}
          columns={columns}
          // 此属性被传递给底层的 Descriptions 组件，用于替换被弃用的 contentStyle
          styles={{ content: {} }}
        />
      )}
    </Drawer>
  );
};

export default DetailDrawerTemplate;

