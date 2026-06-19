import React, { useMemo } from 'react';
import { Divider, Form, InputNumber, theme as antdTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { normalizeFormListItems } from '../../../../utils/formListItems';
import {
  computeDocumentGoodsTotals,
  computeDocumentTotalsWithDiscount,
  computePurchaseDocumentTotals,
  computeSalesDocumentTotals,
  formatDocumentMoneyYuan,
  type DocumentGoodsTotals,
  type DocumentTotalsWithDiscount,
  type PurchaseDocumentTotals,
  type SalesDocumentTotals,
} from '../../utils/documentLineAmounts';

export type DocumentAmountSummaryVariant = 'sales' | 'purchase' | 'lines' | 'basic';

type SummaryRowDef = {
  key: string;
  label: string;
  hint?: string;
  value: number;
  emphasis?: boolean;
  secondary?: boolean;
  hidden?: boolean;
};

function appendDiscountRows(
  t: (key: string) => string,
  totals: DocumentTotalsWithDiscount,
  options: { finalEmphasis?: boolean },
): SummaryRowDef[] {
  if (totals.discountAmount <= 0.005) return [];
  return [
    {
      key: 'discount',
      label: t('app.kuaizhizao.salesOrder.discountAmount'),
      hint: t('app.kuaizhizao.salesOrder.discountAmountHint'),
      value: totals.discountAmount,
      secondary: true,
    },
    {
      key: 'afterDiscount',
      label: t('app.kuaizhizao.salesOrder.amountAfterDiscount'),
      hint: t('app.kuaizhizao.salesOrder.amountAfterDiscountHint'),
      value: totals.goodsAfterDiscount,
      emphasis: options.finalEmphasis,
    },
  ];
}

function buildGoodsRows(
  t: (key: string) => string,
  goods: DocumentGoodsTotals,
  options?: { showQuantity?: boolean; showTax?: boolean; showGoodsIncl?: boolean },
): SummaryRowDef[] {
  const showTax = options?.showTax ?? Math.abs(goods.taxAmount) > 0.005;
  const showGoodsIncl = options?.showGoodsIncl ?? true;
  const rows: SummaryRowDef[] = [];
  if (options?.showQuantity) {
    rows.push({
      key: 'quantity',
      label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
      value: goods.totalQuantity,
      secondary: true,
    });
  }
  rows.push({
    key: 'goodsExcl',
    label: t('app.kuaizhizao.salesOrder.amountGoodsValue'),
    hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
    value: goods.goodsExcl,
  });
  if (showTax) {
    rows.push({
      key: 'tax',
      label: t('app.kuaizhizao.salesOrder.amountTax'),
      value: goods.taxAmount,
    });
  }
  if (showGoodsIncl) {
    rows.push({
      key: 'goodsIncl',
      label: t('app.kuaizhizao.salesOrder.amountGoodsInclTax'),
      value: goods.goodsIncl,
    });
  }
  return rows;
}

function buildSalesRows(
  t: (key: string) => string,
  totals: SalesDocumentTotals,
  priceType: string,
): SummaryRowDef[] {
  const isInclusive = priceType === 'tax_inclusive';
  const hasFees = totals.customerFees > 0.005 || totals.ourFees > 0.005;
  const hasDiscount = totals.discountAmount > 0.005;
  const hasTax = Math.abs(totals.taxAmount) > 0.005;
  const rows: SummaryRowDef[] = [
    {
      key: 'quantity',
      label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
      value: totals.totalQuantity,
      secondary: true,
    },
  ];

  if (isInclusive) {
    rows.push({
      key: 'goodsExcl',
      label: t('app.kuaizhizao.salesOrder.amountGoodsValue'),
      hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
      value: totals.goodsExcl,
    });
    if (hasTax) {
      rows.push({
        key: 'tax',
        label: t('app.kuaizhizao.salesOrder.amountTax'),
        value: totals.taxAmount,
      });
    }
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.totalIncl'),
      value: totals.goodsIncl,
      emphasis: !hasFees && !hasDiscount,
    });
  } else {
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.grandTotal'),
      hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
      value: totals.goodsExcl,
      emphasis: !hasFees && !hasDiscount,
    });
  }

  rows.push(...appendDiscountRows(t, totals, { finalEmphasis: !hasFees }));

  rows.push(
    {
      key: 'customerFees',
      label: t('app.kuaizhizao.salesOrder.amountCustomerDirectPay'),
      hint: t('app.kuaizhizao.salesOrder.amountCustomerDirectPayHint'),
      value: totals.customerFees,
      hidden: !hasFees,
      secondary: true,
    },
    {
      key: 'ourFees',
      label: t('app.kuaizhizao.salesOrder.amountOurAdvance'),
      hint: t('app.kuaizhizao.salesOrder.amountOurAdvanceHint'),
      value: totals.ourFees,
      hidden: !hasFees,
      secondary: true,
    },
  );

  if (hasFees) {
    rows.push({
      key: 'estimatedReceivable',
      label: t('app.kuaizhizao.salesOrder.amountEstimatedReceivable'),
      hint: t('app.kuaizhizao.salesOrder.amountEstimatedReceivableHint'),
      value: totals.estimatedReceivable,
      emphasis: true,
    });
  }

  return rows;
}

