import type { TFunction } from 'i18next';
import React from 'react';
import { Tag } from 'antd';
import { normalizeMaterialSourceType } from '../../master-data/utils/materialSourceType';

const P = 'app.kuaicaiwu.costCommon';

const SOURCE_TYPE_COLOR: Record<string, string> = {
  Make: 'blue',
  Buy: 'green',
  Outsource: 'orange',
  Phantom: 'purple',
  Service: 'cyan',
};

const SOURCE_TYPE_I18N_KEY: Record<string, string> = {
  Make: `${P}.sourceType.make`,
  Buy: `${P}.sourceType.buy`,
  Outsource: `${P}.sourceType.outsource`,
  Phantom: `${P}.sourceType.phantom`,
  Service: `${P}.sourceType.service`,
};

export function formatSourceType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const normalized = normalizeMaterialSourceType(value);
  const key = SOURCE_TYPE_I18N_KEY[normalized];
  return key ? t(key) : normalized;
}

export function getSourceTypeTag(sourceType: string, t: TFunction): React.ReactElement {
  const normalized = normalizeMaterialSourceType(sourceType);
  const color = SOURCE_TYPE_COLOR[normalized] || 'default';
  return React.createElement(Tag, { color }, formatSourceType(sourceType, t));
}

export function getSourceTypeSelectOptions(t: TFunction) {
  return Object.keys(SOURCE_TYPE_I18N_KEY).map((value) => ({
    label: t(SOURCE_TYPE_I18N_KEY[value]),
    value,
  }));
}

const CALCULATION_TYPE_I18N_KEY: Record<string, string> = {
  工单成本: `${P}.calculationType.workOrder`,
  产品成本: `${P}.calculationType.product`,
  标准成本: `${P}.calculationType.standard`,
  实际成本: `${P}.calculationType.actual`,
};

export function formatCalculationType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = CALCULATION_TYPE_I18N_KEY[value];
  return key ? t(key) : value;
}

const VARIANCE_TYPE_I18N_KEY: Record<string, string> = {
  超支: `${P}.variance.overBudget`,
  节约: `${P}.variance.savings`,
  无差异: `${P}.variance.none`,
};

export function formatVarianceType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = VARIANCE_TYPE_I18N_KEY[value];
  return key ? t(key) : value;
}

export function getVarianceTypeTag(varianceType: string, t: TFunction): React.ReactElement {
  if (varianceType === '超支') {
    return React.createElement(Tag, { color: 'red' }, formatVarianceType(varianceType, t));
  }
  if (varianceType === '节约') {
    return React.createElement(Tag, { color: 'green' }, formatVarianceType(varianceType, t));
  }
  return React.createElement(Tag, { color: 'default' }, formatVarianceType('无差异', t));
}

const PRIORITY_COLOR: Record<string, string> = {
  高: 'red',
  中: 'orange',
  低: 'blue',
};

const PRIORITY_I18N_KEY: Record<string, string> = {
  高: `${P}.priority.high`,
  中: `${P}.priority.medium`,
  低: `${P}.priority.low`,
};

export function formatPriority(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = PRIORITY_I18N_KEY[value];
  return key ? t(key) : value;
}

export function getPriorityTag(priority: string, t: TFunction): React.ReactElement {
  const color = PRIORITY_COLOR[priority] || 'default';
  return React.createElement(Tag, { color }, formatPriority(priority, t));
}

const RULE_TYPE_COLOR: Record<string, string> = {
  材料成本: 'blue',
  人工成本: 'green',
  制造费用: 'orange',
};

const RULE_TYPE_I18N_KEY: Record<string, string> = {
  材料成本: 'app.kuaicaiwu.costRule.ruleType.material',
  人工成本: 'app.kuaicaiwu.costRule.ruleType.labor',
  制造费用: 'app.kuaicaiwu.costRule.ruleType.overhead',
};

export function formatRuleType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = RULE_TYPE_I18N_KEY[value];
  return key ? t(key) : value;
}

export function getRuleTypeTag(value: string, t: TFunction): React.ReactElement {
  const color = RULE_TYPE_COLOR[value] || 'default';
  return React.createElement(Tag, { color }, formatRuleType(value, t));
}

export function getRuleTypeSelectOptions(t: TFunction) {
  return Object.entries(RULE_TYPE_I18N_KEY).map(([value, key]) => ({
    label: t(key),
    value,
  }));
}
