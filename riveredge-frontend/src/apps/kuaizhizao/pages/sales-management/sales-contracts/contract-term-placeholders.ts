import type { SalesContractTermSnapshot } from '../../../services/sales-contract-term';

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

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
  | { type: 'placeholder'; value: string };

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
    segments.push({ type: 'placeholder', value: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: 'text', value: text }];
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
