import React from 'react';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';
import { normalizeValueType, type InspectionStepValueType } from '../types/inspectionStepSpec';

const VALUE_TYPE_TAG_COLOR: Record<InspectionStepValueType, string> = {
  boolean: 'geekblue',
  single_select: 'blue',
  multi_select: 'purple',
  text: 'gold',
  numeric: 'green',
};

export function InspectionValueTypeTag({
  valueType,
  label,
}: {
  valueType?: string | null;
  label: string;
}) {
  const vt = normalizeValueType(valueType || 'boolean');
  return (
    <Tag bordered color={VALUE_TYPE_TAG_COLOR[vt]} style={{ marginInlineEnd: 0 }}>
      {label}
    </Tag>
  );
}

export function InspectionSamplingTypeTag({
  samplingType,
  t,
}: {
  samplingType?: string | null;
  t: TFunction;
}) {
  const isSampling = samplingType === 'sampling';
  const label = isSampling
    ? t('app.kuaizhizao.quality.plans.step.sampling')
    : t('app.kuaizhizao.quality.plans.step.fullInspection');
  return (
    <Tag bordered color={isSampling ? 'orange' : 'cyan'} style={{ marginInlineEnd: 0 }}>
      {label}
    </Tag>
  );
}
