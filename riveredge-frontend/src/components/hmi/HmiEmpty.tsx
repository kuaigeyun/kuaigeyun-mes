import { Empty } from 'antd';

export type HmiEmptyProps = {
  description: string;
  className?: string;
};

/** 工位 / kiosk 空状态 */
export function HmiEmpty({ description, className }: HmiEmptyProps) {
  return (
    <div className={['hmi-empty', className].filter(Boolean).join(' ')}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span className="hmi-empty__text">{description}</span>}
      />
    </div>
  );
}
