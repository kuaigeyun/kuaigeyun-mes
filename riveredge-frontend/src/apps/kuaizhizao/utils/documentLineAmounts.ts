import { getCachedNumericPrecisionPlaces } from '../../../hooks/useNumericPrecision';
import { normalizeFormListItems } from '../../../utils/formListItems';
import { formatCurrencyAmount } from '../../../utils/format';

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** 金额最小单位（跟随 common.amount_decimal_places，禁止写死「分」） */
function getAmountPlaces(): number {
  return getCachedNumericPrecisionPlaces('amount');
}

function getAmountScale(places = getAmountPlaces()): number {
  return 10 ** Math.max(0, places);
}

const toAmountUnits = (value: unknown, scale = getAmountScale()): number =>
  Math.round(toSafeNumber(value) * scale);

const fromAmountUnits = (units: number, scale = getAmountScale()): number => units / scale;

/**
 * 单据明细行价税拆分（销售/报价/合同/采购共用）。
 * 先 qty×单价再按金额小数位舍入；禁止先把单价压成 2 位（否则 0.195×1 会变成 0.20）。
 */
export function calcDocumentLineAmounts(
  qtyInput: unknown,
  priceInput: unknown,
  taxRateInput: unknown,
  priceTypeInput?: string,
) {
  const qty = toSafeNumber(qtyInput);
  const unitPrice = toSafeNumber(priceInput);
  const taxRate = toSafeNumber(taxRateInput);
  const priceType = priceTypeInput ?? 'tax_exclusive';
  const scale = getAmountScale();

  if (priceType === 'tax_inclusive') {
    const inclUnits = Math.round(qty * unitPrice * scale);
    const exclUnits = Math.round(inclUnits / (1 + taxRate / 100));
    const taxUnits = inclUnits - exclUnits;
    return {
      excl: fromAmountUnits(exclUnits, scale),
      tax: fromAmountUnits(taxUnits, scale),
      incl: fromAmountUnits(inclUnits, scale),
    };
  }

  const exclUnits = Math.round(qty * unitPrice * scale);
  const taxUnits = Math.round((exclUnits * taxRate) / 100);
  return {
    excl: fromAmountUnits(exclUnits, scale),
    tax: fromAmountUnits(taxUnits, scale),
    incl: fromAmountUnits(exclUnits + taxUnits, scale),
  };
}

const roundToPlaces = (value: number, places: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(places) || places < 0) return value;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** 价税合计为真源时反算未税/税额（允许与 qty×单价舍入结果存在尾差） */
export function calcDocumentLineAmountsFromInclTotal(inclTotal: unknown, taxRateInput: unknown) {
  const scale = getAmountScale();
  const inclUnits = toAmountUnits(inclTotal, scale);
  const taxRate = toSafeNumber(taxRateInput);
  const factor = 1 + taxRate / 100;
  const exclUnits = factor > 0 ? Math.round(inclUnits / factor) : inclUnits;
  const taxUnits = inclUnits - exclUnits;
  return {
    excl: fromAmountUnits(exclUnits, scale),
    tax: fromAmountUnits(taxUnits, scale),
    incl: fromAmountUnits(inclUnits, scale),
  };
}

/** 未税金额为真源时正算税额/价税合计 */
export function calcDocumentLineAmountsFromExclTotal(exclTotal: unknown, taxRateInput: unknown) {
  const scale = getAmountScale();
  const exclUnits = toAmountUnits(exclTotal, scale);
  const taxRate = toSafeNumber(taxRateInput);
  const taxUnits = Math.round((exclUnits * taxRate) / 100);
  return {
    excl: fromAmountUnits(exclUnits, scale),
    tax: fromAmountUnits(taxUnits, scale),
    incl: fromAmountUnits(exclUnits + taxUnits, scale),
  };
}

function hasFiniteStoredLineAmount(value: unknown): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

/**
 * 明细行展示金额：已存 item_amount 时以之为真源拆分；否则按 qty×单价计算。
 * 含税价类 item_amount=价税合计；不含税价类 item_amount=未税金额。
 */
