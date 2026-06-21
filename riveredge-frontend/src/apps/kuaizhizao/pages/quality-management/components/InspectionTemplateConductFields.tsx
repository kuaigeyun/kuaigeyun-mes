import React, { useEffect, useMemo } from 'react';
import { ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea, ProFormCheckbox, ProFormItem } from '@ant-design/pro-components';
import { Alert, Divider, Typography, Tag, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  getInspectionTemplateSource,
  getTemplateStepItems,
  hasInspectionPlanSteps,
  isTypedInspectionStep,
} from './inspectionTemplateUtils';
import {
  defaultValueSpec,
  evaluateDerivedFormula,
  formatSamplingCriteriaPreview,
  getStepConductKey,
  normalizeValueType,
  resolveStepJudgmentClient,
  stepSpecAllowsNa,
  stepSpecIsCritical,
  stepSpecIsDerived,
  stepSpecRequiresPhoto,
  summarizeConductSteps,
  type InspectionTemplateStepItem,
  type StepConductEntry,
} from '../../../types/inspectionStepSpec';
import InspectionStepConductPhotoField from '../../../components/InspectionStepConductPhotoField';

const { Text } = Typography;

interface InspectionTemplateConductFieldsProps {
  inspection: Record<string, unknown> | null | undefined;
  photoCategory?: string;
  /** 为 false 时仍展示照片上传，但不强制校验（如来料检验） */
  stepPhotoRequired?: boolean;
}

function JudgmentTag({ judgment }: { judgment?: string | null }) {
  const { t } = useTranslation();
  if (!judgment) return null;
  const pass = judgment === 'pass';
  const label =
    judgment === 'na'
      ? t('app.kuaizhizao.quality.template.judgmentNa')
      : pass
        ? t('app.kuaizhizao.quality.common.result.qualified')
        : t('app.kuaizhizao.quality.common.result.unqualified');
  return (
    <Tag color={pass ? 'success' : judgment === 'na' ? 'default' : 'error'} style={{ marginLeft: 8 }}>
      {label}
    </Tag>
  );
}

const InspectionConductStepSummary: React.FC<{
  inspection: Record<string, unknown> | null | undefined;
}> = ({ inspection }) => {
  const { t } = useTranslation();
  const template = getInspectionTemplateSource(inspection);
  const steps = useMemo(() => getTemplateStepItems(template), [template]);
  const stepResults = Form.useWatch('conduct_step_results') as Record<string, StepConductEntry> | undefined;
  const itemResults = Form.useWatch('item_results') as Record<string, unknown> | undefined;

  const summary = useMemo(
    () => summarizeConductSteps(steps, stepResults, itemResults, t),
    [steps, stepResults, itemResults, t],
  );

  if (summary.failCount === 0) return null;

  if (summary.criticalFailCount > 0) {
    return (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 12 }}
        message={t('app.kuaizhizao.quality.template.criticalFailAlert', {
          items: summary.criticalFailLabels.join('、'),
        })}
      />
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message={t('app.kuaizhizao.quality.template.stepFailHint', {
        count: summary.failCount,
        items: summary.failLabels.join('、'),
      })}
    />
  );
};

const StepAutoJudgment: React.FC<{
  step: InspectionTemplateStepItem;
  stepKey: string;
}> = ({ step, stepKey }) => {
  const entry = Form.useWatch(['conduct_step_results', stepKey]) as StepConductEntry | undefined;
  if (entry?.judgment === 'na') {
    return <JudgmentTag judgment="na" />;
  }
  const judgment = resolveStepJudgmentClient(step, entry || {});
  return <JudgmentTag judgment={judgment} />;
};

const DerivedNumericValue: React.FC<{
  stepKey: string;
  spec: Record<string, unknown>;
  unitLabel: string;
}> = ({ stepKey, spec, unitLabel }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const allResults = Form.useWatch('conduct_step_results') as Record<string, StepConductEntry> | undefined;
  const computed = useMemo(
    () =>
      evaluateDerivedFormula(
        spec.formula as string | undefined,
        allResults,
        (spec.decimal_places as number) ?? 4,
      ),
    [allResults, spec.formula, spec.decimal_places],
  );

  useEffect(() => {
    if (computed == null) return;
    form.setFieldValue(['conduct_step_results', stepKey, 'value'], computed);
  }, [computed, form, stepKey]);

  return (
    <ProFormDigit
      name={['conduct_step_results', stepKey, 'value']}
      label={unitLabel}
      fieldProps={{
        precision: (spec.decimal_places as number) ?? 4,
        style: { width: '100%' },
        disabled: true,
      }}
      extra={t('app.kuaizhizao.quality.template.derivedValueHint')}
    />
  );
};

