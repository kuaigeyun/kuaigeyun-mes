import React, { useMemo } from 'react';
import { Empty, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  formatConductStepValue,
  formatSamplingCriteriaPreview,
  getStepConductKey,
  normalizeValueType,
  resolveStepJudgmentClient,
  stepSpecIsCritical,
  stepSpecIsDerived,
  defaultValueSpec,
  type InspectionTemplateStepItem,
} from '../../../types/inspectionStepSpec';
import { getFileDownloadUrl } from '../../../../../services/file';
import { valueTypeOptions } from '../../../components/InspectionStepValueSpecFields';
import {
  getConductStepResults,
  getInspectionTemplateSource,
  getTemplateStepItems,
  hasInspectionPlanSteps,
  isTypedInspectionStep,
} from './inspectionTemplateUtils';

interface InspectionTemplateConductResultsTableProps {
  inspection: Record<string, unknown> | null | undefined;
}

function JudgmentCell({ judgment }: { judgment?: string | null }) {
  const { t } = useTranslation();
  if (!judgment) return <>-</>;
  if (judgment === 'na') {
    return <Tag>{t('app.kuaizhizao.quality.template.judgmentNa')}</Tag>;
  }
  const pass = judgment === 'pass';
  return (
    <Tag color={pass ? 'success' : 'error'}>
      {pass
        ? t('app.kuaizhizao.quality.common.result.qualified')
        : t('app.kuaizhizao.quality.common.result.unqualified')}
    </Tag>
  );
}

const InspectionTemplateConductResultsTable: React.FC<InspectionTemplateConductResultsTableProps> = ({
  inspection,
}) => {
  const { t } = useTranslation();
  const template = getInspectionTemplateSource(inspection);
  const steps = useMemo(() => getTemplateStepItems(template), [template]);
  const results = useMemo(() => getConductStepResults(template), [template]);
  const typeLabels = useMemo(
    () => Object.fromEntries(valueTypeOptions(t).map((o) => [o.value, o.label])),
    [t],
  );

  if (!template || !hasInspectionPlanSteps(template)) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.kuaizhizao.quality.template.noStepResults')}
      />
    );
  }

  const legacyResults = (template.conduct_item_results || {}) as Record<string, string>;
  const hasResults = Object.keys(results).length > 0 || Object.keys(legacyResults).length > 0;
  if (!hasResults) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.kuaizhizao.quality.template.noStepResults')}
      />
    );
  }

  type Row = {
    key: string;
    index: number;
    step: InspectionTemplateStepItem;
    entry: { value?: unknown; judgment?: string };
  };

  const rows: Row[] = steps.map((step, idx) => {
    const stepKey = getStepConductKey(step, idx);
    const entry = results[stepKey] || {};
    const legacy = legacyResults[stepKey] ?? legacyResults[String(idx)];
    const merged = entry.judgment || legacy
      ? { ...entry, judgment: entry.judgment || legacy }
      : entry;
    return { key: stepKey, index: idx + 1, step, entry: merged };
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table<Row>
        style={{ minWidth: 640 }}
        dataSource={rows}
        rowKey="key"
        pagination={false}
        size="small"
        columns={[
          {
            title: t('app.kuaizhizao.quality.plans.step.sequence'),
            dataIndex: 'index',
            width: 56,
          },
          {
            title: t('app.kuaizhizao.quality.plans.step.inspectionItem'),
            key: 'item',
            ellipsis: true,
            render: (_, row) => (
              <>
                {row.step.inspection_item}
                {stepSpecIsCritical({
                  ...defaultValueSpec(normalizeValueType(row.step.value_type), t),
                  ...(row.step.value_spec || {}),
                }) ? (
                  <Tag color="red" style={{ marginLeft: 6 }}>
                    {t('app.kuaizhizao.quality.plans.stepSpec.critical')}
                  </Tag>
                ) : null}
                {stepSpecIsDerived({
                  ...defaultValueSpec(normalizeValueType(row.step.value_type), t),
                  ...(row.step.value_spec || {}),
                }) ? (
                  <Tag color="blue" style={{ marginLeft: 6 }}>
                    {t('app.kuaizhizao.quality.plans.stepSpec.derived')}
                  </Tag>
                ) : null}
              </>
            ),
          },
          {
            title: t('app.kuaizhizao.quality.plans.stepSpec.valueType'),
            key: 'value_type',
            width: 88,
            render: (_, row) =>
              row.step.value_type
                ? typeLabels[normalizeValueType(row.step.value_type)]
                : t('app.kuaizhizao.quality.plans.stepSpec.typeBoolean'),
          },
          {
            title: t('app.kuaizhizao.quality.plans.step.samplingType'),
            key: 'sampling',
            width: 120,
            ellipsis: true,
            render: (_, row) => {
              if (row.step.sampling_type !== 'sampling') {
                return t('app.kuaizhizao.quality.plans.step.fullInspection');
              }
              return formatSamplingCriteriaPreview(row.step.sampling_type, row.step.value_spec, t);
            },
          },
          {
            title: t('app.kuaizhizao.quality.template.conductValue'),
            key: 'value',
            ellipsis: true,
            render: (_, row) => {
              if (!isTypedInspectionStep(row.step)) {
                return row.entry.judgment
                  ? t(
                      row.entry.judgment === 'pass'
                        ? 'app.kuaizhizao.quality.common.result.qualified'
                        : 'app.kuaizhizao.quality.common.result.unqualified',
                    )
                  : '-';
              }
              return formatConductStepValue(row.step.value_type || 'boolean', row.step.value_spec, row.entry, t);
            },
          },
          {
            title: t('app.kuaizhizao.quality.template.stepPhoto'),
            key: 'photos',
            width: 100,
            render: (_, row) => {
              const photos = row.entry.photos;
              if (!Array.isArray(photos) || photos.length === 0) return '-';
              return (
                <a href={photos[0].url || (photos[0].uid ? getFileDownloadUrl(photos[0].uid) : '#')} target="_blank" rel="noreferrer">
                  {t('app.kuaizhizao.quality.template.stepPhotoCount', { count: photos.length })}
                </a>
              );
            },
          },
          {
            title: t('app.kuaizhizao.quality.template.judgment'),
            key: 'judgment',
            width: 96,
            render: (_, row) => {
              const judgment = isTypedInspectionStep(row.step)
                ? resolveStepJudgmentClient(row.step, row.entry)
                : (row.entry.judgment as 'pass' | 'fail' | undefined);
              return <JudgmentCell judgment={judgment} />;
            },
          },
        ]}
      />
    </div>
  );
};

export default InspectionTemplateConductResultsTable;
