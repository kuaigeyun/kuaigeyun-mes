import React, { useCallback } from 'react';
import { Form, Typography, theme as AntdTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_CONTRACT_FIELD_RESOURCE as SC } from '../../../constants/fieldPermissionResources';
import type { Material } from '../../../../master-data/types/material';
import { normalizeFormListItems } from '../../../../../utils/formListItems';

export const defaultContractItem = {
  material_id: undefined as number | undefined,
  material_code: '',
  material_name: '',
  material_spec: '',
  material_unit: '',
  contract_quantity: 1,
  unit_price: undefined as number | undefined,
  tax_rate: 0,
  delivery_date: undefined as string | undefined,
  notes: '',
};

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

export const calcContractLineAmounts = (
  qtyInput: unknown,
  priceInput: unknown,
  taxRateInput: unknown,
  priceTypeInput?: string,
) => {
  const qty = toSafeNumber(qtyInput);
  const unitPriceCents = toCents(priceInput);
  const taxRate = toSafeNumber(taxRateInput);
  const priceType = priceTypeInput ?? 'tax_exclusive';

  if (priceType === 'tax_inclusive') {
    const inclCents = Math.round(qty * unitPriceCents);
    const exclCents = Math.round(inclCents / (1 + taxRate / 100));
    const taxCents = inclCents - exclCents;
    return {
      excl: fromCents(exclCents),
      tax: fromCents(taxCents),
      incl: fromCents(inclCents),
    };
  }

  const exclCents = Math.round(qty * unitPriceCents);
  const taxCents = Math.round((exclCents * taxRate) / 100);
  return {
    excl: fromCents(exclCents),
    tax: fromCents(taxCents),
    incl: fromCents(exclCents + taxCents),
  };
};

export const convertUnitPriceByPriceType = (
  unitPriceInput: unknown,
  taxRateInput: unknown,
  fromPriceType: string,
  toPriceType: string,
): number => {
  const unitPriceCents = toCents(unitPriceInput);
  if (fromPriceType === toPriceType) return fromCents(unitPriceCents);

  const taxRate = toSafeNumber(taxRateInput);
  const factor = 1 + taxRate / 100;
  if (factor <= 0) return fromCents(unitPriceCents);

  if (fromPriceType === 'tax_exclusive' && toPriceType === 'tax_inclusive') {
    return fromCents(Math.round(unitPriceCents * factor));
  }
  if (fromPriceType === 'tax_inclusive' && toPriceType === 'tax_exclusive') {
    return fromCents(Math.round(unitPriceCents / factor));
  }
  return fromCents(unitPriceCents);
};

export const ContractMaterialSelectCell: React.FC<{ index: number }> = ({ index }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const row = Form.useWatch(['items', index]);
  const mid =
    row?.material_id != null && row?.material_id !== ''
      ? Number(row.material_id)
      : null;
  const fallback =
    mid != null &&
    Number.isFinite(mid) &&
    (row?.material_code || row?.material_name)
      ? {
          value: mid,
          label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
        }
      : undefined;
  const onMaterialPicked = useCallback(
    (_val: number | undefined, material: Material | undefined) => {
      if (!material) return;
      form.setFieldValue(
        ['items', index, '_sourceType'],
        (material as any)?.sourceType || (material as any)?.source_type,
      );
      form.setFieldValue(['items', index, '_masterMaterialUuid'], material.uuid);
      form.setFieldValue(['items', index, 'variant_attributes'], undefined);
      const pt = form.getFieldValue('price_type') ?? 'tax_exclusive';
      if (pt !== 'tax_inclusive') return;
      const raw = Number(form.getFieldValue(['items', index, 'unit_price'])) || 0;
      const taxR = Number(form.getFieldValue(['items', index, 'tax_rate'])) || 0;
      form.setFieldValue(
        ['items', index, 'unit_price'],
        convertUnitPriceByPriceType(raw, taxR, 'tax_exclusive', 'tax_inclusive'),
      );
    },
    [form, index],
  );
  return (
    <div
      className="quotation-material-cell"
      style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <UniMaterialSelect
          name={[index, 'material_id']}
          label=""
          placeholder={t('app.kuaizhizao.salesContract.materialSelectPlaceholder')}
          required
          size="small"
          listFieldKey={index}
          listFieldName="items"
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_spec: 'specification',
            material_unit: 'baseUnit',
            unit_price: 'defaults.defaultSalePrice' as any,
            tax_rate: 'defaults.defaultTaxRate' as any,
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
          onChange={onMaterialPicked}
        />
      </div>
    </div>
  );
};

export const ContractAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const priceType = Form.useWatch('price_type') ?? 'tax_exclusive';
  const line = calcContractLineAmounts(row?.contract_quantity, row?.unit_price, row?.tax_rate, priceType);
  return <AmountDisplay resource={SC} fieldName="amount_without_tax" value={line.excl} />;
};

export const ContractFormSummary: React.FC = () => {
  const { t } = useTranslation();
  const items = Form.useWatch('items');
  const normalizedItems = normalizeFormListItems<any>(items);
  const priceType = Form.useWatch('price_type') ?? 'tax_exclusive';
  const { token } = AntdTheme.useToken();
  const totalQuantity = normalizedItems.reduce(
    (sum: number, it: any) => sum + (Number(it?.contract_quantity) || 0),
    0,
  );
  let totalExcl = 0;
  let totalIncl = 0;
  for (const it of normalizedItems) {
    const line = calcContractLineAmounts(it?.contract_quantity, it?.unit_price, it?.tax_rate, priceType);
    totalExcl += line.excl;
    totalIncl += line.incl;
  }

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 24,
        padding: '12px 12px 16px',
        background: token.colorFillAlter,
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 24,
      }}
    >
      <span>
        {t('app.kuaizhizao.salesOrder.totalQuantity')}: <Typography.Text strong>{totalQuantity}</Typography.Text>
      </span>
      {priceType === 'tax_exclusive' ? (
        <>
          <span>
            {t('app.kuaizhizao.salesContract.exclTotal')}:{' '}
            <Typography.Text strong>
              <AmountDisplay resource={SC} fieldName="amount_without_tax" value={totalExcl} />
            </Typography.Text>
          </span>
          {Math.abs(totalIncl - totalExcl) > 0.005 && (
            <span>
              {t('app.kuaizhizao.salesContract.inclTotalWithTax')}:{' '}
              <Typography.Text strong type="danger">
                <AmountDisplay resource={SC} fieldName="amount_with_tax" value={totalIncl} />
              </Typography.Text>
            </span>
          )}
        </>
      ) : (
        <span>
          {t('app.kuaizhizao.salesOrder.inclAmount')}:{' '}
          <Typography.Text strong type="danger">
            <AmountDisplay resource={SC} fieldName="amount_with_tax" value={totalIncl} />
          </Typography.Text>
        </span>
      )}
    </div>
  );
};