function buildPurchaseRows(
  t: (key: string) => string,
  totals: PurchaseDocumentTotals,
  priceType: string,
): SummaryRowDef[] {
  const isInclusive = priceType === 'tax_inclusive';
  const hasFees = totals.otherSideFees > 0.005 || totals.ourSideFees > 0.005;
  const hasTax = Math.abs(totals.taxAmount) > 0.005;
  const rows: SummaryRowDef[] = [
    {
      key: 'quantity',
      label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
      value: totals.totalQuantity,
      secondary: true,
    },
  ];

  if (isInclusive) {
    rows.push({
      key: 'goodsExcl',
      label: t('app.kuaizhizao.salesOrder.amountGoodsValue'),
      hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
      value: totals.goodsExcl,
    });
    if (hasTax) {
      rows.push({
        key: 'tax',
        label: t('app.kuaizhizao.salesOrder.amountTax'),
        value: totals.taxAmount,
      });
    }
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.totalIncl'),
      value: totals.goodsIncl,
      emphasis: !hasFees,
    });
  } else {
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.grandTotal'),
      hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
      value: totals.goodsExcl,
      emphasis: !hasFees,
    });
  }

  rows.push(
    {
      key: 'otherSideFees',
      label: t('app.kuaizhizao.purchaseOrder.amountOtherFees'),
      value: totals.otherSideFees,
      hidden: !hasFees,
      secondary: true,
    },
    {
      key: 'ourSideFees',
      label: t('app.kuaizhizao.purchaseOrder.amountOurCost'),
      value: totals.ourSideFees,
      hidden: !hasFees,
      secondary: true,
    },
  );

  if (hasFees) {
    rows.push(
      {
        key: 'estimatedPayable',
        label: t('app.kuaizhizao.purchaseOrder.amountEstimatedPayable'),
        hint: t('app.kuaizhizao.purchaseOrder.amountEstimatedPayableHint'),
        value: isInclusive ? totals.estimatedPayable : totals.goodsExcl + totals.otherSideFees,
        emphasis: true,
      },
      {
        key: 'estimatedTotalCost',
        label: t('app.kuaizhizao.purchaseOrder.amountEstimatedTotalCost'),
        hint: t('app.kuaizhizao.purchaseOrder.amountEstimatedTotalCostHint'),
        value: isInclusive ? totals.estimatedTotalCost : totals.goodsExcl + totals.ourSideFees,
        secondary: true,
      },
    );
  }

  return rows;
}

