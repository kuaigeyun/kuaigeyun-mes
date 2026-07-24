/**
 * 销售合同列表批量导入：按合同编号（或缺省时客户+日期）合并多行明细。
 */
import type { TFunction } from 'i18next';

import type { Material } from '../../../../master-data/types/material';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import {
  buildImportPriceTypeOptions,
  parseImportPriceType,
} from '../shared/salesPriceType';
import { calcContractLineAmounts } from './contract-line-items-shared';

export type ContractListImportDict = {
  MATERIAL_UNIT?: string[];
  CURRENCY?: string[];
  SHIPPING_METHOD?: string[];
  PAYMENT_TERMS?: string[];
  parseDict?: (dictionaryCode: string, raw?: string | null) => string | undefined;
};

export function buildContractListImportTemplate(
  t: TFunction,
  dict: ContractListImportDict,
) {
  const unitOpts = dict.MATERIAL_UNIT ?? [];
  const priceTypeOpts = buildImportPriceTypeOptions(t);
  const contractTypeOpts = [
    t('app.kuaizhizao.salesContract.contractTypeSingle'),
    t('app.kuaizhizao.salesContract.contractTypeFramework'),
  ];
  return buildFactoryImportTemplate(
    t,
    [
      {
        field: 'code',
        labelKey: 'app.kuaizhizao.salesContract.contractCode',
        aliases: ['合同编号', '编号'],
      },
      {
        field: 'customer',
        required: true,
        labelKey: 'app.kuaizhizao.salesContract.customer',
        aliases: ['客户', '客户名称'],
      },
      {
        field: 'date',
        required: true,
        labelKey: 'app.kuaizhizao.salesContract.contractDate',
        aliases: ['签订日期', '合同日期', '日期'],
      },
      {
        field: 'contractType',
        labelKey: 'app.kuaizhizao.salesContract.contractType',
        aliases: ['合同类型'],
        options: contractTypeOpts,
      },
      {
        field: 'shippingMethod',
        labelKey: 'app.kuaizhizao.salesOrder.shippingMethod',
        aliases: ['发货方式'],
        options: dict.SHIPPING_METHOD,
      },
      {
        field: 'paymentTerms',
        labelKey: 'app.kuaizhizao.salesOrder.paymentTerms',
        aliases: ['付款条件'],
        options: dict.PAYMENT_TERMS,
      },
      {
        field: 'currency',
        labelKey: 'app.kuaizhizao.salesContract.currency',
        aliases: ['币种'],
        options: dict.CURRENCY,
      },
      {
        field: 'priceType',
        labelKey: 'app.kuaizhizao.salesOrder.priceType',
        aliases: ['价格类型'],
        options: priceTypeOpts,
      },
      {
        field: 'material',
        required: true,
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.materialCode',
        aliases: ['产品编号', '物料编号'],
      },
      {
        field: 'quantity',
        required: true,
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.quantity',
        aliases: ['数量'],
      },
      {
        field: 'unitPrice',
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.unitPrice',
        aliases: ['单价'],
      },
      {
        field: 'unit',
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.unit',
        aliases: ['单位'],
        options: unitOpts,
      },
      {
        field: 'delivery',
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.deliveryDate',
        aliases: ['交货日期'],
      },
      {
        field: 'notes',
        labelKey: 'app.kuaizhizao.salesContract.importHeaders.notes',
        aliases: ['备注'],
      },
    ],
    [
      '',
      t('app.kuaizhizao.quotation.importExample.customerName'),
      '2026-01-01',
      pickImportExampleValue(contractTypeOpts, t('app.kuaizhizao.salesContract.contractTypeSingle')),
      '',
      '',
      pickImportExampleValue(dict.CURRENCY, 'CNY'),
      pickImportExampleValue(priceTypeOpts, t('app.kuaizhizao.salesContract.priceTypeTaxInclusive')),
      t('app.kuaizhizao.quotation.importExample.materialCode'),
      '100',
      '1.5',
      pickImportExampleValue(unitOpts, t('app.kuaizhizao.salesContract.defaultUnit')),
      '2026-03-01',
      '',
    ],
  );
}

type CustomerLike = {
  id?: number;
  customer_id?: number;
  name?: string;
  customer_name?: string;
  code?: string;
};

export type ContractListImportPayload = {
  contract_code?: string;
  contract_type: string;
  customer_id: number;
  customer_name: string;
  contract_date: string;
  shipping_method?: string;
  payment_terms?: string;
  currency_code: string;
  price_type: string;
  notes?: string;
  discount_amount: number;
  items: Array<{
    material_id: number;
    material_code: string;
    material_name: string;
    material_spec?: string;
    material_unit: string;
    contract_quantity: number;
    unit_price: number;
    tax_rate: number;
    total_amount: number;
    delivery_date?: string;
    notes?: string;
  }>;
};

