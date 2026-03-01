/**
 * 详情 Drawer 布局模板
 *
 * 提供统一的详情 Drawer 布局，使用 ProDescriptions 展示详情信息
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import { ReactNode } from 'react';
import { Drawer, Descriptions } from 'antd';
import { ProDescriptionsItemProps } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { DRAWER_CONFIG } from './constants';

/**
 * 详情 Drawer 模板属性
 */
export interface DetailDrawerTemplateProps<T = any> {
  /** Drawer 标题 */
  title: string;
  /** 是否显示 */
  open?: boolean;
  /** 是否显示 (兼容旧版本) */
  visible?: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 数据源 */
  dataSource?: T;
  /** ProDescriptions 列配置 */
  columns?: ProDescriptionsItemProps<T>[];
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
  /** Drawer 底部额外内容（如操作按钮或其他组件） */
  children?: ReactNode;
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
  visible,
  onClose,
  dataSource,
  columns = [],
  width = DRAWER_CONFIG.HALF_WIDTH,
  loading = false,
  column = 2,
  customContent,
  extra,
  className,
  children,
}: DetailDrawerTemplateProps<T>) => {

  return (
    <Drawer
      title={title}
      open={open ?? visible}
      onClose={onClose}
      width={width}
      loading={loading}
      className={className}
      extra={extra}
    >
      {customContent || (columns && columns.length > 0 && (
        <Descriptions
          column={column}
          items={columns.map((col: any, index) => {
            const value = dataSource ? (col.dataIndex ? (dataSource as any)[col.dataIndex as string] : undefined) : undefined;
            
            let content: ReactNode = value;
            
            
            // 处理 valueType
            if (col.valueType === 'dateTime' && value) {
              content = dayjs(value).format('YYYY-MM-DD HH:mm:ss');
            } else if (col.valueType === 'date' && value) {
              content = dayjs(value).format('YYYY-MM-DD');
            } else if (col.valueEnum && value) {
              const enumItem = col.valueEnum[value as string];
              content = enumItem?.text || enumItem || value;
            }

            // 处理 render（dataSource 为 null 时不调用，避免 render 内访问 entity 属性报错）
            if (col.render && dataSource != null) {
              // ProDescriptions render signature: (dom, entity, index, action, schema)
              // 这里简化处理，传入 content 作为 dom，dataSource 作为 entity
              // 注意：ProDescriptions 的 render 第一个参数 is dom (即已经格式化过的值)，第二个 is entity
              content = col.render(content, dataSource, index, {}, col);
            }

            return {
              key: col.key || col.dataIndex || index,
              label: col.title,
              children: content !== undefined && content !== null ? content : '-',
              span: col.span || 1,
            };
          })}
        />
      ))}
      {children}
    </Drawer>
  );
};

export default DetailDrawerTemplate;