function buildLinesRows(
  t: (key: string) => string,
  totals: DocumentTotalsWithDiscount,
  priceType: string,
): SummaryRowDef[] {
  const isInclusive = priceType === 'tax_inclusive';
  const hasTax = Math.abs(totals.taxAmount) > 0.005;
  const hasDiscount = totals.discountAmount > 0.005;
  const quantityRow: SummaryRowDef = {
    key: 'quantity',
    label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
    value: totals.totalQuantity,
    secondary: true,
  };

  if (isInclusive) {
    const rows: SummaryRowDef[] = [
      quantityRow,
      {
        key: 'goodsExcl',
        label: t('app.kuaizhizao.salesOrder.amountGoodsValue'),
        hint: t('app.kuaizhizao.salesOrder.amountGoodsValueHint'),
        value: totals.goodsExcl,
      },
    ];
    if (hasTax) {
      rows.push({
        key: 'tax',
        label: t('app.kuaizhizao.salesOrder.amountTax'),
        value: totals.taxAmount,
      });
    }
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.totalIncl'),
      value: totals.goodsIncl,
      emphasis: !hasDiscount,
    });
    rows.push(...appendDiscountRows(t, totals, { finalEmphasis: true }));
    return rows;
  }

  const rows: SummaryRowDef[] = [
    quantityRow,
    {
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.grandTotal'),
      value: totals.goodsExcl,
      emphasis: !hasDiscount,
    },
  ];
  rows.push(...appendDiscountRows(t, totals, { finalEmphasis: true }));
  return rows;
}

function buildBasicRows(
  t: (key: string) => string,
  items: unknown[] | undefined,
  quantityField: string,
): SummaryRowDef[] {
  const rows = normalizeFormListItems<Record<string, unknown>>(items);
  const totalQuantity = rows.reduce((sum, row) => sum + (Number(row[quantityField]) || 0), 0);
  const totalAmount = rows.reduce(
    (sum, row) => sum + (Number(row[quantityField]) || 0) * (Number(row.unit_price) || 0),
    0,
  );
  return [
    {
      key: 'quantity',
      label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
      value: totalQuantity,
      secondary: true,
    },
    {
      key: 'amount',
      label: t('app.kuaizhizao.shipmentNotice.totalAmount'),
      value: totalAmount,
      emphasis: true,
    },
  ];
}

const SummaryRow: React.FC<{
  row: SummaryRowDef;
  token: ReturnType<typeof antdTheme.useToken>['token'];
}> = ({ row, token }) => {
  if (row.hidden) return null;
  const isQuantity = row.key === 'quantity';
  const displayValue = isQuantity
    ? row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : formatDocumentMoneyYuan(row.value);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 24,
        padding: row.emphasis ? '6px 0 2px' : '3px 0',
      }}
      title={row.hint}
    >
      <span
        style={{
          color: row.emphasis ? token.colorText : token.colorTextSecondary,
          fontSize: row.emphasis ? 14 : 13,
          fontWeight: row.emphasis ? 600 : 400,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {row.label}
      </span>
      <span
        style={{
          fontSize: row.emphasis ? 18 : 14,
          fontWeight: row.emphasis ? 700 : 500,
          fontVariantNumeric: 'tabular-nums',
          color: row.emphasis ? token.colorPrimary : token.colorText,
          whiteSpace: 'nowrap',
        }}
      >
        {displayValue}
      </span>
    </div>
  );
};

export type DocumentAmountSummaryProps = {
  variant: DocumentAmountSummaryVariant;
  items?: unknown[];
  feeDetails?: unknown[];
  priceType?: string;
  quantityField?: string;
  discountAmount?: unknown;
  showDiscount?: boolean;
  getFieldValue?: (name: string) => unknown;
  style?: React.CSSProperties;
};

const DocumentDiscountInput: React.FC<{
  goodsIncl: number;
  token: ReturnType<typeof antdTheme.useToken>['token'];
}> = ({ goodsIncl, token }) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24,
        padding: '3px 0 10px',
        borderBottom: `1px dashed ${token.colorBorderSecondary}`,
        marginBottom: 8,
      }}
    >
      <span
        style={{ color: token.colorTextSecondary, fontSize: 13 }}
        title={t('app.kuaizhizao.salesOrder.discountAmountHint')}
      >
        {t('app.kuaizhizao.salesOrder.discountAmount')}
      </span>
      <Form.Item name="discount_amount" noStyle>
        <InputNumber
          min={0}
          max={goodsIncl > 0 ? goodsIncl : undefined}
          precision={2}
          prefix="¥"
          style={{ width: 140 }}
        />
      </Form.Item>
    </div>
  );
};

