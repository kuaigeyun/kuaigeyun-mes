/**
 * Univer 文档转 HTML 工具
 *
 * 在 dataStream 中替换 {{key}} 变量后，使用 Univer 的 convertBodyToHtml 生成带格式的 HTML，
 * 保留加粗、表格、字体等样式。
 */

import { convertBodyToHtml } from '@univerjs/docs-ui';

function resolveValue(key: string, vars: Record<string, unknown>): unknown {
  const keys = key.split('.');
  let val: unknown = vars;
  for (const k of keys) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
      val = (val as Record<string, unknown>)[k];
    } else if (Array.isArray(val) && /^\d+$/.test(k)) {
      val = val[parseInt(k, 10)];
    } else {
      return '';
    }
  }
  return val !== undefined && val !== null ? val : '';
}

function formatValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
  return String(val);
}

/**
 * 检测 content 是否为 Univer 文档格式
 */
export function isUniverDocument(content: string): boolean {
  try {
    const obj = JSON.parse(content);
    return typeof obj === 'object' && obj?.body && typeof obj.body === 'object';
  } catch {
    return false;
  }
}

/**
 * 在 Univer 文档的 dataStream 中替换 {{key}} 占位符
 */
export function replaceVariablesInUniverDoc(
  doc: Record<string, unknown>,
  variables: Record<string, unknown>
): Record<string, unknown> {
  const body = doc.body as Record<string, unknown> | undefined;
  if (!body || typeof body.dataStream !== 'string') return doc;

  const dataStream = body.dataStream as string;
  const pattern = /\{\{([^}]+)\}\}/g;
  const matches = [...dataStream.matchAll(pattern)];

  let result = dataStream;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const key = m[1].trim();
    const value = resolveValue(key, variables);
    const strValue = formatValue(value);
    result = result.slice(0, m.index) + strValue + result.slice(m.index! + m[0].length);
  }

  const newDoc = JSON.parse(JSON.stringify(doc));
  (newDoc.body as Record<string, unknown>).dataStream = result;
  return newDoc;
}

/**
 * 将 Univer 模板（含变量占位符）渲染为带格式的 HTML
 *
 * @param templateContent - 模板 JSON 字符串（Univer 格式）
 * @param variables - 变量数据
 * @returns HTML 字符串，若模板非 Univer 格式则返回空字符串
 */
export function renderUniverTemplateToHtml(
  templateContent: string,
  variables: Record<string, unknown>
): string {
  if (!isUniverDocument(templateContent)) return '';

  try {
    const doc = JSON.parse(templateContent) as Record<string, unknown>;
    const rendered = replaceVariablesInUniverDoc(doc, variables);
    return convertBodyToHtml(rendered as any);
  } catch (e) {
    console.error('[univerDocToHtml] render failed:', e);
    return '';
  }
}
