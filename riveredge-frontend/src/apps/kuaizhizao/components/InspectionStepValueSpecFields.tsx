import React from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Checkbox,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  defaultValueSpec,
  normalizeValueType,
  type InspectionStepValueSpec,
  type InspectionStepValueType,
  INSPECTION_STEP_VALUE_TYPES,
} from '../types/inspectionStepSpec';

type CommonFlagProps = {
  value?: InspectionStepValueSpec;
  onChange?: (spec: InspectionStepValueSpec) => void;
};

export const InspectionStepCommonFlagFields: React.FC<CommonFlagProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const spec = { ...(value || {}) };

  const patch = (partial: InspectionStepValueSpec) => {
    onChange?.({ ...spec, ...partial });
  };

  return (
    <Space wrap size={[8, 8]}>
      <Switch
        checked={!!spec.allow_na}
        onChange={(checked) => patch({ allow_na: checked })}
        checkedChildren={t('app.kuaizhizao.quality.plans.stepSpec.allowNa')}
        unCheckedChildren={t('app.kuaizhizao.quality.plans.stepSpec.allowNa')}
      />
      <Switch
        checked={!!spec.critical}
        onChange={(checked) => patch({ critical: checked })}
        checkedChildren={t('app.kuaizhizao.quality.plans.stepSpec.critical')}
        unCheckedChildren={t('app.kuaizhizao.quality.plans.stepSpec.critical')}
      />
      <Switch
        checked={!!spec.require_photo}
        onChange={(checked) => patch({ require_photo: checked })}
        checkedChildren={t('app.kuaizhizao.quality.plans.stepSpec.requirePhoto')}
        unCheckedChildren={t('app.kuaizhizao.quality.plans.stepSpec.requirePhoto')}
      />
    </Space>
  );
};

type Props = {
  valueType: string;
  value?: InspectionStepValueSpec;
  onChange?: (spec: InspectionStepValueSpec) => void;
  formulaRefOptions?: Array<{ step_key: string; label: string }>;
};

