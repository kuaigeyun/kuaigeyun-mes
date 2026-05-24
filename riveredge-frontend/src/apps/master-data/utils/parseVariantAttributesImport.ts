/**
 * 解析导入表格中的属性组合列
 * 支持：颜色=黑色;产品结构=单层 或 JSON {"颜色":"黑色"}
 */

export function parseVariantAttributesImport(raw: string): Record<string, unknown> {
  const text = (raw ?? '').trim();
  if (!text) {
    throw new Error('属性组合不能为空');
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('属性组合 JSON 须为对象');
      }
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v == null || v === '') continue;
        result[k.trim()] = v;
      }
      if (Object.keys(result).length === 0) {
        throw new Error('属性组合不能为空');
      }
      return result;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('属性组合')) throw e;
      throw new Error('属性组合 JSON 格式无效');
    }
  }

  const result: Record<string, unknown> = {};
  for (const part of text.split(/[;；]/)) {
    const seg = part.trim();
    if (!seg) continue;
    const sep = seg.match(/^([^=:=]+)[=:=](.+)$/);
    if (!sep) {
      throw new Error(`属性组合格式错误（应为 属性名=值，多项用分号分隔）: ${seg}`);
    }
    const key = sep[1].trim();
    const val = sep[2].trim();
    if (!key || !val) {
      throw new Error(`属性组合格式错误: ${seg}`);
    }
    result[key] = val;
  }

  if (Object.keys(result).length === 0) {
    throw new Error('属性组合不能为空');
  }
  return result;
}

export function parseImportBool(val: unknown): boolean {
  const v = String(val ?? '')
    .trim()
    .toLowerCase();
  if (!v) return false;
  return ['1', 'true', 'yes', 'y', '是', '启用', 'on'].includes(v);
}

export function isSkuImportRowType(val: unknown): boolean {
  const v = String(val ?? '')
    .trim()
    .toLowerCase();
  if (!v) return false;
  return v === 'sku' || v === 'sku行' || v === '属性sku' || v === '属性组合' || v === '组合';
}