export const DocumentAmountSummary: React.FC<DocumentAmountSummaryProps> = ({
  variant,
  items: itemsProp,
  feeDetails: feeDetailsProp,
  priceType: priceTypeProp,
  quantityField = 'required_quantity',
  discountAmount: discountAmountProp,
  showDiscount: showDiscountProp,
  getFieldValue,
  style,
}) => {
  const { t } = useTranslation();
  const { token } = antdTheme.useToken();

  const items = itemsProp ?? normalizeFormListItems(getFieldValue?.('items'));
  const feeDetails = feeDetailsProp ?? normalizeFormListItems(getFieldValue?.('fee_details'));
  const priceType = (priceTypeProp ?? getFieldValue?.('price_type') ?? 'tax_exclusive') as string;
  const showDiscount =
    showDiscountProp ?? (variant === 'lines' || variant === 'sales');
  const discountAmount = showDiscount
    ? (discountAmountProp ?? getFieldValue?.('discount_amount') ?? 0)
    : 0;

  const goodsInclForCap = useMemo(
    () =>
      computeDocumentGoodsTotals(items, priceType, (row) => ({
        qty: row[quantityField],
        price: row.unit_price,
        taxRate: row.tax_rate,
      })).goodsIncl,
    [items, priceType, quantityField],
  );

  const rows = useMemo(() => {
    if (variant === 'basic') {
      return buildBasicRows(t, items, quantityField);
    }
    if (variant === 'sales') {
      return buildSalesRows(
        t,
        computeSalesDocumentTotals(
          items,
          feeDetails,
          priceType,
          quantityField,
          discountAmount,
        ),
        priceType,
      );
    }
    if (variant === 'purchase') {
      return buildPurchaseRows(
        t,
        computePurchaseDocumentTotals(items, feeDetails, priceType, quantityField),
        priceType,
      );
    }
    return buildLinesRows(
      t,
      computeDocumentTotalsWithDiscount(items, priceType, quantityField, discountAmount),
      priceType,
    );
  }, [variant, items, feeDetails, priceType, quantityField, discountAmount, t]);

  const visibleRows = rows.filter((row) => !row.hidden);
  const emphasisIndex = visibleRows.findIndex((row) => row.emphasis);
  const bodyRows = emphasisIndex >= 0 ? visibleRows.slice(0, emphasisIndex) : visibleRows;
  const emphasisRows = emphasisIndex >= 0 ? visibleRows.slice(emphasisIndex) : [];

  return (
    <div
      className="document-amount-summary"
      style={{
        marginTop: 12,
        marginBottom: 24,
        padding: '14px 20px',
        background: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        ...style,
      }}
    >
      <div style={{ maxWidth: 440, marginLeft: 'auto' }}>
        {showDiscount && getFieldValue && (
          <DocumentDiscountInput goodsIncl={goodsInclForCap} token={token} />
        )}
        {bodyRows.map((row) => (
          <SummaryRow key={row.key} row={row} token={token} />
        ))}
        {emphasisRows.length > 0 && bodyRows.length > 0 && (
          <Divider style={{ margin: '8px 0 6px', borderColor: token.colorBorderSecondary }} />
        )}
        {emphasisRows.map((row) => (
          <SummaryRow key={row.key} row={row} token={token} />
        ))}
      </div>
    </div>
  );
};

/** 表单内实时汇总（与明细表共用 shouldUpdate，确保 price_type 与价税列一致） */
export const DocumentAmountSummaryWatch: React.FC<
  Omit<
    DocumentAmountSummaryProps,
    'getFieldValue' | 'items' | 'feeDetails' | 'priceType' | 'discountAmount'
  >
> = ({ variant, quantityField, style, showDiscount }) => (
  <Form.Item
    noStyle
    shouldUpdate={(prev, curr) =>
      prev?.items !== curr?.items ||
      prev?.fee_details !== curr?.fee_details ||
      prev?.price_type !== curr?.price_type ||
      prev?.discount_amount !== curr?.discount_amount
    }
  >
    {({ getFieldValue }) => (
      <DocumentAmountSummary
        variant={variant}
        getFieldValue={getFieldValue}
        quantityField={quantityField}
        style={style}
        showDiscount={showDiscount}
      />
    )}
  </Form.Item>
);
