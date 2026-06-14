/**
 * 自定义字段公式求值工具
 *
 * 表达式格式：{字段代码} 引用同表自定义字段值，支持 + - * / ( ) 基本运算。
 */

const FIELD_REF_PATTERN = /\{([^}]+)\}/g;
const SAFE_MATH_PATTERN = /^[\d\s+\-*/().]+$/;

export function extractFormulaFieldCodes(expression?: string): string[] {
  if (!expression) return [];
  const codes = new Set<string>();
  for (const match of expression.matchAll(FIELD_REF_PATTERN)) {
    const code = match[1]?.trim();
    if (code) codes.add(code);
  }
  return Array.from(codes);
}

function toOperandNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function substituteFormulaExpression(
  expression: string,
  operandValues: Record<string, unknown>,
): string {
  return expression.replace(FIELD_REF_PATTERN, (_, rawCode: string) => {
    const code = rawCode.trim();
    return String(toOperandNumber(operandValues[code]));
  });
}

export function evaluateMathExpression(expression: string): number | null {
  const normalized = expression.replace(/\s+/g, '');
  if (!normalized) return null;
  if (!SAFE_MATH_PATTERN.test(normalized)) return null;
  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return Math.round(result * 10000) / 10000;
  } catch {
    return null;
  }
}

export function evaluateCustomFieldFormula(
  expression: string | undefined,
  operandValues: Record<string, unknown>,
): number | null {
  if (!expression?.trim()) return null;
  const substituted = substituteFormulaExpression(expression, operandValues);
  return evaluateMathExpression(substituted);
}