export function resolveDocumentLineDisplayAmounts(
  row: {
    qty?: unknown;
    unit_price?: unknown;
    tax_rate?: unknown;
    item_amount?: unknown;
    is_gift?: unknown;
  },
  priceType: string | undefined,
): { excl: number; tax: number; incl: number } {
  const pt = priceType ?? 'tax_exclusive';
  if (row.is_gift) {
    return { excl: 0, tax: 0, incl: 0 };
  }
  if (hasFiniteStoredLineAmount(row.item_amount)) {
    if (pt === 'tax_inclusive') {
      return calcDocumentLineAmountsFromInclTotal(row.item_amount, row.tax_rate);
    }
    return calcDocumentLineAmountsFromExclTotal(row.item_amount, row.tax_rate);
  }
  return calcDocumentLineAmounts(row.qty, row.unit_price, row.tax_rate, pt);
}

/**
 * 用户录入价税合计：合计为真源，反算单价（按单价小数位量化）并写回落库行金额。
 * 解决「8500 → 反算单价分币 → 再乘数量变成 8500.32」尾差回写。
 */
export function applyDocumentLineInclAmountEdit(opts: {
  qty: unknown;
  taxRate: unknown;
  priceType: string | undefined;
  inclAmount: unknown;
  priceDecimals?: number;
}): {
  unit_price: number;
  item_amount: number;
  excl: number;
  tax: number;
  incl: number;
} {
  const qty = toSafeNumber(opts.qty);
  const pt = opts.priceType ?? 'tax_exclusive';
  const amounts = calcDocumentLineAmountsFromInclTotal(opts.inclAmount, opts.taxRate);
  const rawUnit =
    qty > 0 ? (pt === 'tax_inclusive' ? amounts.incl / qty : amounts.excl / qty) : 0;
  const unit_price =
    opts.priceDecimals != null ? roundToPlaces(rawUnit, opts.priceDecimals) : rawUnit;
  return {
    unit_price,
    item_amount: pt === 'tax_inclusive' ? amounts.incl : amounts.excl,
    ...amounts,
  };
}

/**
 * 单据价类切换（含税 ↔ 不含税）：以当前行金额为真源，再反算新单价。
 *
 * 禁止「先把单价按税率换算再 × 数量」——分币单价无法整除时会产生价差
 * （例：含税单价 305.56 × 72 → 未税 19469.31；若先换成 270.41 再乘得 19469.52）。
 */
export function convertDocumentLineForPriceTypeChange(opts: {
  qty: unknown;
  unit_price: unknown;
  tax_rate: unknown;
  item_amount?: unknown;
  is_gift?: unknown;
  fromPriceType: string;
  toPriceType: string;
  priceDecimals?: number;
}): { unit_price: number; item_amount: number; excl: number; tax: number; incl: number } {
  const fromType = opts.fromPriceType || 'tax_exclusive';
  const toType = opts.toPriceType || 'tax_exclusive';
  const amounts = resolveDocumentLineDisplayAmounts(
    {
      qty: opts.qty,
      unit_price: opts.unit_price,
      tax_rate: opts.tax_rate,
      item_amount: opts.item_amount,
      is_gift: opts.is_gift,
    },
    fromType,
  );
  if (fromType === toType) {
    return {
      unit_price: toSafeNumber(opts.unit_price),
      item_amount: resolveSalesDocumentStoredLineAmount(amounts, toType),
      ...amounts,
    };
  }
  const qty = toSafeNumber(opts.qty);
  const targetTotal = toType === 'tax_inclusive' ? amounts.incl : amounts.excl;
  const rawUnit = qty > 0 ? targetTotal / qty : 0;
  const decimals = opts.priceDecimals != null ? opts.priceDecimals : 2;
  const unit_price = roundToPlaces(rawUnit, decimals);
  return {
    unit_price,
    item_amount: targetTotal,
    ...amounts,
  };
}

/**
 * 表单专用：不含税→含税且当时税率为 0 时记下未税单价锚点。
 * 用户随后在含税模式下填写税率时，按该锚点换算含税单价，避免把未税录入误当含税。
 * 不落库；提交时须 omit。
 */
export const EXCLUSIVE_UNIT_ANCHOR_KEY = 'exclusive_unit_anchor' as const;