export function parseContractListImport(
  data: unknown[][],
  opts: {
    t: TFunction;
    importHeaderMap: Record<string, string>;
    customers: CustomerLike[];
    materials: Material[];
    parseDict?: (dictionaryCode: string, raw?: string | null) => string | undefined;
  },
): {
  errors: Array<{ row: number; message: string }>;
  items: ContractListImportPayload[];
} {
  const { t, importHeaderMap, customers, materials, parseDict } = opts;
  const parse = (code: string, raw?: string | null) =>
    parseDict ? parseDict(code, raw) : String(raw ?? '').trim() || undefined;
  const headers = (data[0] || []).map((h) => String(h || '').trim());
  const rows = (data.slice(2) as unknown[][]).filter((row) =>
    row?.some((c) => c != null && String(c).trim() !== ''),
  );
  const headerIndexMap = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = {
    code: headerIndexMap.code ?? -1,
    customer: headerIndexMap.customer ?? -1,
    date: headerIndexMap.date ?? -1,
    contractType: headerIndexMap.contractType ?? -1,
    shippingMethod: headerIndexMap.shippingMethod ?? -1,
    paymentTerms: headerIndexMap.paymentTerms ?? -1,
    currency: headerIndexMap.currency ?? -1,
    priceType: headerIndexMap.priceType ?? -1,
    material: headerIndexMap.material ?? -1,
    qty: headerIndexMap.quantity ?? -1,
    price: headerIndexMap.unitPrice ?? -1,
    unit: headerIndexMap.unit ?? -1,
    delivery: headerIndexMap.delivery ?? -1,
    notes: headerIndexMap.notes ?? -1,
  };

  const errors: Array<{ row: number; message: string }> = [];
  if (idx.customer < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
    return {
      errors: [
        {
          row: 1,
          message: t('app.kuaizhizao.salesContract.listImport.missingRequiredColumns'),
        },
      ],
      items: [],
    };
  }

  const cell = (row: unknown[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');
  const groupMap = new Map<
    string,
    {
      code?: string;
      customer: string;
      date: string;
      contractType: string;
      shippingMethod?: string;
      paymentTerms?: string;
      currency: string;
      priceType: string;
      notes?: string;
      items: ContractListImportPayload['items'];
    }
  >();

  rows.forEach((row, i) => {
    const rowNum = i + 3;
    const customerName = cell(row, idx.customer);
    const dateVal = cell(row, idx.date);
    const materialCode = cell(row, idx.material);
    const qty = Number(row[idx.qty]);
    if (!customerName) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.quotation.validation.customerRequired'),
      });
      return;
    }
    if (!dateVal) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.salesContract.contractDateRequired'),
      });
      return;
    }
    if (!materialCode) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.quotation.validation.materialRequired'),
      });
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.quotation.validation.qtyPositive'),
      });
      return;
    }
    const mat = materials.find(
      (m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase(),
    );
    if (!mat) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.quotation.validation.materialNotFound', {
          code: materialCode,
        }),
      });
      return;
    }

    const code = cell(row, idx.code);
    const priceType = parseImportPriceType(cell(row, idx.priceType) || undefined, t);
    const unitPrice = idx.price >= 0 ? Number(row[idx.price]) || 0 : 0;
    const taxRate = 0;
    const groupKey = code || `${customerName}|${dateVal}`;
    if (!groupMap.has(groupKey)) {
      const typeRaw = cell(row, idx.contractType);
      const typeLower = typeRaw.toLowerCase();
      const isFramework =
        typeLower === 'framework' ||
        typeRaw === t('app.kuaizhizao.salesContract.contractTypeFramework');
      groupMap.set(groupKey, {
        code: code || undefined,
        customer: customerName,
        date: dateVal,
        contractType: isFramework ? 'framework' : 'single',
        shippingMethod: parse('SHIPPING_METHOD', cell(row, idx.shippingMethod)),
        paymentTerms: parse('PAYMENT_TERMS', cell(row, idx.paymentTerms)),
        currency: parse('CURRENCY', cell(row, idx.currency)) || 'CNY',
        priceType,
        notes: cell(row, idx.notes) || undefined,
        items: [],
      });
    }
    const g = groupMap.get(groupKey)!;
    const unit =
      parse('MATERIAL_UNIT', cell(row, idx.unit)) ||
      (mat as any).baseUnit ||
      (mat as any).base_unit ||
      'PCS';
    g.items.push({
      material_id: Number(mat.id),
      material_code: (mat as any).mainCode || (mat as any).code || materialCode,
      material_name: mat.name || '',
      material_spec: (mat as any).specification || '',
      material_unit: unit,
      contract_quantity: qty,
      unit_price: unitPrice,
      tax_rate: taxRate,
      total_amount: calcContractLineAmounts(qty, unitPrice, taxRate, g.priceType).incl,
      delivery_date: cell(row, idx.delivery) || undefined,
      notes: cell(row, idx.notes) || undefined,
    });
  });

  if (errors.length) return { errors, items: [] };

  const items: ContractListImportPayload[] = [];
  for (const g of groupMap.values()) {
    const cust = customers.find(
      (c) =>
        (c.name || '').trim() === g.customer.trim() ||
        (c.customer_name || '').trim() === g.customer.trim() ||
        (c.code || '').trim() === g.customer.trim(),
    );
    const customerId = Number(cust?.id ?? cust?.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      errors.push({
        row: 0,
        message: t('app.kuaizhizao.salesContract.listImport.customerNotFound', {
          name: g.customer,
        }),
      });
      continue;
    }
    items.push({
      contract_code: g.code,
      contract_type: g.contractType,
      customer_id: customerId,
      customer_name: (cust?.name || cust?.customer_name || g.customer).trim(),
      contract_date: g.date,
      shipping_method: g.shippingMethod,
      payment_terms: g.paymentTerms,
      currency_code: g.currency,
      price_type: g.priceType,
      notes: g.notes,
      discount_amount: 0,
      items: g.items,
    });
  }

  return { errors, items };
}
