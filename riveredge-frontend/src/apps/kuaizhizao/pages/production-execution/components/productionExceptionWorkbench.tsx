/**
 * 生产异常处理工作台：影响指标条 + 处置生命周期。
 * 缺料 / 延期 / 质量详情抽屉共用此唯一路径，页面只负责字段组合与处置按钮。
 */

import React from 'react';
import { Typography, theme } from 'antd';
import type { TFunction } from 'i18next';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../utils/format';
import type {
  DeliveryDelayExceptionDetailRecord,
  MaterialShortageExceptionDetailRecord,
  QualityExceptionDetailRecord,
} from './ProductionExceptionDetailContent';

const P = 'app.kuaizhizao.productionException';
const Q = `${P}.quality`;

export type ExceptionWorkbenchLifecycle = {
  stages: SubStage[];
  status: 'success' | 'exception' | 'active';
  nextStepSuggestions?: string[];
};

export function alertLevelTagColor(level?: string): string {
  if (level === 'critical') return 'red';
  if (level === 'high') return 'orange';
  if (level === 'medium') return 'gold';
  return 'default';
}

export function severityTagColor(severity?: string): string {
  if (severity === 'critical') return 'red';
  if (severity === 'major') return 'orange';
  return 'default';
}

export type ExceptionImpactItem = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  emphasize?: boolean;
  compact?: boolean;
};

