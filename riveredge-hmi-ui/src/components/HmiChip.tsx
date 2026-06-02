import { HmiButton, type HmiButtonProps } from './HmiButton';

export type HmiChipProps = Omit<HmiButtonProps, 'hmiSize' | 'hmiVariant'> & {
  selected?: boolean;
};

/** 工序 / 选项切换触屏芯片 */
export function HmiChip({ selected, className, ...rest }: HmiChipProps) {
  return (
    <HmiButton
      hmiSize="chip"
      hmiVariant={selected ? 'primary' : 'default'}
      className={['hmi-chip', selected ? 'hmi-chip--selected' : undefined, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
