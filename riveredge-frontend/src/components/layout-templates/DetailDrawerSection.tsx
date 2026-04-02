/**
 * 详情抽屉区块组件
 *
 * 统一详情抽屉各区块（基本信息、生命周期、明细列表、操作历史）的标题与内容样式。
 *
 * Author: RiverEdge Team
 * Date: 2026-02-27
 */

import type { ReactNode } from 'react';
import { Card, theme } from 'antd';

export interface DetailDrawerSectionProps {
  /** 区块标题（可为字符串或自定义节点，如标题 + 辅助说明） */
  title: ReactNode;
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
  const { token } = theme.useToken();
  if (!visible) return null;
  return (
    <Card
      title={title}
      size="small"
      variant="outlined"
      style={{ marginBottom, ...style }}
      styles={{
        root: { borderColor: token.colorBorder },
        header: {
          background: token.colorFillAlter,
          fontWeight: 600,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
    >
      {children}
    </Card>
  );
};

export default DetailDrawerSection;