export function stripExclusiveUnitAnchor<T extends Record<string, unknown>>(row: T): T {
  if (!Object.prototype.hasOwnProperty.call(row, EXCLUSIVE_UNIT_ANCHOR_KEY)) return row;
  const next = { ...row };
  delete (next as Record<string, unknown>)[EXCLUSIVE_UNIT_ANCHOR_KEY];
  return next;
}

/** 价类切换写回行时附带/清除未税单价锚点 */
export function withExclusiveUnitAnchorOnPriceTypeSwitch<T extends Record<string, unknown>>(
  row: T,
  converted: { unit_price: number; item_amount: number },
  fromPriceType: string,
  toPriceType: string,
  taxRate: unknown,
): T & { unit_price: number; item_amount: number } {
  const base = stripExclusiveUnitAnchor(row);
  const fromType = fromPriceType || 'tax_exclusive';
  const toType = toPriceType || 'tax_exclusive';
  const tax = toSafeNumber(taxRate);
  const unitBefore = toSafeNumber(row.unit_price);
  if (
    fromType === 'tax_exclusive' &&
    toType === 'tax_inclusive' &&
    tax === 0 &&
    !row.is_gift &&
    unitBefore > 0
  ) {
    return {
      ...base,
      unit_price: converted.unit_price,
      item_amount: converted.item_amount,
      [EXCLUSIVE_UNIT_ANCHOR_KEY]: unitBefore,
    };
  }
  return {
    ...base,
    unit_price: converted.unit_price,
    item_amount: converted.item_amount,
  };
}

/**
 * 税率变更：若存在未税锚点且当前为含税价类，按锚点未税单价正算含税单价；
 * 否则保持单价不变、仅按价类重算行金额（默认含税录入填税率不抬价）。
 */
export function applyDocumentLineTaxRateChange(opts: {
  row: Record<string, unknown>;
  qty: unknown;
  newTaxRate: unknown;
  priceType: string | undefined;
  priceDecimals?: number;
}): Record<string, unknown> {
  const tax_rate = toSafeNumber(opts.newTaxRate);
  const pt = opts.priceType ?? 'tax_exclusive';
  const anchorRaw = opts.row[EXCLUSIVE_UNIT_ANCHOR_KEY];
  const base = stripExclusiveUnitAnchor(opts.row);

  if (
    pt === 'tax_inclusive' &&
    anchorRaw != null &&
    Number.isFinite(Number(anchorRaw)) &&
    Number(anchorRaw) > 0 &&
    tax_rate > 0
  ) {
    const exclUnit = Number(anchorRaw);
    const amounts = calcDocumentLineAmounts(opts.qty, exclUnit, tax_rate, 'tax_exclusive');
    const qty = toSafeNumber(opts.qty);
    const rawUnit = qty > 0 ? amounts.incl / qty : 0;
    const unit_price =
      opts.priceDecimals != null ? roundToPlaces(rawUnit, opts.priceDecimals) : rawUnit;
    return {
      ...base,
      unit_price,
      tax_rate,
      item_amount: amounts.incl,
    };
  }

  const unit_price = toSafeNumber(opts.row.unit_price);
  return {
    ...base,
    unit_price,
    tax_rate,
    item_amount: recalcDocumentStoredLineAmount(
      {
        qty: opts.qty,
        unit_price,
        tax_rate,
        is_gift: opts.row.is_gift,
      },
      pt,
    ),
  };
}

/** 按 qty×单价重算落库行金额（数量/单价/税率变更时） */
export function recalcDocumentStoredLineAmount(
  row: {
    qty?: unknown;
    unit_price?: unknown;
    tax_rate?: unknown;
    is_gift?: unknown;
  },
  priceType: string | undefined,
): number {
  if (row.is_gift) return 0;
  const line = calcDocumentLineAmounts(row.qty, row.unit_price, row.tax_rate, priceType);
  return resolveSalesDocumentStoredLineAmount(line, priceType);
}

export interface DocumentGoodsTotals {
  totalQuantity: number;
  goodsExcl: number;
  taxAmount: number;
  goodsIncl: number;
}

export interface DocumentTotalsWithDiscount extends DocumentGoodsTotals {
  discountAmount: number;
  goodsAfterDiscount: number;
}

export interface SalesDocumentTotals extends DocumentTotalsWithDiscount {
  customerFees: number;
  ourFees: number;
  estimatedReceivable: number;
}

