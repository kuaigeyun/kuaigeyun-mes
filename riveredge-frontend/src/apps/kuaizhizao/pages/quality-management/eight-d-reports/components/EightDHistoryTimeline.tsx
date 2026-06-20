import React from 'react';
import { Empty, Timeline, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { Quality8DHistoryEntry } from '../../../../services/quality-improvement';
import { useTranslation } from 'react-i18next';
import { getEightDStatusText } from './eightDMeta';
import { formatDateTime } from '../../../../../../utils/format';

interface EightDHistoryTimelineProps {
  history: Quality8DHistoryEntry[];
}

const renderActionText = (t: TFunction, entry: Quality8DHistoryEntry) => {
  if (entry.action === 'created') return t('app.kuaizhizao.eightD.history.created');
  if (entry.action === 'closed') return t('app.kuaizhizao.eightD.history.closed');
  if (entry.action === 'transition') {
    const fromLabel = getEightDStatusText(t, entry.from_status);
    const toLabel = getEightDStatusText(t, entry.to_status);
    return t('app.kuaizhizao.eightD.history.transition', { from: fromLabel, to: toLabel });
  }
  return entry.action || t('app.kuaizhizao.eightD.history.default');
};

export const EightDHistoryTimeline: React.FC<EightDHistoryTimelineProps> = ({ history }) => {
  const { t } = useTranslation();
  if (!history.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.eightD.history.empty')} />;
  }

  return (
    <Timeline
      items={history.map((entry) => ({
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography.Text strong>{renderActionText(t, entry)}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {entry.timestamp ? formatDateTime(entry.timestamp, 'YYYY-MM-DD HH:mm:ss') : '-'}
            </Typography.Text>
            {entry.verification_result ? (
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {t('app.kuaizhizao.eightD.columns.verificationResult')}：{entry.verification_result}
              </Typography.Paragraph>
            ) : null}
            {entry.remarks ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {entry.remarks}
              </Typography.Paragraph>
            ) : null}
          </div>
        ),
      }))}
    />
  );
};
