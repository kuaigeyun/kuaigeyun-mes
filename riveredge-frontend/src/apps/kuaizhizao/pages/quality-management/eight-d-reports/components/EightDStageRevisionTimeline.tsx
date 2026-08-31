import React from 'react';
import { Empty, Timeline, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { Quality8DStageRevisionEntry } from '../../../../services/quality-improvement';
import { useTranslation } from 'react-i18next';
import { getEightDStatusText, stripEightDHtml } from './eightDMeta';
import { formatDateTime } from '../../../../../../utils/format';

interface EightDStageRevisionTimelineProps {
  revisions: Quality8DStageRevisionEntry[];
  stageKey?: string;
}

const renderActionText = (t: TFunction, entry: Quality8DStageRevisionEntry) => {
  if (entry.action === 'unlock_request') {
    return t('app.kuaizhizao.eightD.stageRevision.unlockRequest', {
      stage: getEightDStatusText(t, entry.stage_key),
    });
  }
  if (entry.action === 'transition_snapshot') {
    return t('app.kuaizhizao.eightD.stageRevision.transitionSnapshot', {
      stage: getEightDStatusText(t, entry.stage_key),
    });
  }
  if (entry.action === 'save') {
    return t('app.kuaizhizao.eightD.stageRevision.save', {
      stage: getEightDStatusText(t, entry.stage_key),
      revision: entry.revision_no,
    });
  }
  if (entry.action === 'edit_complete') {
    return t('app.kuaizhizao.eightD.stageRevision.editComplete', {
      stage: getEightDStatusText(t, entry.stage_key),
    });
  }
  return entry.action;
};

export const EightDStageRevisionTimeline: React.FC<EightDStageRevisionTimelineProps> = ({
  revisions,
  stageKey,
}) => {
  const { t } = useTranslation();
  if (!revisions.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          stageKey
            ? t('app.kuaizhizao.eightD.stageRevision.emptyStage')
            : t('app.kuaizhizao.eightD.stageRevision.empty')
        }
      />
    );
  }

  return (
    <Timeline
      items={revisions.map((entry) => {
        const preview = stripEightDHtml(entry.content ?? '', 120);
        return {
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Typography.Text strong>{renderActionText(t, entry)}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {entry.changed_by_name || '—'}
                {' · '}
                {entry.changed_at ? formatDateTime(entry.changed_at, 'YYYY-MM-DD HH:mm:ss') : '-'}
              </Typography.Text>
              {entry.change_reason ? (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {t('app.kuaizhizao.eightD.stageRevision.reason')}：{entry.change_reason}
                </Typography.Paragraph>
              ) : null}
              {preview ? (
                <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 3 }}>
                  {preview}
                </Typography.Paragraph>
              ) : null}
            </div>
          ),
        };
      })}
    />
  );
};
