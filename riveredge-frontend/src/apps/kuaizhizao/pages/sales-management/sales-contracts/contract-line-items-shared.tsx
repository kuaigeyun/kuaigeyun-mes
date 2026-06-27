import React, { useCallback } from 'react';
import { Form, Input, Typography, theme as AntdTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { getMaterialField } from '../../../../../components/uni-material-batch-picker/utils';
import { AmountDisplay } from '../../../../../components/permission';
import { DocumentAmountSummaryWatch } from '../../../components/document-amount-summary/DocumentAmountSummary';
import { KUAIZHIZAO_SALES_CONTRACT_FIELD_RESOURCE as SC } from '../../../constants/fieldPermissionResources';
import type { Material } from '../../../../master-data/types/material';
import {
  applySalesDocumentLineMaterialPricing,
  convertUnitPriceByPriceType,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { DOCUMENT_DETAIL_CONTROL_SIZE } from '../../../components/document-detail-table/documentDetailTable';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { DEFAULT_SALES_PRICE_TYPE, salesFormPriceType } from '../shared/salesPriceType';

export { convertUnitPriceByPriceType };

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
  const priceType = salesFormPriceType(priceTypeInput);

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

export function resolveContractLineMaterialFields(
  it: Record<string, unknown>,
  materialList: Array<Record<string, unknown>>,
): { material_code: string; material_name: string; material_unit: string } {
  const mid = it?.material_id != null ? Number(it.material_id) : NaN;
  const matched = Number.isFinite(mid)
    ? materialList.find((m) => Number(m.id) === mid)
    : undefined;
  const material_code =
    String(it?.material_code ?? '').trim() ||
    String(getMaterialField(matched ?? {}, 'mainCode') ?? getMaterialField(matched ?? {}, 'code') ?? '').trim();
  const material_name =
    String(it?.material_name ?? '').trim() ||
    String(getMaterialField(matched ?? {}, 'name') ?? '').trim();
  const material_unit =
    String(it?.material_unit ?? '').trim() ||
    String(getMaterialField(matched ?? {}, 'baseUnit') ?? '').trim();
  return { material_code, material_name, material_unit };
}

export const ContractMaterialSelectCell: React.FC<{
  index: number;
  materialList?: Material[];
  sourceType?: string;
}> = ({
  index,
  materialList,
  sourceType,
}) => {
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
        ['items', index, 'material_code'],
        getMaterialField(material as unknown as Record<string, unknown>, 'mainCode') ??
          getMaterialField(material as unknown as Record<string, unknown>, 'code'),
      );
      form.setFieldValue(
        ['items', index, 'material_name'],
        getMaterialField(material as unknown as Record<string, unknown>, 'name'),
      );
      form.setFieldValue(
        ['items', index, 'material_unit'],
        getMaterialField(material as unknown as Record<string, unknown>, 'baseUnit'),
      );
      form.setFieldValue(
        ['items', index, '_sourceType'],
        (material as any)?.sourceType || (material as any)?.source_type,
      );
      form.setFieldValue(['items', index, '_masterMaterialUuid'], material.uuid);
      form.setFieldValue(['items', index, 'variant_attributes'], undefined);
      void applySalesDocumentLineMaterialPricing(form, index, material, {
        materialList,
        asOfField: 'contract_date',
      });
    },
    [form, index, materialList],
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
          size={DOCUMENT_DETAIL_CONTROL_SIZE}
          listFieldKey={index}
          listFieldName="items"
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_spec: 'specification',
            material_unit: 'baseUnit',
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
          sourceType={sourceType}
          onChange={onMaterialPicked}
        />
        <Form.Item name={[index, 'material_code']} hidden>
          <Input />
        </Form.Item>
        <Form.Item name={[index, 'material_name']} hidden>
          <Input />
        </Form.Item>
      </div>
    </div>
  );
};

export const ContractAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const priceType = salesFormPriceType(Form.useWatch('price_type'));
  const line = calcContractLineAmounts(row?.contract_quantity, row?.unit_price, row?.tax_rate, priceType);
  return <AmountDisplay resource={SC} fieldName="amount_without_tax" value={line.excl} />;
};

export const ContractFormSummary: React.FC = () => (
  <DocumentAmountSummaryWatch variant="lines" quantityField="contract_quantity" />
);