export interface PurchaseDocumentTotals extends DocumentGoodsTotals {
  otherSideFees: number;
  ourSideFees: number;
  estimatedPayable: number;
  estimatedTotalCost: number;
}

type LineReader = (row: Record<string, unknown>) => {
  qty: unknown;
  price: unknown;
  taxRate: unknown;
};

function sumFeeAmounts(feeDetails: unknown[] | undefined) {
  const scale = getAmountScale();
  let otherSideUnits = 0;
  let ourSideUnits = 0;
  for (const fee of normalizeFormListItems<Record<string, unknown>>(feeDetails)) {
    const feeUnits = toAmountUnits(fee?.amount, scale);
    if (fee?.bearer === 'other_side') otherSideUnits += feeUnits;
    else ourSideUnits += feeUnits;
  }
  return {
    otherSide: fromAmountUnits(otherSideUnits, scale),
    ourSide: fromAmountUnits(ourSideUnits, scale),
  };
}

/** 汇总明细行货值、税额、含税货值 */
export function computeDocumentGoodsTotals(
  items: unknown[] | undefined,
  priceType: string | undefined,
  readLine: LineReader,
): DocumentGoodsTotals {
  const rows = normalizeFormListItems<Record<string, unknown>>(items);
  const pt = priceType ?? 'tax_exclusive';
  const scale = getAmountScale();
  let totalQuantity = 0;
  let goodsExclUnits = 0;
  let taxAmountUnits = 0;
  let goodsInclUnits = 0;

  for (const row of rows) {
    const { qty, price, taxRate } = readLine(row);
    totalQuantity += toSafeNumber(qty);
    const line = resolveDocumentLineDisplayAmounts(
      {
        qty,
        unit_price: price,
        tax_rate: taxRate,
        item_amount: row.item_amount,
        is_gift: row.is_gift,
      },
      pt,
    );
    goodsExclUnits += toAmountUnits(line.excl, scale);
    taxAmountUnits += toAmountUnits(line.tax, scale);
    goodsInclUnits += toAmountUnits(line.incl, scale);
  }

  return {
    totalQuantity,
    goodsExcl: fromAmountUnits(goodsExclUnits, scale),
    taxAmount: fromAmountUnits(taxAmountUnits, scale),
    goodsIncl: fromAmountUnits(goodsInclUnits, scale),
  };
}

/** 整单优惠：从价税合计扣减，不低于 0（对齐用友/金蝶整单折让） */
export function applyDocumentHeaderDiscount(
  goodsIncl: number,
  discountAmountInput: unknown,
): Pick<DocumentTotalsWithDiscount, 'discountAmount' | 'goodsAfterDiscount'> {
  const scale = getAmountScale();
  const inclUnits = toAmountUnits(goodsIncl, scale);
  const discountUnits = Math.min(Math.max(0, toAmountUnits(discountAmountInput, scale)), inclUnits);
  return {
    discountAmount: fromAmountUnits(discountUnits, scale),
    goodsAfterDiscount: fromAmountUnits(inclUnits - discountUnits, scale),
  };
}

export function computeDocumentTotalsWithDiscount(
  items: unknown[] | undefined,
  priceType: string | undefined,
  quantityField: string,
  discountAmountInput?: unknown,
): DocumentTotalsWithDiscount {
  const goods = computeDocumentGoodsTotals(items, priceType, (row) => ({
    qty: row[quantityField],
    price: row.unit_price,
    taxRate: row.tax_rate,
  }));
  const discount = applyDocumentHeaderDiscount(goods.goodsIncl, discountAmountInput);
  return { ...goods, ...discount };
}

/** 销售订单明细行数量（表单 required_quantity / 列表 order_quantity） */
function readSalesOrderLineQuantity(row: Record<string, unknown>): unknown {
  return row.required_quantity ?? row.order_quantity;
}