const TypedStepFields: React.FC<{
  step: InspectionTemplateStepItem;
  stepKey: string;
  label: string;
  hint?: string;
  photoCategory?: string;
  stepPhotoRequired?: boolean;
}> = ({ step, stepKey, label, hint, photoCategory, stepPhotoRequired = true }) => {
  const { t } = useTranslation();
  const vt = normalizeValueType(step.value_type);
  const spec = { ...defaultValueSpec(vt, t), ...(step.value_spec || {}) };
  const passLabel = t('app.kuaizhizao.quality.common.result.qualified');
  const failLabel = t('app.kuaizhizao.quality.common.result.unqualified');
  const naLabel = t('app.kuaizhizao.quality.template.judgmentNa');
  const allowsNa = stepSpecAllowsNa(spec);
  const isCritical = stepSpecIsCritical(spec);
  const isDerived = vt === 'numeric' && stepSpecIsDerived(spec);
  const templateWantsPhoto = stepSpecRequiresPhoto(spec);
  const enforcePhoto = templateWantsPhoto && stepPhotoRequired;

  const basePath = ['conduct_step_results', stepKey];
  const judgment = Form.useWatch([...basePath, 'judgment']);
  const isNa = judgment === 'na';

  const skipValueRule = () => ({
    validator(_: unknown, value: unknown) {
      if (isNa || isDerived) return Promise.resolve();
      if (value === undefined || value === null || value === '') {
        return Promise.reject(new Error(t('app.kuaizhizao.quality.template.valueRequired', { label })));
      }
      if (vt === 'multi_select' && Array.isArray(value) && value.length === 0) {
        return Promise.reject(new Error(t('app.kuaizhizao.quality.template.valueRequired', { label })));
      }
      return Promise.resolve();
    },
  });

  const photoRule = () => ({
    validator(_: unknown, value: unknown) {
      if (!enforcePhoto || isNa) return Promise.resolve();
      if (!Array.isArray(value) || value.length === 0) {
        return Promise.reject(new Error(t('app.kuaizhizao.quality.template.stepPhotoRequired', { label })));
      }
      return Promise.resolve();
    },
  });

  if (!isTypedInspectionStep(step)) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Text strong>{label}</Text>
        {hint ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hint}
            </Text>
          </div>
        ) : null}
        <ProFormSelect
          name={['item_results', stepKey]}
          label={t('app.kuaizhizao.quality.template.judgment')}
          rules={[{ required: true, message: t('app.kuaizhizao.quality.template.judgmentRequired', { label }) }]}
          valueEnum={{ pass: passLabel, fail: failLabel }}
        />
      </div>
    );
  }

  const unitLabel = t('app.kuaizhizao.quality.template.measurementValue', {
    unit: spec.unit ? ` (${spec.unit})` : '',
  });

  return (
    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--river-border-color)' }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong>{label}</Text>
        {isCritical ? (
          <Tag color="red" style={{ marginLeft: 8 }}>
            {t('app.kuaizhizao.quality.plans.stepSpec.critical')}
          </Tag>
        ) : null}
        {isDerived ? (
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {t('app.kuaizhizao.quality.plans.stepSpec.derived')}
          </Tag>
        ) : null}
        <StepAutoJudgment step={step} stepKey={stepKey} />
      </div>
      {hint ? (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Text>
        </div>
      ) : null}

      {allowsNa && vt !== 'text' && (
        <ProFormSelect
          name={[...basePath, 'judgment']}
          label={t('app.kuaizhizao.quality.plans.stepSpec.markNa')}
          allowClear
          options={[{ label: naLabel, value: 'na' }]}
        />
      )}

      {!isNa && vt === 'boolean' && (
        <ProFormSelect
          name={[...basePath, 'value']}
          label={t('app.kuaizhizao.quality.plans.stepSpec.typeBoolean')}
          rules={[skipValueRule()]}
          options={[
            { label: t('app.kuaizhizao.quality.plans.stepSpec.passWhenYes'), value: true },
            { label: t('app.kuaizhizao.quality.plans.stepSpec.passWhenNo'), value: false },
          ]}
        />
      )}

      {!isNa && vt === 'numeric' && isDerived && (
        <DerivedNumericValue stepKey={stepKey} spec={spec} unitLabel={unitLabel} />
      )}

      {!isNa && vt === 'numeric' && !isDerived && (
        <ProFormDigit
          name={[...basePath, 'value']}
          label={unitLabel}
          rules={[skipValueRule()]}
          fieldProps={{
            precision: (spec.decimal_places as number) ?? 4,
            style: { width: '100%' },
          }}
        />
      )}

      {!isNa && vt === 'single_select' && (
        <ProFormSelect
          name={[...basePath, 'value']}
          label={t('app.kuaizhizao.quality.template.selectValue')}
          rules={[skipValueRule()]}
          options={((spec.options as Array<{ value: string; label: string }>) || []).map((o) => ({
            value: o.value,
            label: o.label || o.value,
          }))}
        />
      )}

      {!isNa && vt === 'multi_select' && (
        <ProFormCheckbox.Group
          name={[...basePath, 'value']}
          label={t('app.kuaizhizao.quality.template.selectValue')}
          rules={[skipValueRule()]}
          options={((spec.options as Array<{ value: string; label: string; defect?: boolean }>) || []).map((o) => ({
            value: o.value,
            label: o.defect ? `${o.label || o.value} (${t('app.kuaizhizao.quality.plans.stepSpec.defectOption')})` : o.label || o.value,
          }))}
        />
      )}

      {vt === 'text' && (
        <>
          {!isNa && (spec.multiline ? (
            <ProFormTextArea
              name={[...basePath, 'value']}
              label={t('app.kuaizhizao.quality.plans.stepSpec.typeText')}
              rules={[skipValueRule()]}
              fieldProps={{ maxLength: (spec.max_length as number) || 500 }}
            />
          ) : (
            <ProFormText
              name={[...basePath, 'value']}
              label={t('app.kuaizhizao.quality.plans.stepSpec.typeText')}
              rules={[skipValueRule()]}
            />
          ))}
          <ProFormSelect
            name={[...basePath, 'judgment']}
            label={t('app.kuaizhizao.quality.template.judgment')}
            rules={[{ required: true, message: t('app.kuaizhizao.quality.template.judgmentRequired', { label }) }]}
            options={[
              { label: passLabel, value: 'pass' },
              { label: failLabel, value: 'fail' },
              ...(allowsNa ? [{ label: naLabel, value: 'na' }] : []),
            ]}
          />
        </>
      )}

      {templateWantsPhoto && photoCategory && !isNa && (
        <ProFormItem
          name={[...basePath, 'photos']}
          label={t('app.kuaizhizao.quality.template.stepPhoto')}
          rules={enforcePhoto ? [photoRule()] : undefined}
        >
          <InspectionStepConductPhotoField
            category={photoCategory}
            required={enforcePhoto}
            label={label}
          />
        </ProFormItem>
      )}
    </div>
  );
};

