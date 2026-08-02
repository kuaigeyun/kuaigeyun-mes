import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export type UniReportMetaHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  printedAt?: Date;
  className?: string;
  /** 左上角操作区（如返回），与标题同一行，不单独占高 */
  extraLeft?: React.ReactNode;
};

/**
 * 中国式报表头：标题 + 副标题（统计区间、制表时间）
 */
export const UniReportMetaHeader: React.FC<UniReportMetaHeaderProps> = ({
  title,
  subtitle,
  printedAt,
  className,
  extraLeft,
}) => {
  const { t } = useTranslation();
  const at = printedAt ?? new Date();
  const timeLabel = t('components.uniReport.printedAt', {
    time: at.toLocaleString(),
  });

  return (
    <div
      className={className}
      style={{ marginBottom: 12, padding: '0 4px', position: 'relative' }}
      data-uni-report-meta
    >
      {extraLeft ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            minHeight: 32,
          }}
        >
          {extraLeft}
        </div>
      ) : null}
      <Title level={4} style={{ margin: 0, textAlign: 'center', lineHeight: '32px' }}>
        {title}
      </Title>
      {(subtitle || timeLabel) && (
        <div style={{ marginTop: 4, textAlign: 'center' }}>
          {subtitle && (
            <Text type="secondary" style={{ marginRight: subtitle ? 16 : 0 }}>
              {subtitle}
            </Text>
          )}
          <Text type="secondary">{timeLabel}</Text>
        </div>
      )}
    </div>
  );
};

export default UniReportMetaHeader;
