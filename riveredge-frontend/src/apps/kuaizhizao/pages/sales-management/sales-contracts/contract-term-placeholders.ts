import type { SalesContractTermSnapshot } from '../../../services/sales-contract-term';

/** 从文本中提取 `{占位符}`，去重并保持顺序 */
export function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
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

export function applyPlaceholders(text: string, values: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{([^{}]+)\}/g, (_, raw: string) => {
    const key = raw.trim();
    const val = values[key];
    return val != null && val !== '' ? val : `{${key}}`;
  });
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
  values: Record<string, string>,
): SalesContractTermSnapshot[] {
  return templates.map((term) => {
    const template = term.template_content ?? term.content ?? '';
    const resolved = applyPlaceholders(template, values);
    const filledValues = Object.fromEntries(
      extractPlaceholders(template)
        .filter((k) => values[k] != null && values[k] !== '')
        .map((k) => [k, values[k]]),
    );
    return {
      ...term,
      template_content: template,
      content: resolved,
      placeholder_values: Object.keys(filledValues).length ? filledValues : undefined,
    };
  });
}
