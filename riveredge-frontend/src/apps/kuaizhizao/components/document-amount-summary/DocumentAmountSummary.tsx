import React, { useMemo } from 'react';
import { Divider, Form, InputNumber, theme as antdTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../hooks/useNumericPrecision';
import { formatQuantity } from '../../../../utils/format';
import { amountToChineseRmb } from '../../../../utils/rmbUppercase';
import { normalizeFormListItems } from '../../../../utils/formListItems';
import {
  computeDocumentGoodsTotals,
  computeDocumentTotalsWithDiscount,
  computePurchaseDocumentTotals,
  computeSalesDocumentTotals,
  formatDocumentMoneyYuan,
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

function splitBodyAndEmphasis(rows: SummaryRowDef[]): {
  bodyRows: SummaryRowDef[];
  emphasisRows: SummaryRowDef[];
} {
  // 仅「结算结果」下沉底栏；价税合计留在明细流里（单列更整齐）
  const footerKeys = new Set([
    'afterDiscount',
    'estimatedReceivable',
    'estimatedPayable',
    'estimatedTotalCost',
    'amount',
  ]);
  const emphasisIndex = rows.findIndex((row) => row.emphasis && footerKeys.has(row.key));
  if (emphasisIndex < 0) {
    return { bodyRows: rows, emphasisRows: [] };
  }
  return {
    bodyRows: rows.slice(0, emphasisIndex),
    emphasisRows: rows.slice(emphasisIndex),
  };
}

function appendDiscountRows(
  t: (key: string) => string,
  totals: DocumentTotalsWithDiscount,
  options: { finalEmphasis?: boolean; /** 上方已有整单优惠输入时不再重复展示 */ omitDiscountAmount?: boolean },
): SummaryRowDef[] {
  if (totals.discountAmount <= 0.005) return [];
  const rows: SummaryRowDef[] = [];
  if (!options.omitDiscountAmount) {
    rows.push({
      key: 'discount',
      label: t('app.kuaizhizao.salesOrder.discountAmount'),
      hint: t('app.kuaizhizao.salesOrder.discountAmountHint'),
      value: totals.discountAmount,
      secondary: true,
    });
  }
  rows.push({
    key: 'afterDiscount',
    label: t('app.kuaizhizao.salesOrder.amountAfterDiscount'),
    hint: t('app.kuaizhizao.salesOrder.amountAfterDiscountHint'),
    value: totals.goodsAfterDiscount,
    emphasis: options.finalEmphasis,
  });
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
  const rows: SummaryRowDef[] = [];

  // 1) 总数量单独一行
  rows.push({
    key: 'quantity',
    label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
    value: totals.totalQuantity,
    secondary: true,
  });

  // 2) 价税拆分（含税）：未税 / 税额 / 价税合计
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

  // 3) 折让：上方已有输入，此处只展示优惠后金额
  rows.push(
    ...appendDiscountRows(t, totals, {
      finalEmphasis: !hasFees,
      omitDiscountAmount: true,
    }),
  );

  // 4) 费用
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

  // 5) 预计应收
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
  const rows: SummaryRowDef[] = [];

  rows.push({
    key: 'quantity',
    label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
    value: totals.totalQuantity,
    secondary: true,
  });

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
  const rows: SummaryRowDef[] = [];

  rows.push({
    key: 'quantity',
    label: t('app.kuaizhizao.quotation.summary.totalQuantity'),
    value: totals.totalQuantity,
    secondary: true,
  });

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
      emphasis: !hasDiscount,
    });
  } else {
    rows.push({
      key: 'grandTotal',
      label: t('app.kuaizhizao.quotation.summary.grandTotal'),
      value: totals.goodsExcl,
      emphasis: !hasDiscount,
    });
  }

  rows.push(
    ...appendDiscountRows(t, totals, {
      finalEmphasis: true,
      omitDiscountAmount: true,
    }),
  );
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

const LABEL_FONT_SIZE = 13;
const VALUE_FONT_SIZE = 13;
const EMPHASIS_FONT_SIZE = 16;
const SUMMARY_ITEM_INNER_GAP = 12;
const SUMMARY_ROW_GAP = 8;
/** 单列汇总宽度：避免标签与金额撑得过开 */
const SUMMARY_PANEL_MAX_WIDTH = 320;