export function ExceptionImpactStrip({ items }: { items: ExceptionImpactItem[] }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: token.marginLG,
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      {items.map((item) => (
        <div key={item.key} style={{ minWidth: 88 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.label}
          </Typography.Text>
          <div
            style={{
              marginTop: 4,
              fontWeight: 600,
              fontSize: item.compact ? 14 : 18,
              lineHeight: 1.3,
              color: item.emphasize ? token.colorError : token.colorText,
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildExceptionLifecycle(
  keys: string[],
  current: string | undefined,
  labelOf: (key: string) => string,
  terminalKeys: string[],
): ExceptionWorkbenchLifecycle {
  const cancelled = current === 'cancelled';
  const resolved = terminalKeys.includes(current || '');
  const stageKeys = cancelled
    ? [...keys.filter((k) => !terminalKeys.includes(k)), 'cancelled']
    : [...keys];
  const activeKey = cancelled
    ? 'cancelled'
    : resolved
      ? (terminalKeys.find((k) => stageKeys.includes(k)) ?? stageKeys[stageKeys.length - 1])
      : (current && stageKeys.includes(current) ? current : keys[0]);
  let activeIdx = stageKeys.findIndex((k) => k === activeKey);
  if (activeIdx < 0) activeIdx = 0;

  const stages: SubStage[] = stageKeys.map((key, index) => {
    let status: SubStage['status'] = 'pending';
    if (resolved && !cancelled) {
      status = 'done';
    } else if (index < activeIdx) {
      status = 'done';
    } else if (index === activeIdx) {
      status = 'active';
    }
    return { key, label: labelOf(key), status };
  });
  const next = stages.find((s) => s.status === 'pending');
  return {
    stages,
    nextStepSuggestions: next ? [next.label] : undefined,
    status: cancelled ? 'exception' : resolved ? 'success' : 'active',
  };
}

export function buildStandardExceptionLifecycle(
  t: (key: string) => string,
  status?: string,
): ExceptionWorkbenchLifecycle {
  return buildExceptionLifecycle(
    ['pending', 'processing', 'resolved'],
    status,
    (key) => t(`${P}.status.${key}`),
    ['resolved'],
  );
}

export function buildQualityExceptionLifecycle(
  t: (key: string) => string,
  status?: string,
): ExceptionWorkbenchLifecycle {
  return buildExceptionLifecycle(
    ['pending', 'investigating', 'correcting', 'closed'],
    status,
    (key) => t(`${P}.status.${key}`),
    ['closed'],
  );
}

export function ExceptionWorkbenchLifecycleStepper({
  lifecycle,
  hideNextStepSuggestions,
}: {
  lifecycle: ExceptionWorkbenchLifecycle;
  hideNextStepSuggestions?: boolean;
}) {
  if (lifecycle.stages.length === 0) return null;
  return (
    <UniLifecycleStepper
      steps={lifecycle.stages}
      status={lifecycle.status}
      showLabels
      nextStepSuggestions={lifecycle.nextStepSuggestions}
      hideNextStepSuggestions={hideNextStepSuggestions}
    />
  );
}

export function formatExceptionQuantity(value: unknown): string {
  if (value == null || value === '') return '-';
  return formatQuantity(value);
}

export function ExceptionAlertLevelValue({
  level,
  label,
}: {
  level?: string;
  label: string;
}) {
  return <MarkerTag color={alertLevelTagColor(level)}>{label}</MarkerTag>;
}

export function ExceptionSeverityValue({
  severity,
  label,
}: {
  severity?: string;
  label: string;
}) {
  return <MarkerTag color={severityTagColor(severity)}>{label}</MarkerTag>;
}

export function resolveExceptionNextStepLabel(
  lifecycle: ExceptionWorkbenchLifecycle,
  suggestedActionLabel?: string,
): string | undefined {
  if (suggestedActionLabel && suggestedActionLabel !== '-') {
    return suggestedActionLabel;
  }
  return lifecycle.nextStepSuggestions?.[0];
}

export function renderExceptionWorkbenchNextStepSuffix(
  t: TFunction,
  nextLabel?: string,
): React.ReactNode {
  if (!nextLabel) return undefined;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
      {t('components.uniLifecycle.nextStep')}：{nextLabel}
    </Typography.Text>
  );
}

export function ExceptionSuggestedActionBlock({ label }: { label: string }) {
  return <Typography.Paragraph style={{ marginBottom: 0 }}>{label}</Typography.Paragraph>;
}

export function MaterialShortageImpactBanner({
  record,
  t,
  alertLevelLabel,
}: {
  record: MaterialShortageExceptionDetailRecord;
  t: TFunction;
  alertLevelLabel: (level?: string) => string;
}) {
  return (
    <ExceptionImpactStrip
      items={[
        {
          key: 'alert',
          label: t(`${P}.col.alertLevel`),
          value: (
            <ExceptionAlertLevelValue
              level={record.alert_level}
              label={alertLevelLabel(record.alert_level)}
            />
          ),
          compact: true,
        },
        {
          key: 'shortage',
          label: t(`${P}.col.shortageQty`),
          value: formatExceptionQuantity(record.shortage_quantity),
          emphasize: true,
        },
        {
          key: 'required',
          label: t(`${P}.col.requiredQty`),
          value: formatExceptionQuantity(record.required_quantity),
        },
        {
          key: 'available',
          label: t(`${P}.col.availableQty`),
          value: formatExceptionQuantity(record.available_quantity),
        },
      ]}
    />
  );
}

export function DeliveryDelayImpactBanner({
  record,
  t,
  alertLevelLabel,
}: {
  record: DeliveryDelayExceptionDetailRecord;
  t: TFunction;
  alertLevelLabel: (level?: string) => string;
}) {
  return (
    <ExceptionImpactStrip
      items={[
        {
          key: 'alert',
          label: t(`${P}.col.alertLevel`),
          value: (
            <ExceptionAlertLevelValue
              level={record.alert_level}
              label={alertLevelLabel(record.alert_level)}
            />
          ),
          compact: true,
        },
        {
          key: 'delay',
          label: t(`${P}.col.delayDays`),
          value: t(`${P}.label.daysUnit`, { count: record.delay_days ?? 0 }),
          emphasize: true,
        },
        {
          key: 'planned',
          label: t(`${P}.col.plannedEndDate`),
          value: formatDateTimeBySiteSetting(record.planned_end_date),
          compact: true,
        },
        {
          key: 'actual',
          label: t(`${P}.field.actualEndDate`),
          value: formatDateTimeBySiteSetting(record.actual_end_date),
          compact: true,
        },
      ]}
    />
  );
}

export function QualityExceptionImpactBanner({
  record,
  t,
  exceptionTypeLabel,
  severityLabel,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  exceptionTypeLabel: (type?: string) => string;
  severityLabel: (severity?: string) => string;
}) {
  return (
    <ExceptionImpactStrip
      items={[
        {
          key: 'severity',
          label: t(`${Q}.col.severity`),
          value: (
            <ExceptionSeverityValue
              severity={record.severity}
              label={severityLabel(record.severity)}
            />
          ),
          emphasize: record.severity === 'critical' || record.severity === 'major',
          compact: true,
        },
        {
          key: 'type',
          label: t(`${P}.col.exceptionType`),
          value: exceptionTypeLabel(record.exception_type),
          compact: true,
        },
      ]}
    />
  );
}
