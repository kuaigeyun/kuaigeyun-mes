/**
 * 详情抽屉区块组件
 *
 * 统一详情抽屉各区块（基本信息、生命周期、明细列表、操作历史）的标题与内容样式。
 *
 * Author: RiverEdge Team
 * Date: 2026-02-27
 */

import { ReactNode } from 'react';
import { Card } from 'antd';

export interface DetailDrawerSectionProps {
  /** 区块标题 */
  title: string;
  /** 区块内容 */
  children: ReactNode;
  /** 是否显示（默认 true） */
  visible?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 卡片底部间距（默认 16） */
  marginBottom?: number;
}

/**
 * 详情抽屉区块：统一标题 + 内容区样式
 */
export const DetailDrawerSection: React.FC<DetailDrawerSectionProps> = ({
  title,
  children,
  visible = true,
  style,
  marginBottom = 16,
}) => {
  if (!visible) return null;
  return (
    <Card
      title={title}
      size="small"
      style={{ marginBottom, ...style }}
      headStyle={{ background: 'var(--ant-color-fill-alter)', fontWeight: 600 }}
    >
      {children}
    </Card>
  );
};

export default DetailDrawerSection;
