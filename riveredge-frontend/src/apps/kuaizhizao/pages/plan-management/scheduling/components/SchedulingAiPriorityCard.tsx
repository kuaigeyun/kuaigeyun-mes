/**
 * 可视排产 AI · 待排池排序建议卡片
 */

import React from 'react';
import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SchedulingAiPriorityResult } from '../../../../services/scheduling-ai';

const I18N = 'app.kuaizhizao.scheduling.aiAssist';

export interface SchedulingAiPriorityCardProps {
  result: SchedulingAiPriorityResult;
  workOrderCodeById?: Map<number, string>;
  applying?: boolean;
  canSelectSuggested?: boolean;
  onSelectSuggested?: (order: number[]) => void;
}

export function SchedulingAiPriorityCard({
  result,
  workOrderCodeById,
  applying,
  canSelectSuggested,
  onSelectSuggested,
}: SchedulingAiPriorityCardProps) {
  const { t } = useTranslation();
  const order = result.suggestedPoolOrder ?? [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {result.confidenceNotes ? (
        <Alert type="info" showIcon message={t(`${I18N}.confidenceNotes`)} description={result.confidenceNotes} />
      ) : null}
      <Typography.Paragraph style={{ marginBottom: 0 }}>{result.rationale}</Typography.Paragraph>
      {order.length > 0 ? (
        <div>
          <Typography.Text type="secondary">{t(`${I18N}.suggestedOrder`)}</Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {order.map((id, index) => {
              const code = workOrderCodeById?.get(id);
              return (
                <Tag key={id} color="blue">
                  {index + 1}. {code || `#${id}`}
                </Tag>
              );
            })}
          </div>
        </div>
      ) : (
        <Alert type="warning" showIcon message={t(`${I18N}.emptyPriority`)} />
      )}
      {canSelectSuggested && order.length > 0 && onSelectSuggested ? (
        <Button type="primary" loading={applying} onClick={() => onSelectSuggested(order)}>
          {t(`${I18N}.selectSuggested`)}
        </Button>
      ) : null}
    </Space>
  );
}
