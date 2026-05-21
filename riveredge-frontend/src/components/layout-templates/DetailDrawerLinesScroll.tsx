/**
 * uni-detail 明细区横滚容器（与报价单详情抽屉一致）
 */

import type { CSSProperties, ReactNode } from 'react';
import './detailDrawerLinesScroll.css';

export interface DetailDrawerLinesScrollProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  minWidth?: number | string;
}

export const DetailDrawerLinesScroll: React.FC<DetailDrawerLinesScrollProps> = ({
  children,
  className,
  style,
  minWidth,
}) => (
  <div
    className={['uni-detail-lines-scroll', className].filter(Boolean).join(' ')}
    style={{ ...(minWidth != null ? { minWidth } : undefined), ...style }}
  >
    {children}
  </div>
);

export default DetailDrawerLinesScroll;
