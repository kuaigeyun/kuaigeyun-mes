/**
 * 详情抽屉标题区操作按钮
 *
 * 封装常用操作（编辑、提交、审核、下推等），供 DetailDrawerTemplate 的 extra 使用。
 *
 * Author: RiverEdge Team
 * Date: 2026-02-27
 */

import { ReactNode } from 'react';
import { Space } from 'antd';

export interface DetailDrawerActionItem {
  /** 按钮或自定义元素 */
  key: string;
  /** 是否显示 */
  visible?: boolean;
  /** 渲染内容 */
  render: (() => ReactNode) | ReactNode;
}

export interface DetailDrawerActionsProps {
  /** 操作项列表 */
  items: DetailDrawerActionItem[];
  /** 间距（默认 8） */
  size?: number;
}

/**
 * 详情抽屉操作按钮组：用于 extra 区域
 */
export const DetailDrawerActions: React.FC<DetailDrawerActionsProps> = ({
  items,
  size = 8,
}) => {
  const visibleItems = items.filter((item) => item.visible !== false);
  if (visibleItems.length === 0) return null;
  return (
    <Space size={size}>
      {visibleItems.map((item) => (
        <span key={item.key}>
          {typeof item.render === 'function' ? item.render() : item.render}
        </span>
      ))}
    </Space>
  );
};

export default DetailDrawerActions;
