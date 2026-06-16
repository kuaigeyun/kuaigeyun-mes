import React from 'react';
import './spin-ring-indicator.less';

/** 全局 Spin 圆环指示器（替代 antd 默认四点旋转） */
const SpinRingIndicator: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className,
  style,
  ...rest
}) => (
  <span
    className={['river-spin-ring', className].filter(Boolean).join(' ')}
    style={style}
    aria-hidden
    {...rest}
  />
);

export default SpinRingIndicator;
