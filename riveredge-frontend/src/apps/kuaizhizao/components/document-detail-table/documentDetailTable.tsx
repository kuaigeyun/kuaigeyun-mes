/**
 * 单据明细表 UI 规范（标杆：报价单明细表 quotation-detail-table）
 *
 * 销售/采购等同构明细表复用本模块，与报价单外观与行为对齐。
 * 勿修改报价单页面本身；本文件为唯一共享真源。
 */

import React from 'react';
import { Button, Form, InputNumber, Space } from 'antd';
import { useTranslation } from 'react-i18next';

/** 与报价单明细表一致的 table className */
export const DOCUMENT_DETAIL_TABLE_CLASS = 'quotation-detail-table';

export const DOCUMENT_DETAIL_COL_WIDTH = {
  material: 280,
  variantAttributes: 240,
  spec: 140,
  unit: 108,
  quantity: 112,
  unitPrice: 132,
  exclAmount: 120,
  taxRate: 108,
  taxAmount: 112,
  lineAmount: 132,
  deliveryDate: 152,
  notes: 140,
} as const;

export const DOCUMENT_DETAIL_TEXT_COL = { align: 'left' as const };

export const DOCUMENT_DETAIL_NUM_COL = {
  align: 'right' as const,
  onHeaderCell: () => ({ style: { textAlign: 'left' as const } }),
};

export const DOCUMENT_DETAIL_AMOUNT_STYLE: React.CSSProperties = {
  display: 'block',
  textAlign: 'right',
};

export const DOCUMENT_DETAIL_DATE_PICKER_STYLE: React.CSSProperties = {
  width: '100%',
  minWidth: 140,
};

export const DOCUMENT_DETAIL_TABLE_PROPS = {
  className: DOCUMENT_DETAIL_TABLE_CLASS,
  size: 'middle' as const,
  style: { width: '100%', margin: 0 },
};

/** 明细表行内 Input / Select / DatePicker 等与 Table middle 对齐 */
export const DOCUMENT_DETAIL_CONTROL_SIZE = 'middle' as const;

const DOCUMENT_DETAIL_TABLE_STYLE_BLOCK = `
  .quotation-detail-table .quotation-material-cell .ant-form-item,
  .quotation-detail-table .quotation-material-cell .ant-form-item-control,
  .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
  .quotation-detail-table .quotation-material-cell .ant-select,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item-control,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item-control-input,
  .quotation-detail-table .uni-detail-material-cell .ant-select {
    width: 100% !important;
    min-width: 0;
  }
  .quotation-detail-table .ant-input-number-input::selection,
  .quotation-detail-table .ant-input::selection {
    background-color: var(--ant-color-primary, #1677ff);
    color: #fff;
    border-radius: 0;
  }
  .quotation-detail-table td.ant-table-cell-align-right .ant-input-number-input {
    text-align: right;
  }
  .quotation-detail-table td.quotation-tax-rate-col {
    overflow: hidden;
  }
  .quotation-detail-table .quotation-tax-rate-cell,
  .quotation-detail-table .quotation-tax-rate-cell .ant-form-item,
  .quotation-detail-table .quotation-tax-rate-cell .ant-form-item-control-input {
    max-width: 100%;
    min-width: 0;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-wrapper {
    display: flex;
    width: 100%;
    max-width: 100%;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number {
    flex: 1 1 auto;
    min-width: 0;
    width: auto !important;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-addon {
    flex: 0 0 auto;
    padding-inline: 6px;
  }
`;

export function DocumentDetailTableStyles() {
  return <style>{DOCUMENT_DETAIL_TABLE_STYLE_BLOCK}</style>;
}

export function TaxRateBatchColumnTitle({ onBatch }: { onBatch: () => void }) {
  const { t } = useTranslation();
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {t('app.kuaizhizao.salesOrder.taxRate')}
      <Button type="link" size="small" style={{ padding: '0 4px', height: 'auto' }} onClick={onBatch}>
        {t('app.kuaizhizao.salesOrder.batch')}
      </Button>
    </span>
  );
}

const TAX_RATE_PERCENT_SUFFIX_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 8px',
  color: 'var(--ant-color-text-secondary)',
  background: 'var(--ant-color-fill-alter)',
  border: '1px solid var(--ant-color-border)',
  borderLeft: 0,
  borderRadius: '0 var(--ant-border-radius) var(--ant-border-radius) 0',
  fontSize: 'inherit',
};

/** Form.Item 子组件须接收 value/onChange；不可直接用 Space.Compact 包裹 InputNumber */
function TaxRatePercentInput({
  value,
  onChange,
}: {
  value?: number | null;
  onChange?: (value: number | null) => void;
}) {
  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber
        value={value}
        onChange={onChange}
        placeholder="0"
        min={0}
        max={100}
        precision={0}
        controls={false}
        size={DOCUMENT_DETAIL_CONTROL_SIZE}
        style={{ width: '100%' }}
      />
      <span style={TAX_RATE_PERCENT_SUFFIX_STYLE}>%</span>
    </Space.Compact>
  );
}

export function TaxRateDetailCell({ index }: { index: number }) {
  return (
    <div className="quotation-tax-rate-cell">
      <Form.Item name={[index, 'tax_rate']} style={{ margin: 0 }}>
        <TaxRatePercentInput />
      </Form.Item>
    </div>
  );
}

export const DOCUMENT_DETAIL_TAX_RATE_COL_BASE = {
  dataIndex: 'tax_rate',
  width: DOCUMENT_DETAIL_COL_WIDTH.taxRate,
  ...DOCUMENT_DETAIL_NUM_COL,
  onCell: () => ({ className: 'quotation-tax-rate-col' }),
};
