import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, List, Spin, Tag, Typography } from 'antd';

export interface CostCalculationFactor {
  key: string;
  category: string;
  status: 'ready' | 'missing' | 'warning';
  message: string;
  hint?: string;
}

export interface CostCalculationReadiness {
  target_type?: string;
  target_id?: number;
  target_label?: string;
  ready: boolean;
  blocking_count: number;
  warning_count: number;
  factors: CostCalculationFactor[];
}

const STATUS_TAG: Record<CostCalculationFactor['status'], { color: string; labelKey: string }> = {
  ready: { color: 'success', labelKey: 'app.kuaicaiwu.costCalculation.factorStatus.ready' },
  missing: { color: 'error', labelKey: 'app.kuaicaiwu.costCalculation.factorStatus.missing' },
  warning: { color: 'warning', labelKey: 'app.kuaicaiwu.costCalculation.factorStatus.warning' },
};

export interface CostCalculationFactorsPanelProps {
  readiness: CostCalculationReadiness | null;
  loading?: boolean;
}

export const CostCalculationFactorsPanel: React.FC<CostCalculationFactorsPanelProps> = ({
  readiness,
  loading = false,
}) => {
  const { t } = useTranslation();

  const categoryLabel = useMemo(
    () =>
      ({
        material: t('app.kuaicaiwu.costCalculation.factorCategory.material'),
        labor: t('app.kuaicaiwu.costCalculation.factorCategory.labor'),
        manufacturing: t('app.kuaicaiwu.costCalculation.factorCategory.manufacturing'),
      }) as Record<string, string>,
    [t],
  );

  if (loading) {
    return (
      <div style={{ marginBottom: 16, textAlign: 'center', padding: '12px 0' }}>
        <Spin size="small" />
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          {t('app.kuaicaiwu.costCalculation.factorsLoading')}
        </Typography.Text>
      </div>
    );
  }

  if (!readiness) {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('app.kuaicaiwu.costCalculation.factorsSelectTarget')}
      />
    );
  }

  const alertType = readiness.ready ? 'success' : readiness.blocking_count > 0 ? 'error' : 'warning';
  const summary = readiness.ready
    ? t('app.kuaicaiwu.costCalculation.factorsAllReady')
    : t('app.kuaicaiwu.costCalculation.factorsBlockingSummary', {
        blocking: readiness.blocking_count,
        warning: readiness.warning_count,
      });

  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type={alertType}
        showIcon
        message={summary}
        description={
          readiness.target_label ? (
            <Typography.Text type="secondary">{readiness.target_label}</Typography.Text>
          ) : undefined
        }
        style={{ marginBottom: 12 }}
      />
      <List
        size="small"
        bordered
        dataSource={readiness.factors}
        locale={{ emptyText: t('app.kuaicaiwu.costCalculation.factorsEmpty') }}
        renderItem={(item) => {
          const statusMeta = STATUS_TAG[item.status];
          return (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={statusMeta.color}>{t(statusMeta.labelKey)}</Tag>
                  <Tag>{categoryLabel[item.category] ?? item.category}</Tag>
                  <Typography.Text>{item.message}</Typography.Text>
                </div>
                {item.hint ? (
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                    {item.hint}
                  </Typography.Text>
                ) : null}
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
};
