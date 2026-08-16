/** 行情定价浮动公式：仅行情价、系数与四则运算。 */

export const DEFAULT_MARKET_FLOAT_FORMULA = '行情价';

/** 把旧的用量系数写进公式，系数只存在于浮动公式。 */
export function bakeQtyFactorIntoFormula(raw: unknown, factor: number): string {
  const text = String(raw ?? '').trim() || DEFAULT_MARKET_FLOAT_FORMULA;
  if (!/系数|\bfactor\b/.test(text)) return text;
  const qty = factor > 0 ? factor : 1;
  return text.replace(/系数/g, String(qty)).replace(/\bfactor\b/g, String(qty));
}

const ALIASES: Array<[string, string]> = [
  ['行情价', 'quote'],
  ['系数', 'factor'],
  ['×', '*'],
  ['÷', '/'],
  ['＋', '+'],
  ['－', '-'],
];

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: 'quote' | 'factor' }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' };

export function normalizeMarketFloatFormula(raw: unknown): string {
  let text = String(raw ?? '').trim();
  if (!text) return 'quote * factor';
  for (const [src, dst] of ALIASES) {
    text = text.split(src).join(dst);
  }
  return text.replace(/\s+/g, '');
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (expr.startsWith('quote', i)) {
      tokens.push({ kind: 'id', value: 'quote' });
      i += 5;
      continue;
    }
    if (expr.startsWith('factor', i)) {
      tokens.push({ kind: 'id', value: 'factor' });
      i += 6;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < expr.length && /[\d.]/.test(expr[j])) j += 1;
      const value = Number(expr.slice(i, j));
      if (!Number.isFinite(value)) {
        throw new Error('浮动公式无效');
      }
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    throw new Error('浮动公式只能使用行情价、系数与加减乘除');
  }
  return tokens;
}

class FormulaParser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly names: { quote: number; factor: number },
  ) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.pos !== this.tokens.length) {
      throw new Error('浮动公式无效');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private take(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error('浮动公式无效');
    this.pos += 1;
    return token;
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    while (this.peek()?.kind === 'op' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.take().value;
      const right = this.parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (this.peek()?.kind === 'op' && (this.peek()?.value === '*' || this.peek()?.value === '/')) {
      const op = this.take().value;
      const right = this.parseUnary();
      if (op === '/') {
        if (right === 0) throw new Error('浮动公式除数不能为0');
        value /= right;
      } else {
        value *= right;
      }
    }
    return value;
  }

  private parseUnary(): number {
    if (this.peek()?.kind === 'op' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.take().value;
      const value = this.parseUnary();
      return op === '-' ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.take();
    if (token.kind === 'num') return token.value;
    if (token.kind === 'id') return this.names[token.value];
    if (token.kind === 'op' && token.value === '(') {
      const value = this.parseExpr();
      const close = this.take();
      if (close.kind !== 'op' || close.value !== ')') {
        throw new Error('浮动公式无效');
      }
      return value;
    }
    throw new Error('浮动公式只能使用行情价、系数与加减乘除');
  }
}

export function evaluateMarketFloatFormula(raw: unknown, quote: number, factor: number): number {
  const expr = normalizeMarketFloatFormula(raw);
  const parser = new FormulaParser(tokenize(expr), { quote, factor });
  return parser.parse();
}
