import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export type UniReportMetaHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  printedAt?: Date;
  className?: string;
};

/**
 * 中国式报表头：标题 + 副标题（统计区间、制表时间）
 */
export const UniReportMetaHeader: React.FC<UniReportMetaHeaderProps> = ({
  title,
  subtitle,
  printedAt,
  className,
}) => {
  const { t } = useTranslation();
  const at = printedAt ?? new Date();
  const timeLabel = t('components.uniReport.printedAt', {
    time: at.toLocaleString(),
  });

  return (
    <div
      className={className}
      style={{ marginBottom: 12, padding: '0 4px' }}
      data-uni-report-meta
    >
      <Title level={4} style={{ margin: 0, textAlign: 'center' }}>
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