const InspectionTemplateConductFields: React.FC<InspectionTemplateConductFieldsProps> = ({
  inspection,
  photoCategory,
  stepPhotoRequired = true,
}) => {
  const { t } = useTranslation();
  const template = getInspectionTemplateSource(inspection);
  const steps = useMemo(() => getTemplateStepItems(template), [template]);

  if (!template) return null;

  const planCode = template.plan_code as string | undefined;
  const planVersion = template.plan_version as string | undefined;
  const planName =
    planCode && planVersion
      ? `${planCode} v${planVersion}`
      : planCode || (template.standard_id ? t('app.kuaizhizao.quality.template.qualityStandard') : null);
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
          message={t('app.kuaizhizao.quality.template.planModeHintTyped')}
        />
        <InspectionConductStepSummary inspection={inspection} />
        {steps.map((step, idx) => {
          const stepKey = getStepConductKey(step, idx);
          const label = step.inspection_item || t('app.kuaizhizao.quality.template.inspectionItemFallback', { index: idx + 1 });
          const hintParts = [step.inspection_method, step.acceptance_criteria];
          const samplingHint = formatSamplingCriteriaPreview(step.sampling_type, step.value_spec, t);
          if (samplingHint) hintParts.push(samplingHint);
          const hint = hintParts.filter(Boolean).join(' · ');
          return (
            <TypedStepFields
              key={stepKey}
              step={step}
              stepKey={stepKey}
              label={label}
              hint={hint || undefined}
              photoCategory={photoCategory}
              stepPhotoRequired={stepPhotoRequired}
            />
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
