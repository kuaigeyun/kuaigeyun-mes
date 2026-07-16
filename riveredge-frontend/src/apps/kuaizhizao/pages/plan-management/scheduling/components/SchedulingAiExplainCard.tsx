/**
 * 可视排产 AI - 解读结果卡片（含后续操作）
 */

import React from 'react';
import { Alert, Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const I18N = 'app.kuaizhizao.scheduling.aiAssist';

export interface SchedulingAiExplainCardProps {
  answer: string;
  canUpdate?: boolean;
  hasSelectedWorkOrders?: boolean;
  hasOverdueInPool?: boolean;
  busy?: boolean;
  onSuggestPriority?: () => void;
  onSelectOverdue?: () => void;
  onSuggestAdjustments?: (hint: string) => void;
}

export function SchedulingAiExplainCard({
  answer,
  canUpdate,
  hasSelectedWorkOrders,
  hasOverdueInPool,
  busy,
  onSuggestPriority,
  onSelectOverdue,
  onSuggestAdjustments,
}: SchedulingAiExplainCardProps) {
  const { t } = useTranslation();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="success" showIcon message={t(`${I18N}.explainDone`)} />
      <Typography.Paragraph className="scheduling-ai-chat-markdown" style={{ marginBottom: 0 }}>
        {answer}
      </Typography.Paragraph>
      <div>
        <Typography.Text type="secondary">{t(`${I18N}.nextActions`)}</Typography.Text>
        <Space wrap style={{ marginTop: 8 }}>
          {onSuggestPriority ? (
            <Button size="small" disabled={busy} onClick={onSuggestPriority}>
              {t(`${I18N}.actionSuggestPriority`)}
            </Button>
          ) : null}
          {hasOverdueInPool && onSelectOverdue ? (
            <Button size="small" disabled={busy} onClick={onSelectOverdue}>
              {t(`${I18N}.actionSelectOverdue`)}
            </Button>
          ) : null}
          {canUpdate && onSuggestAdjustments ? (
            <Button
              size="small"
              type="primary"
              disabled={busy}
              onClick={() =>
                onSuggestAdjustments(
                  hasSelectedWorkOrders
                    ? t(`${I18N}.actionAdjustSelectedHint`)
                    : t(`${I18N}.actionAdjustOverdueHint`),
                )
              }
            >
              {hasSelectedWorkOrders
                ? t(`${I18N}.actionAdjustSelected`)
                : t(`${I18N}.actionAdjustOverdue`)}
            </Button>
          ) : null}
        </Space>
      </div>
    </Space>
  );
}
