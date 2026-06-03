import type { CSSProperties, ReactNode } from 'react';
import { HMI_DESIGN_TOKENS } from '../../theme/hmi/design';

export type TouchListItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

/** 触屏工单列表项（antd List 样式由 hmi.css 统一） */
export function TouchListItem({ title, subtitle, selected, onClick, style }: TouchListItemProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={['hmi-list-item', selected ? 'hmi-list-item--selected' : undefined].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      style={{
        background: selected ? HMI_DESIGN_TOKENS.LIST_CARD_SELECTED_BG : HMI_DESIGN_TOKENS.LIST_CARD_BG,
        ...style,
      }}
    >
      <div className="hmi-list-item__title">{title}</div>
      {subtitle ? <div className="hmi-list-item__subtitle">{subtitle}</div> : null}
    </div>
  );
}
