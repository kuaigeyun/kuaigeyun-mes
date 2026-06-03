import type { InputProps } from 'antd';
import { HMI_TOUCH } from '../../theme/hmi/touch';

export const TOUCH_INPUT_QTY_STYLE = {
  minHeight: HMI_TOUCH.INPUT_HEIGHT,
  fontSize: HMI_TOUCH.INPUT_FONT_SIZE,
  fontWeight: 600,
  textAlign: 'center' as const,
};

export function touchQtyInputProps(className?: string): Pick<InputProps, 'size' | 'className'> {
  return {
    size: 'large',
    className: ['hmi-input', 'hmi-input--qty', className].filter(Boolean).join(' '),
  };
}
