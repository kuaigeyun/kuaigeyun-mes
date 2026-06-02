import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import type { CSSProperties } from 'react';
import { HMI_DESIGN_TOKENS } from '../layout-templates/constants';
import { HMI_TOUCH } from '../layout-templates/constants';

export type HmiButtonVariant = 'primary' | 'success' | 'default' | 'danger';
export type HmiButtonSize = 'primary' | 'action' | 'header' | 'chip';

const SIZE_STYLES: Record<HmiButtonSize, CSSProperties> = {
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

export type HmiButtonProps = Omit<ButtonProps, 'size'> & {
  hmiVariant?: HmiButtonVariant;
  hmiSize?: HmiButtonSize;
  /** 图标字号（px），默认 24；主操作用 28 */
  iconSize?: number;
};

export function HmiButton({
  hmiVariant = 'default',
  hmiSize = 'action',
  iconSize = 24,
  className,
  style,
  icon,
  disabled,
  loading,
  ...rest
}: HmiButtonProps) {
  const isAntPrimary = hmiVariant === 'primary' || hmiVariant === 'success';
  const isDanger = hmiVariant === 'danger';
  const muted = disabled || loading;

  const variantStyle: CSSProperties =
    muted
      ? {}
      : hmiVariant === 'success'
        ? {
            background: HMI_DESIGN_TOKENS.STATUS_OK,
            borderColor: HMI_DESIGN_TOKENS.STATUS_OK,
            boxShadow: HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
          }
        : hmiVariant === 'primary'
          ? { boxShadow: HMI_DESIGN_TOKENS.BTN_PRIMARY_SHADOW }
          : {};

  return (
    <Button
      type={isAntPrimary ? 'primary' : 'default'}
      danger={isDanger}
      size="large"
      icon={icon}
      className={['hmi-btn', `hmi-btn--${hmiVariant}`, `hmi-btn--${hmiSize}`, className]
        .filter(Boolean)
        .join(' ')}
      style={{
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
        ['--hmi-btn-icon-size' as string]: `${iconSize}px`,
        ...SIZE_STYLES[hmiSize],
        ...variantStyle,
        ...style,
      }}
      disabled={disabled}
      loading={loading}
      {...rest}
    />
  );
}
