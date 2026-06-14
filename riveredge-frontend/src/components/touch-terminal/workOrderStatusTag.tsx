import { Tag } from 'antd';
import type { TagProps } from 'antd';
import { HMI_DESIGN_TOKENS, type HmiStatusKey } from '../../theme/hmi/design';

export type WorkOrderStatusTagProps = Omit<TagProps, 'color'> & {
  status?: HmiStatusKey | string;
};

export function WorkOrderStatusTag({ status = 'default', style, children, ...rest }: WorkOrderStatusTagProps) {
  const key = (status in HMI_DESIGN_TOKENS.STATUS_BADGE ? status : 'default') as HmiStatusKey;
  const badge = HMI_DESIGN_TOKENS.STATUS_BADGE[key];

  return (
    <Tag
      variant="filled"
      className="hmi-status-tag"
      style={{
        background: badge.bg,
        color: badge.color,
        fontSize: 15,
        padding: '4px 10px',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
