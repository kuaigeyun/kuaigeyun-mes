import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import { touchButtonProps } from './touchButton';

export type TouchChipProps = Omit<ButtonProps, 'size'> & {
  selected?: boolean;
};

/** 工序 / 选项切换触屏芯片 */
export function TouchChip({ selected, className, ...rest }: TouchChipProps) {
  const chipClass = ['hmi-chip', selected ? 'hmi-chip--selected' : undefined, className]
    .filter(Boolean)
    .join(' ');
  return (
    <Button
      size="large"
      {...touchButtonProps({
        size: 'chip',
        variant: selected ? 'primary' : 'default',
        className: chipClass,
      })}
      {...rest}
    />
  );
}