/** 按价类落库/展示的整单金额（不含税单存未税货值，含税单存预计应收） */
export function resolveSalesDocumentStoredTotalAmount(
  totals: SalesDocumentTotals,
  priceType: string | undefined,
): number {
  const pt = priceType ?? 'tax_exclusive';
  if (pt === 'tax_inclusive') {
    return totals.estimatedReceivable;
  }
  const scale = getAmountScale();
  const discountUnits = Math.min(
    toAmountUnits(totals.discountAmount, scale),
    toAmountUnits(totals.goodsIncl, scale),
  );
  const inclUnits = toAmountUnits(totals.goodsIncl, scale);
  const exclUnits = toAmountUnits(totals.goodsExcl, scale);
  const exclAfterDiscountUnits =
    inclUnits > 0
      ? Math.round((exclUnits * (inclUnits - discountUnits)) / inclUnits)
      : exclUnits;
  return fromAmountUnits(exclAfterDiscountUnits + toAmountUnits(totals.customerFees, scale), scale);
}

/** 按价类落库/展示的行金额 */
export function resolveSalesDocumentStoredLineAmount(
  line: { excl: number; incl: number },
  priceType: string | undefined,
): number {
  return (priceType ?? 'tax_exclusive') === 'tax_inclusive' ? line.incl : line.excl;
}

/** 列表/详情展示用总金额（不含税单按明细重算，兼容历史误存含税合计） */
export function resolveSalesOrderDisplayTotalAmount(order: {
  total_amount?: number | null;
  price_type?: string | null;
  discount_amount?: number | null;
  fee_details?: unknown;
  items?: Array<Record<string, unknown>> | null;
}): number {
  const priceType = order.price_type ?? 'tax_exclusive';
  const items = normalizeFormListItems<Record<string, unknown>>(order.items);
  if (priceType === 'tax_inclusive' || items.length === 0) {
    return toSafeNumber(order.total_amount);
  }
  const normalizedItems = items.map((row) => ({
    ...row,
    required_quantity: readSalesOrderLineQuantity(row),
  }));
  return resolveSalesDocumentStoredTotalAmount(
    computeSalesDocumentTotals(
      normalizedItems,
      order.fee_details,
      priceType,
      'required_quantity',
      order.discount_amount ?? 0,
    ),
    priceType,
  );
}

/** 销售类单据：优惠后货值 + 对方承担费用 = 预计应收 */
export function computeSalesDocumentTotals(
  items: unknown[] | undefined,
  feeDetails: unknown[] | undefined,
  priceType: string | undefined,
  quantityField: string,
  discountAmountInput?: unknown,
): SalesDocumentTotals {
  const withDiscount = computeDocumentTotalsWithDiscount(
    items,
    priceType,
    quantityField,
    discountAmountInput,
  );
  const fees = sumFeeAmounts(feeDetails);
  const scale = getAmountScale();
  const estimatedReceivableUnits =
    toAmountUnits(withDiscount.goodsAfterDiscount, scale) + toAmountUnits(fees.otherSide, scale);

  return {
    ...withDiscount,
    customerFees: fees.otherSide,
    ourFees: fees.ourSide,
    estimatedReceivable: fromAmountUnits(estimatedReceivableUnits, scale),
  };
}

/** 采购类单据：应付 = 含税货值 + 对方费用；总成本 = 含税货值 + 我方成本 */
export function computePurchaseDocumentTotals(
  items: unknown[] | undefined,
  feeDetails: unknown[] | undefined,
  priceType: string | undefined,
  quantityField = 'ordered_quantity',
): PurchaseDocumentTotals {
  const goods = computeDocumentGoodsTotals(items, priceType, (row) => ({
    qty: row[quantityField],
    price: row.unit_price,
    taxRate: row.tax_rate,
  }));
  const fees = sumFeeAmounts(feeDetails);
  const scale = getAmountScale();
  const estimatedPayableUnits = toAmountUnits(goods.goodsIncl, scale) + toAmountUnits(fees.otherSide, scale);
  const estimatedTotalCostUnits = toAmountUnits(goods.goodsIncl, scale) + toAmountUnits(fees.ourSide, scale);

  return {
    ...goods,
    otherSideFees: fees.otherSide,
    ourSideFees: fees.ourSide,
    estimatedPayable: fromAmountUnits(estimatedPayableUnits, scale),
    estimatedTotalCost: fromAmountUnits(estimatedTotalCostUnits, scale),
  };
}

export function formatDocumentMoneyYuan(n: number): string {
  return formatCurrencyAmount(n ?? 0, '¥0.00');
}
