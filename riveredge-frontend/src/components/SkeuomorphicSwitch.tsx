/**
 * 拟物化开关组件
 *
 * 物理开关风格：圆角底座 + 滑块，带阴影与高光
 * 开：右/绿；关：左/灰
 */

import React from 'react';

export interface SkeuomorphicSwitchProps {
  /** 是否开启 */
  checked?: boolean;
  /** 变更回调 */
  onChange?: (checked: boolean) => void;
  /** 禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'small' | 'default' | 'large';
  /** 附加 class */
  className?: string;
}

const sizeMap = {
  small: { width: 40, height: 22, knob: 18 },
  default: { width: 52, height: 28, knob: 24 },
  large: { width: 64, height: 34, knob: 30 },
};

const SkeuomorphicSwitch: React.FC<SkeuomorphicSwitchProps> = ({
  checked = false,
  onChange,
  disabled = false,
  size = 'default',
  className = '',
}) => {
  const { width, height, knob } = sizeMap[size];
  const padding = (height - knob) / 2;

  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? undefined : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onChange?.(!checked);
        }
      }}
      className={className}
      style={{
        width,
        height,
        borderRadius: height / 2,
        padding,
        background: checked
          ? 'linear-gradient(180deg, #52c41a 0%, #389e0d 100%)'
          : 'linear-gradient(180deg, #d9d9d9 0%, #bfbfbf 100%)',
        boxShadow: disabled
          ? 'none'
          : checked
            ? 'inset 0 1px 2px rgba(0,0,0,0.15), 0 2px 4px rgba(82,196,26,0.2)'
            : 'inset 0 1px 2px rgba(0,0,0,0.1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s, box-shadow 0.2s',
        position: 'relative',
        outline: 'none',
        border: '1px solid ' + (checked ? 'rgba(56,158,13,0.5)' : 'rgba(0,0,0,0.08)'),
      }}
    >
      <div
        style={{
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)',
          boxShadow:
            '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.9)',
          position: 'absolute',
          left: checked ? width - knob - padding : padding,
          top: padding,
          transition: 'left 0.2s ease-out',
        }}
      />
    </div>
  );
};

export default SkeuomorphicSwitch;
