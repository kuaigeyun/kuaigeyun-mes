import type { InputProps } from 'antd';
import { Input } from 'antd';
import { HMI_TOUCH } from '../tokens/touch';

export type HmiInputProps = InputProps & {
  /** 数量录入等大号输入 */
  qty?: boolean;
};

export function HmiInput({ qty, className, style, ...rest }: HmiInputProps) {
  return (
    <Input
      size="large"
      className={['hmi-input', qty ? 'hmi-input--qty' : undefined, className].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    />
  );
}

export const HMI_INPUT_QTY_STYLE = {
  minHeight: HMI_TOUCH.INPUT_HEIGHT,
  fontSize: HMI_TOUCH.INPUT_FONT_SIZE,
  fontWeight: 600,
  textAlign: 'center' as const,
};