const SummaryItem: React.FC<{
  row: SummaryRowDef;
  token: ReturnType<typeof antdTheme.useToken>['token'];
  showRmbUppercase?: boolean;
}> = ({ row, token, showRmbUppercase }) => {
  const { t } = useTranslation();
  const isQuantity = row.key === 'quantity';
  const displayValue = isQuantity ? formatQuantity(row.value) : formatDocumentMoneyYuan(row.value);
  const uppercase = showRmbUppercase && !isQuantity ? amountToChineseRmb(row.value) : '';
  const fontSize = row.emphasis ? EMPHASIS_FONT_SIZE : LABEL_FONT_SIZE;
  const valueSize = row.emphasis ? EMPHASIS_FONT_SIZE : VALUE_FONT_SIZE;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: SUMMARY_ITEM_INNER_GAP,
        width: '100%',
        padding: `${SUMMARY_ROW_GAP / 2}px 0`,
      }}
      title={row.hint}
    >
      <span
        style={{
          color: row.emphasis ? token.colorText : token.colorTextSecondary,
          fontSize,
          fontWeight: row.emphasis ? 600 : 400,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {row.label}
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 8,
          minWidth: 0,
          textAlign: 'right',
        }}
      >
        <span
          style={{
            fontSize: valueSize,
            fontWeight: row.emphasis ? 700 : 500,
            fontVariantNumeric: 'tabular-nums',
            color: row.emphasis ? token.colorPrimary : token.colorText,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {displayValue}
        </span>
        {uppercase ? (
          <span
            style={{
              fontSize: valueSize,
              fontWeight: 500,
              color: token.colorTextSecondary,
              lineHeight: 1.4,
              wordBreak: 'break-all',
            }}
            title={t('app.kuaizhizao.documentAmount.rmbUppercase')}
          >
            ({uppercase})
          </span>
        ) : null}
      </div>
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
  const amountDecimals = useNumericPrecisionPlaces('amount');
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: `0 0 ${SUMMARY_ROW_GAP}px`,
        marginBottom: SUMMARY_ROW_GAP,
        borderBottom: `1px dashed ${token.colorBorderSecondary}`,
      }}
    >
      <span
        style={{
          color: token.colorTextSecondary,
          fontSize: LABEL_FONT_SIZE,
          fontWeight: 400,
          lineHeight: 1.4,
        }}
        title={t('app.kuaizhizao.salesOrder.discountAmountHint')}
      >
        {t('app.kuaizhizao.salesOrder.discountAmount')}
      </span>
      <Form.Item name="discount_amount" noStyle>
        <InputNumber
          min={0}
          max={goodsIncl > 0 ? goodsIncl : undefined}
          precision={amountDecimals}
          prefix="¥"
          size="small"
          style={{ width: 140, fontSize: VALUE_FONT_SIZE }}
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
  const { bodyRows, emphasisRows } = splitBodyAndEmphasis(visibleRows);
  const hasFooter = emphasisRows.length > 0;

  return (
    <div
      className="document-amount-summary"
      style={{
        marginTop: 12,
        marginBottom: 24,
        padding: '12px 16px',
        background: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        ...style,
      }}
    >
      <div style={{ maxWidth: SUMMARY_PANEL_MAX_WIDTH, marginLeft: 'auto' }}>
        {showDiscount && getFieldValue && (
          <DocumentDiscountInput goodsIncl={goodsInclForCap} token={token} />
        )}
        {bodyRows.map((row) => (
          <SummaryItem
            key={row.key}
            row={row}
            token={token}
            showRmbUppercase={!hasFooter && !!row.emphasis}
          />
        ))}
        {hasFooter && bodyRows.length > 0 && (
          <Divider style={{ margin: `${SUMMARY_ROW_GAP}px 0`, borderColor: token.colorBorderSecondary }} />
        )}
        {emphasisRows.map((row) => (
          <SummaryItem key={row.key} row={row} token={token} showRmbUppercase={!!row.emphasis} />
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
