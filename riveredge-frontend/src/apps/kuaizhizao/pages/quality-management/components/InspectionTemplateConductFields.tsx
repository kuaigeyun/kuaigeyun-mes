import React from 'react';
import { ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Alert, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  getInspectionTemplateSource,
  getTemplateStepItems,
  hasInspectionPlanSteps,
} from './inspectionTemplateUtils';

const { Text } = Typography;

interface InspectionTemplateConductFieldsProps {
  inspection: Record<string, unknown> | null | undefined;
}

/**
 * 按检验单上的方案/标准模板渲染检验项录入（plan 模式逐步判定，simple 模式展示标准摘要）。
 */
const InspectionTemplateConductFields: React.FC<InspectionTemplateConductFieldsProps> = ({ inspection }) => {
  const { t } = useTranslation();
  const template = getInspectionTemplateSource(inspection);
  if (!template) return null;

  const planName = (template.plan_code as string) || (template.standard_id ? t('app.kuaizhizao.quality.template.qualityStandard') : null);
  const steps = getTemplateStepItems(template);
  const passLabel = t('app.kuaizhizao.quality.common.result.qualified');
  const failLabel = t('app.kuaizhizao.quality.common.result.unqualified');

  if (hasInspectionPlanSteps(template)) {
    return (
      <>
        <Divider orientation="left" plain>
          {planName
            ? t('app.kuaizhizao.quality.template.planItemsTitleWithName', { planName })
            : t('app.kuaizhizao.quality.template.planItemsTitle')}
        </Divider>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('app.kuaizhizao.quality.template.planModeHint')}
        />
        {steps.map((step, idx) => {
          const label = step.inspection_item || t('app.kuaizhizao.quality.template.inspectionItemFallback', { index: idx + 1 });
          const hint = [step.inspection_method, step.acceptance_criteria].filter(Boolean).join(' · ');
          return (
            <div key={`${label}-${idx}`} style={{ marginBottom: 12 }}>
              <Text strong>{label}</Text>
              {hint ? (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {hint}
                  </Text>
                </div>
              ) : null}
              <ProFormSelect
                name={['item_results', String(idx)]}
                label={t('app.kuaizhizao.quality.template.judgment')}
                rules={[{ required: true, message: t('app.kuaizhizao.quality.template.judgmentRequired', { label }) }]}
                valueEnum={{ pass: passLabel, fail: failLabel }}
              />
              <ProFormDigit
                name={['measurement_data', label]}
                label={t('app.kuaizhizao.quality.template.measurementOptional')}
                fieldProps={{ precision: 4, style: { width: '100%' } }}
              />
            </div>
          );
        })}
      </>
    );
  }

  const criteria = template.acceptance_criteria as string | undefined;
  const standardItems = template.inspection_items;
  if (!criteria && !standardItems) return null;

  return (
    <>
      <Divider orientation="left" plain>
        {planName
          ? t('app.kuaizhizao.quality.template.standardTitleWithName', { planName })
          : t('app.kuaizhizao.quality.template.standardTitle')}
      </Divider>
      {criteria ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.quality.template.acceptanceCriteria', { criteria })}
        />
      ) : null}
      {standardItems ? (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.kuaizhizao.quality.template.inspectionItems', {
              items: typeof standardItems === 'string' ? standardItems : JSON.stringify(standardItems),
            })}
          </Text>
        </div>
      ) : null}
      <ProFormSelect
        name={['item_results', '0']}
        label={t('app.kuaizhizao.quality.template.overallJudgment')}
        rules={[{ required: true, message: t('app.kuaizhizao.quality.template.overallJudgmentRequired') }]}
        valueEnum={{ pass: passLabel, fail: failLabel }}
      />
    </>
  );
};

export default InspectionTemplateConductFields;
