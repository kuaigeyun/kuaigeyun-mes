/** 销售赠品行 UI 辅助（物料可赠送 + 行勾选） */

export function resolveMaterialGiftable(material: unknown): boolean {
  if (!material || typeof material !== 'object') return false;
  const row = material as Record<string, unknown>;
  return Boolean(row.isGiftable ?? row.is_giftable);
}

export function applyGiftToggleToLine<T extends Record<string, unknown>>(
  line: T,
  checked: boolean,
  material?: unknown,
): T {
  if (checked && !resolveMaterialGiftable(material)) {
    return line;
  }
  if (checked) {
    const currentPrice = Number(line.unit_price) || 0;
    return {
      ...line,
      is_gift: true,
      gift_ref_unit_price:
        line.gift_ref_unit_price ?? (currentPrice > 0 ? currentPrice : undefined),
      unit_price: 0,
    };
  }
  return {
    ...line,
    is_gift: false,
  };
}

export function mapGiftFieldsForSubmit(line: Record<string, unknown>) {
  const isGift = Boolean(line.is_gift);
  return {
    is_gift: isGift,
    gift_ref_unit_price: isGift ? line.gift_ref_unit_price ?? undefined : undefined,
    unit_price: isGift ? 0 : line.unit_price,
  };
}

export function isValidSalesLineForSubmit(line: Record<string, unknown>, quantityField: string): boolean {
  if (!line.material_id || Number(line[quantityField]) <= 0) return false;
  if (line.is_gift) return true;
  return Number(line.unit_price) > 0;
}