export const InspectionStepValueSpecFields: React.FC<Props> = ({
  valueType,
  value,
  onChange,
  formulaRefOptions = [],
}) => {
  const { t } = useTranslation();
  const vt = normalizeValueType(valueType);
  const spec = { ...defaultValueSpec(vt), ...(value || {}) };

  const patch = (partial: InspectionStepValueSpec) => {
    onChange?.({ ...spec, ...partial });
  };

  if (vt === 'boolean') {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.passWhen')} style={{ marginBottom: 0 }}>
          <Select
            value={spec.pass_when === false ? 'false' : 'true'}
            onChange={(v) => patch({ pass_when: v === 'true' })}
            options={[
              { label: t('app.kuaizhizao.quality.plans.stepSpec.passWhenYes'), value: 'true' },
              { label: t('app.kuaizhizao.quality.plans.stepSpec.passWhenNo'), value: 'false' },
            ]}
          />
        </Form.Item>
      </Space>
    );
  }

  if (vt === 'numeric') {
    const isDerived = !!spec.derived;
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Switch
          checked={isDerived}
          onChange={(checked) =>
            patch({
              derived: checked,
              formula: checked ? (spec.formula as string) || '' : undefined,
            })
          }
          checkedChildren={t('app.kuaizhizao.quality.plans.stepSpec.derived')}
          unCheckedChildren={t('app.kuaizhizao.quality.plans.stepSpec.derived')}
        />
        {isDerived ? (
          <>
            <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.formula')} style={{ marginBottom: 0 }}>
              <Input
                value={(spec.formula as string) || ''}
                onChange={(e) => patch({ formula: e.target.value })}
                placeholder={t('app.kuaizhizao.quality.plans.stepSpec.formulaPlaceholder')}
              />
            </Form.Item>
            {formulaRefOptions.length > 0 && (
              <Select
                placeholder={t('app.kuaizhizao.quality.plans.stepSpec.insertFormulaRef')}
                style={{ width: '100%' }}
                options={formulaRefOptions.map((o) => ({
                  value: o.step_key,
                  label: `${o.label} ({o.step_key.slice(0, 8)}…)`,
                }))}
                onChange={(stepKey) => {
                  const current = (spec.formula as string) || '';
                  patch({ formula: `${current}{${stepKey}}` });
                }}
                allowClear
              />
            )}
            <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
              {t('app.kuaizhizao.quality.plans.stepSpec.formulaHint')}
            </span>
          </>
        ) : null}
        <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.unit')} style={{ marginBottom: 0 }}>
          <Input
            value={(spec.unit as string) || ''}
            onChange={(e) => patch({ unit: e.target.value || undefined })}
            placeholder={t('app.kuaizhizao.quality.plans.stepSpec.unitPlaceholder')}
          />
        </Form.Item>
        <Space wrap>
          <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.lowerLimit')} style={{ marginBottom: 0 }}>
            <InputNumber
              value={spec.lower_limit as number | undefined}
              onChange={(v) => patch({ lower_limit: v ?? undefined })}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.upperLimit')} style={{ marginBottom: 0 }}>
            <InputNumber
              value={spec.upper_limit as number | undefined}
              onChange={(v) => patch({ upper_limit: v ?? undefined })}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.target')} style={{ marginBottom: 0 }}>
            <InputNumber
              value={spec.target as number | undefined}
              onChange={(v) => patch({ target: v ?? undefined })}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item label={t('app.kuaizhizao.quality.plans.stepSpec.decimalPlaces')} style={{ marginBottom: 0 }}>
            <InputNumber
              min={0}
              max={8}
              value={(spec.decimal_places as number) ?? 4}
              onChange={(v) => patch({ decimal_places: v ?? 4 })}
              style={{ width: 80 }}
            />
          </Form.Item>
        </Space>
      </Space>
    );
  }

  if (vt === 'single_select' || vt === 'multi_select') {
    const options = (spec.options as Array<{ value: string; label: string; result?: string; defect?: boolean }>) || [];
    const updateOption = (index: number, partial: Record<string, unknown>) => {
      const next = options.map((o, i) => (i === index ? { ...o, ...partial } : o));
      patch({ options: next });
    };
    return (
      <div>
        {options.map((opt, idx) => (
          <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="center">
            <Input
              placeholder={t('app.kuaizhizao.quality.plans.stepSpec.optionValue')}
              value={opt.value}
              onChange={(e) => updateOption(idx, { value: e.target.value })}
              style={{ width: 100 }}
            />
            <Input
              placeholder={t('app.kuaizhizao.quality.plans.stepSpec.optionLabel')}
              value={opt.label}
              onChange={(e) => updateOption(idx, { label: e.target.value })}
              style={{ flex: 1, minWidth: 120 }}
            />
            {vt === 'single_select' ? (
              <Select
                value={opt.result || 'pass'}
                onChange={(v) => updateOption(idx, { result: v })}
                style={{ width: 100 }}
                options={[
                  { label: t('app.kuaizhizao.quality.common.result.qualified'), value: 'pass' },
                  { label: t('app.kuaizhizao.quality.common.result.unqualified'), value: 'fail' },
                ]}
              />
            ) : (
              <Checkbox
                checked={!!opt.defect}
                onChange={(e) => updateOption(idx, { defect: e.target.checked })}
                style={{ whiteSpace: 'nowrap', marginBottom: 0 }}
              >
                {t('app.kuaizhizao.quality.plans.stepSpec.defectOption')}
              </Checkbox>
            )}
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => patch({ options: options.filter((_, i) => i !== idx) })}
            />
          </Space>
        ))}
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            patch({
              options: [
                ...options,
                vt === 'single_select'
                  ? { value: `opt_${options.length + 1}`, label: '', result: 'pass' }
                  : { value: `opt_${options.length + 1}`, label: '', defect: false },
              ],
            })
          }
        >
          {t('app.kuaizhizao.quality.plans.stepSpec.addOption')}
        </Button>
      </div>
    );
  }

  if (vt === 'text') {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <span>{t('app.kuaizhizao.quality.plans.stepSpec.textManualHint')}</span>
        <Switch
          checked={!!spec.multiline}
          onChange={(checked) => patch({ multiline: checked })}
          checkedChildren={t('app.kuaizhizao.quality.plans.stepSpec.multiline')}
          unCheckedChildren={t('app.kuaizhizao.quality.plans.stepSpec.singleLine')}
        />
      </Space>
    );
  }

  return null;
};

export function valueTypeOptions(t: (key: string) => string) {
  const labels: Record<InspectionStepValueType, string> = {
    boolean: t('app.kuaizhizao.quality.plans.stepSpec.typeBoolean'),
    single_select: t('app.kuaizhizao.quality.plans.stepSpec.typeSingleSelect'),
    multi_select: t('app.kuaizhizao.quality.plans.stepSpec.typeMultiSelect'),
    text: t('app.kuaizhizao.quality.plans.stepSpec.typeText'),
    numeric: t('app.kuaizhizao.quality.plans.stepSpec.typeNumeric'),
  };
  return INSPECTION_STEP_VALUE_TYPES.map((v) => ({ value: v, label: labels[v] }));
}
