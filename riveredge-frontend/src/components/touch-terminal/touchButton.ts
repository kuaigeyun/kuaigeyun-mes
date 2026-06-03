import type { ButtonProps } from 'antd';
import type { CSSProperties } from 'react';
import { HMI_DESIGN_TOKENS } from '../../theme/hmi/design';
import { HMI_TOUCH } from '../../theme/hmi/touch';

export type TouchButtonVariant = 'primary' | 'success' | 'default' | 'danger';
export type TouchButtonSize = 'primary' | 'action' | 'header' | 'chip';

const SIZE_STYLES: Record<TouchButtonSize, CSSProperties> = {
  primary: {
    minHeight: HMI_TOUCH.PRIMARY_BTN_HEIGHT,
    minWidth: HMI_TOUCH.PRIMARY_BTN_MIN_WIDTH,
    fontSize: HMI_TOUCH.ACTION_FONT_SIZE,
    fontWeight: 600,
    paddingInline: HMI_DESIGN_TOKENS.BUTTON_PADDING_PRIMARY,
  },
  action: {
    minHeight: HMI_TOUCH.ACTION_BTN_HEIGHT,
    minWidth: HMI_TOUCH.ACTION_BTN_MIN_WIDTH,
    fontSize: HMI_TOUCH.ACTION_FONT_SIZE,
    fontWeight: 500,
    paddingInline: HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY,
  },
  header: {
    minHeight: HMI_TOUCH.HEADER_BTN_HEIGHT,
    minWidth: HMI_TOUCH.HEADER_BTN_MIN_WIDTH,
    fontSize: 16,
    paddingInline: 16,
  },
  chip: {
    minHeight: HMI_TOUCH.OP_CHIP_HEIGHT,
    minWidth: 100,
    fontSize: 17,
    fontWeight: 500,
    paddingInline: 16,
  },
};

export type TouchButtonOptions = {
  variant?: TouchButtonVariant;
  size?: TouchButtonSize;
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  loading?: boolean;
};

/** 触屏 Button 的 type / className / style（与 antd Button 组合使用） */
export function touchButtonProps({
  variant = 'default',
  size = 'action',
  iconSize = 24,
  className,
  style,
  disabled,
  loading,
}: TouchButtonOptions = {}): Pick<ButtonProps, 'type' | 'danger' | 'className' | 'style'> {
  const isPrimary = variant === 'primary' || variant === 'success';
  const muted = disabled || loading;
  const variantStyle: CSSProperties =
    muted
      ? {}
      : variant === 'success'
        ? {
            background: HMI_DESIGN_TOKENS.STATUS_OK,
            borderColor: HMI_DESIGN_TOKENS.STATUS_OK,
            boxShadow: HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
          }
        : variant === 'primary'
          ? { boxShadow: HMI_DESIGN_TOKENS.BTN_PRIMARY_SHADOW }
          : {};

  return {
    type: isPrimary ? 'primary' : 'default',
    danger: variant === 'danger',
    className: ['hmi-btn', `hmi-btn--${variant}`, `hmi-btn--${size}`, className].filter(Boolean).join(' '),
    style: {
      borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
      ['--hmi-btn-icon-size' as string]: `${iconSize}px`,
      ...SIZE_STYLES[size],
      ...variantStyle,
      ...style,
    },
  };
}
