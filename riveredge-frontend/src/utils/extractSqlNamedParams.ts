/**
 * 从数据集 SQL 中提取命名参数名（`:name` 与 `@name`）。
 * 不使用正则负向回顾 `(?<!…)`，以兼容 Safari < 16.4。
 */
export function extractSqlNamedParams(sql: string): string[] {
  const masked = sql.replace(/::/g, '__PG_CAST__');
  const set = new Set<string>();
  let m: RegExpExecArray | null;

  const reColon = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  while ((m = reColon.exec(masked)) !== null) {
    const name = m[1];
    if (name && !name.startsWith('__PG')) set.add(name);
  }

  // 匹配 @param，排除 @@variable（用 (^|[^@]) 代替 (?<!@)）
  const reAt = /(^|[^@])@([a-zA-Z_][a-zA-Z0-9_]*)/g;
  while ((m = reAt.exec(sql)) !== null) {
    set.add(m[2]);
  }

  return [...set];
}
