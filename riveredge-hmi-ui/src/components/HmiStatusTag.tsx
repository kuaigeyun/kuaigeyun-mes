import { Tag } from 'antd';
import type { TagProps } from 'antd';
import { HMI_DESIGN_TOKENS, type HmiStatusKey } from '../tokens/design';

export type HmiStatusTagProps = Omit<TagProps, 'color'> & {
  status?: HmiStatusKey | string;
};

export function HmiStatusTag({ status = 'default', style, children, ...rest }: HmiStatusTagProps) {
  const key = (status in HMI_DESIGN_TOKENS.STATUS_BADGE ? status : 'default') as HmiStatusKey;
  const badge = HMI_DESIGN_TOKENS.STATUS_BADGE[key];

  return (
    <Tag
      bordered={false}
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
