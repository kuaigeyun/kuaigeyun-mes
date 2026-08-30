import type { SalesContractTermSnapshot } from '../../../services/sales-contract-term';

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

const CN_DIGITS = '零一二三四五六七八九';

/** 条款列表序号：1→一，10→十，11→十一（与打印 contract_terms 一致） */
export function intToChineseSimple(n: number): string {
  if (n <= 0 || !Number.isFinite(n)) return String(n);
  const i = Math.floor(n);
  if (i < 10) return CN_DIGITS[i]!;
  if (i === 10) return '十';
  if (i < 20) return `十${CN_DIGITS[i % 10]}`;
  if (i < 100) {
    const tens = Math.floor(i / 10);
    const ones = i % 10;
    return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`;
  }
  return String(i);
}

/** 合同条款大项序号展示：一、付款方式 */
export function formatContractTermHeading(indexZeroBased: number, termName: string): string {
  return `${intToChineseSimple(indexZeroBased + 1)}、${termName}`;
}

export function isFieldBindingKey(key: string): boolean {
  return key.startsWith('@');
}

/** `{@payment_terms}` → `payment_terms` */
export function normalizeFieldBindingKey(key: string): string {
  return key.startsWith('@') ? key.slice(1).trim() : key.trim();
}

/** 表头字段绑定注册表：`{@字段名}` 自动取自合同表头 */
export const CONTRACT_TERM_FIELD_BINDINGS: Record<
  string,
  { dictionaryCode?: string; date?: boolean }
> = {
  payment_terms: { dictionaryCode: 'PAYMENT_TERMS' },
  shipping_method: { dictionaryCode: 'SHIPPING_METHOD' },
  currency_code: { dictionaryCode: 'CURRENCY' },
  customer_name: {},
  customer_contact: {},
  customer_phone: {},
  shipping_address: {},
  salesman_name: {},
  contract_type: {},
  contract_date: { date: true },
  valid_from: { date: true },
  valid_to: { date: true },
};

/** 表头字段展示顺序（与合同表单一致） */
export const CONTRACT_TERM_FIELD_BINDING_ORDER = [
  'payment_terms',
  'shipping_method',
  'currency_code',
  'customer_name',
  'customer_contact',
  'customer_phone',
  'shipping_address',
  'salesman_name',
  'contract_type',
  'contract_date',
  'valid_from',
  'valid_to',
] as const;

/** i18n label key，与 `CONTRACT_TERM_FIELD_BINDINGS` 字段名对应 */
export const CONTRACT_TERM_FIELD_BINDING_LABEL_KEYS: Record<string, string> = {
  payment_terms: 'app.kuaizhizao.salesOrder.paymentTerms',
  shipping_method: 'app.kuaizhizao.salesOrder.shippingMethod',
  currency_code: 'app.kuaizhizao.salesContract.currency',
  customer_name: 'app.kuaizhizao.salesContract.customer',
  customer_contact: 'app.kuaizhizao.salesOrder.customerContact',
  customer_phone: 'app.kuaizhizao.salesOrder.customerPhone',
  shipping_address: 'app.kuaizhizao.salesOrder.shippingAddress',
  salesman_name: 'app.kuaizhizao.salesOrder.salesman',
  contract_type: 'app.kuaizhizao.salesContract.contractType',
  contract_date: 'app.kuaizhizao.salesContract.contractDate',
  valid_from: 'app.kuaizhizao.salesContract.validFrom',
  valid_to: 'app.kuaizhizao.salesContract.validTo',
};

/** 从文本中提取手动占位符 `{占位符名}`（不含 `{@字段}`） */
export function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    if (!key || isFieldBindingKey(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** 从文本中提取表头字段绑定 `{@payment_terms}` → `payment_terms` */
export function extractFieldBindings(text: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!isFieldBindingKey(raw)) continue;
    const field = normalizeFieldBindingKey(raw);
    if (!field || seen.has(field)) continue;
    seen.add(field);
    keys.push(field);
  }
  return keys;
}

export function extractPlaceholdersFromTerms(terms: SalesContractTermSnapshot[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const source = term.template_content ?? term.content ?? '';
    for (const key of extractPlaceholders(source)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

export function extractFieldBindingsFromTerms(terms: SalesContractTermSnapshot[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const source = term.template_content ?? term.content ?? '';
    for (const key of extractFieldBindings(source)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

export type ContractTermFieldBindingContext = {
  dictionaryLabelsByCode: Record<string, Record<string, string> | undefined>;
  contractTypeLabels?: Record<string, string>;
  formatDate?: (value: unknown) => string;
};

function fieldBindingValueKey(field: string): string {
  return `@${field}`;
}

function resolveSingleFieldBinding(
  field: string,
  formValues: Record<string, unknown>,
  context: ContractTermFieldBindingContext,
): string | undefined {
  const raw = formValues[field];
  if (raw == null || raw === '') return undefined;

  const spec = CONTRACT_TERM_FIELD_BINDINGS[field];
  if (spec?.dictionaryCode) {
    const label = context.dictionaryLabelsByCode[spec.dictionaryCode]?.[String(raw)];
    return label ?? String(raw);
  }
  if (spec?.date && context.formatDate) {
    const formatted = context.formatDate(raw);
    return formatted || undefined;
  }
  if (field === 'contract_type' && context.contractTypeLabels) {
    return context.contractTypeLabels[String(raw)] ?? String(raw);
  }
  const text = String(raw).trim();
  return text || undefined;
}

/** 将表头表单值解析为 `{@field}` 占位符取值 */
export function resolveContractTermFieldBindings(
  formValues: Record<string, unknown>,
  context: ContractTermFieldBindingContext,
  requestedFields?: string[],
): Record<string, string> {
  const fields =
    requestedFields ??
    Object.keys(CONTRACT_TERM_FIELD_BINDINGS).filter(
      (f) => formValues[f] != null && formValues[f] !== '',
    );
  const result: Record<string, string> = {};
  for (const field of fields) {
    const val = resolveSingleFieldBinding(field, formValues, context);
    if (val != null && val !== '') {
      result[field] = val;
    }
  }
  return result;
}

function mergePlaceholderValues(
  manualValues: Record<string, string>,
  fieldBindingValues: Record<string, string>,
): Record<string, string> {
  const merged = { ...manualValues };
  for (const [field, val] of Object.entries(fieldBindingValues)) {
    merged[fieldBindingValueKey(field)] = val;
  }
  return merged;
}

export function applyPlaceholders(text: string, values: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{([^{}]+)\}/g, (_, raw: string) => {
    const key = raw.trim();
    const val = values[key];
    return val != null && val !== '' ? val : `{${key}}`;
  });
}

export type PlaceholderTextSegment =
  | { type: 'text'; value: string }
  | { type: 'placeholder'; value: string; filled: boolean };

type TemplatePart =
  | { type: 'text'; value: string }
  | { type: 'placeholder'; key: string };

function splitTemplateParts(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: 'text', value: template.slice(lastIndex, m.index) });
    }
    parts.push({ type: 'placeholder', key: m[1].trim() });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ type: 'text', value: template.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: 'text', value: template }];
}

/**
 * 用模板与已解析正文对齐，推断各占位符当前展示值。
 * 已填：抽出实际文案；未填：正文仍为 `{key}`，不写入结果。
 */
export function inferPlaceholderValuesFromResolved(
  template: string,
  resolved: string,
): Record<string, string> {
  if (!template || !resolved) return {};
  const parts = splitTemplateParts(template);
  const result: Record<string, string> = {};
  let cursor = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.type === 'text') {
      if (resolved.slice(cursor, cursor + part.value.length) !== part.value) {
        return result;
      }
      cursor += part.value.length;
      continue;
    }

    const nextText = parts.slice(i + 1).find((p): p is Extract<TemplatePart, { type: 'text' }> => p.type === 'text');
    const unresolved = `{${part.key}}`;
    let end: number;
    if (!nextText) {
      end = resolved.length;
    } else {
      end = resolved.indexOf(nextText.value, cursor);
      if (end < 0) return result;
    }
    const extracted = resolved.slice(cursor, end);
    if (extracted !== unresolved && extracted !== '') {
      result[part.key] = extracted;
    }
    cursor = end;
  }
  return result;
}

/** 按模板拆分预览片段；已填与未填占位均标记为 placeholder */
export function splitTermPreviewSegments(
  template: string,
  values: Record<string, string> = {},
): PlaceholderTextSegment[] {
  if (!template) return [];
  const parts = splitTemplateParts(template);
  return parts.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', value: part.value };
    }
    const val = values[part.key];
    if (val != null && val !== '') {
      return { type: 'placeholder', value: val, filled: true };
    }
    return { type: 'placeholder', value: `{${part.key}}`, filled: false };
  });
}

/** 将仍含 `{...}` 的预览文本拆成普通片段与未填占位符片段 */
export function splitUnresolvedPlaceholderSegments(text: string): PlaceholderTextSegment[] {
  if (!text) return [];
  const segments: PlaceholderTextSegment[] = [];
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    segments.push({ type: 'placeholder', value: m[0], filled: false });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: 'text', value: text }];
}

/** 条款预览：优先按模板拆分（已填/未填均粗体下划线），无模板则仅高亮未填 `{...}` */
export function buildTermPreviewSegments(
  content: string,
  template?: string,
  values?: Record<string, string>,
): PlaceholderTextSegment[] {
  const tpl = (template ?? '').trim() ? template! : '';
  if (!tpl) {
    return splitUnresolvedPlaceholderSegments(content);
  }
  const mergedValues = {
    ...inferPlaceholderValuesFromResolved(tpl, content),
    ...(values ?? {}),
  };
  return splitTermPreviewSegments(tpl, mergedValues);
}

export function buildTermTemplatesFromGroupItems(
  items: Array<{ term_item_id: number; term_name: string; content: string; sort_order?: number }>,
): SalesContractTermSnapshot[] {
  return items.map((it, idx) => ({
    term_item_id: it.term_item_id,
    term_name: it.term_name,
    template_content: it.content,
    content: it.content,
    sort_order: it.sort_order ?? idx,
  }));
}

export function resolveTermsWithPlaceholders(
  templates: SalesContractTermSnapshot[],
  manualValues: Record<string, string>,
  fieldBindingValues?: Record<string, string>,
): SalesContractTermSnapshot[] {
  const mergedValues = mergePlaceholderValues(manualValues, fieldBindingValues ?? {});
  return templates.map((term) => {
    const template = term.template_content ?? term.content ?? '';
    const resolved = applyPlaceholders(template, mergedValues);
    const filledValues = Object.fromEntries(
      extractPlaceholders(template)
        .filter((k) => manualValues[k] != null && manualValues[k] !== '')
        .map((k) => [k, manualValues[k]]),
    );
    return {
      ...term,
      template_content: template,
      content: resolved,
      placeholder_values: Object.keys(filledValues).length ? filledValues : undefined,
    };
  });
}
