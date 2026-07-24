/**
 * 销售/采购退货列表批量导入：表头 + 明细行合并。
 */
import type { TFunction } from 'i18next';

import type { Material } from '../../../master-data/types/material';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../utils/spreadsheetImportTemplate';
import { pickImportExampleValue } from '../../../../utils/loadImportDictionaryValues';

export type ReturnListImportDict = {
  MATERIAL_UNIT?: string[];
  RETURN_REASON?: string[];
  RETURN_TYPE?: string[];
  SHIPPING_METHOD?: string[];
  parseDict?: (dictionaryCode: string, raw?: string | null) => string | undefined;
};

export type ReturnListPartner = {
  id?: number;
  customer_id?: number;
  supplier_id?: number;
  name?: string;
  customer_name?: string;
  supplier_name?: string;
  code?: string;
};

export type ReturnListWarehouse = {
  id?: number;
  name?: string;
  code?: string;
};

export type ReturnListImportLine = {
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string;
  material_unit: string;
  return_quantity: number;
  unit_price: number;
  total_amount: number;
  batch_number?: string;
  location_code?: string;
  notes?: string;
};

export type ReturnListImportPayload = {
  return_code?: string;
  partner_id: number;
  partner_name: string;
  warehouse_id: number;
  warehouse_name: string;
  return_time: string;
  return_reason?: string;
  return_type: string;
  shipping_method?: string;
  notes?: string;
  items: ReturnListImportLine[];
};

type BuildOpts = {
  partnerField: 'customer' | 'supplier';
  codeLabelKey: string;
  partnerLabelKey: string;
  partnerAliases: string[];
  materialLabelKey: string;
  unitLabelKey: string;
  qtyLabelKey: string;
  unitPriceLabelKey: string;
  batchLabelKey: string;
  locationLabelKey: string;
  notesLabelKey: string;
  defaultUnit: string;
  examplePartner: string;
  exampleMaterial: string;
  exampleWarehouse: string;
};

export function buildDocumentReturnListImportTemplate(
  t: TFunction,
  dict: ReturnListImportDict,
  opts: BuildOpts,
) {
  const unitOpts = dict.MATERIAL_UNIT ?? [];
  const reasonOpts = dict.RETURN_REASON?.length
    ? dict.RETURN_REASON
    : ['QUALITY_ISSUE', 'OTHER'];
  const typeOpts = dict.RETURN_TYPE?.length ? dict.RETURN_TYPE : ['EXCHANGE', 'OTHER'];
  const shipOpts = dict.SHIPPING_METHOD?.length ? dict.SHIPPING_METHOD : ['EXPRESS', 'LOGISTICS'];

  return buildFactoryImportTemplate(
    t,
    [
      {
        field: 'code',
        labelKey: opts.codeLabelKey,
        aliases: ['退货单号', '退货单编号', '编号'],
      },
      {
        field: opts.partnerField,
        required: true,
        labelKey: opts.partnerLabelKey,
        aliases: opts.partnerAliases,
      },
      {
        field: 'warehouse',
        required: true,
        labelKey:
          opts.partnerField === 'supplier'
            ? 'app.kuaizhizao.purchaseReturn.returnWarehouse'
            : 'app.kuaizhizao.salesReturn.returnWarehouse',
        aliases: ['仓库', '仓库名称', '退货仓库', '退入仓库'],
      },
      {
        field: 'returnTime',
        required: true,
        labelKey: 'app.kuaizhizao.salesReturn.returnDate',
        aliases: ['退货日期', '退货时间', '日期'],
      },
      {
        field: 'returnReason',
        labelKey: 'app.kuaizhizao.salesReturn.returnReason',
        aliases: ['退货原因'],
        options: reasonOpts,
      },
      {
        field: 'returnType',
        labelKey:
          opts.partnerField === 'supplier'
            ? 'app.kuaizhizao.purchaseReturn.returnType'
            : 'app.kuaizhizao.salesReturn.returnType',
        aliases: ['退货类型'],
        options: typeOpts,
      },
      {
        field: 'shippingMethod',
        labelKey: 'app.kuaizhizao.purchaseReturn.shippingMethod',
        aliases: ['退货方式', '发货方式'],
        options: shipOpts,
      },
      {
        field: 'material',
        required: true,
        labelKey: opts.materialLabelKey,
        aliases: ['产品编号', '物料编号', '物料编码'],
      },
      {
        field: 'unit',
        labelKey: opts.unitLabelKey,
        aliases: ['单位'],
        options: unitOpts,
      },
      {
        field: 'quantity',
        required: true,
        labelKey: opts.qtyLabelKey,
        aliases: ['退货数量', '数量'],
      },
      {
        field: 'unitPrice',
        labelKey: opts.unitPriceLabelKey,
        aliases: ['单价'],
      },
      {
        field: 'batch',
        labelKey: opts.batchLabelKey,
        aliases: ['批次号', '批号'],
      },
      {
        field: 'location',
        labelKey: opts.locationLabelKey,
        aliases: ['库位'],
      },
      {
        field: 'notes',
        labelKey: opts.notesLabelKey,
        aliases: ['备注'],
      },
    ],
    [
      '',
      opts.examplePartner,
      opts.exampleWarehouse,
      '2026-01-17',
      pickImportExampleValue(reasonOpts, 'QUALITY_ISSUE'),
      pickImportExampleValue(typeOpts, 'EXCHANGE'),
      pickImportExampleValue(shipOpts, 'EXPRESS'),
      opts.exampleMaterial,
      pickImportExampleValue(unitOpts, opts.defaultUnit),
      '10',
      '99.5',
      '',
      '',
      '',
    ],
  );
}

function matchPartner(partners: ReturnListPartner[], name: string): ReturnListPartner | undefined {
  const n = name.trim();
  return partners.find(
    (p) =>
      (p.name || '').trim() === n ||
      (p.customer_name || '').trim() === n ||
      (p.supplier_name || '').trim() === n ||
      (p.code || '').trim() === n,
  );
}

function matchWarehouse(
  warehouses: ReturnListWarehouse[],
  name: string,
): ReturnListWarehouse | undefined {
  const n = name.trim();
  return warehouses.find(
    (w) => (w.name || '').trim() === n || (w.code || '').trim() === n,
  );
}

export function parseDocumentReturnListImport(
  data: unknown[][],
  opts: {
    t: TFunction;
    importHeaderMap: Record<string, string>;
    partnerField: 'customer' | 'supplier';
    partners: ReturnListPartner[];
    warehouses: ReturnListWarehouse[];
    materials: Material[];
    defaultUnit: string;
    defaultReturnType: string;
    parseDict?: (dictionaryCode: string, raw?: string | null) => string | undefined;
  },
): {
  errors: Array<{ row: number; message: string }>;
  items: ReturnListImportPayload[];
} {
  const {
    t,
    importHeaderMap,
    partnerField,
    partners,
    warehouses,
    materials,
    defaultUnit,
    defaultReturnType,
    parseDict,
  } = opts;
  const parse = (code: string, raw?: string | null) =>
    parseDict ? parseDict(code, raw) : String(raw ?? '').trim() || undefined;
  const headers = (data[0] || []).map((h) => String(h || '').trim());
  const rows = (data.slice(2) as unknown[][]).filter((row) =>
    row?.some((c) => c != null && String(c).trim() !== ''),
  );
  const headerIndexMap = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = {
    code: headerIndexMap.code ?? -1,
    partner: headerIndexMap[partnerField] ?? -1,
    warehouse: headerIndexMap.warehouse ?? -1,
    returnTime: headerIndexMap.returnTime ?? -1,
    returnReason: headerIndexMap.returnReason ?? -1,
    returnType: headerIndexMap.returnType ?? -1,
    shippingMethod: headerIndexMap.shippingMethod ?? -1,
    material: headerIndexMap.material ?? -1,
    unit: headerIndexMap.unit ?? -1,
    qty: headerIndexMap.quantity ?? -1,
    price: headerIndexMap.unitPrice ?? -1,
    batch: headerIndexMap.batch ?? -1,
    location: headerIndexMap.location ?? -1,
    notes: headerIndexMap.notes ?? -1,
  };

  const errors: Array<{ row: number; message: string }> = [];
  if (idx.partner < 0 || idx.warehouse < 0 || idx.returnTime < 0 || idx.material < 0 || idx.qty < 0) {
    return {
      errors: [
        {
          row: 1,
          message: t('app.kuaizhizao.salesReturn.listImport.missingRequiredColumns'),
        },
      ],
      items: [],
    };
  }

  const cell = (row: unknown[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');
  type Group = {
    code?: string;
    partner: string;
    warehouse: string;
    returnTime: string;
    returnReason?: string;
    returnType: string;
    shippingMethod?: string;
    notes?: string;
    items: ReturnListImportLine[];
  };
  const groupMap = new Map<string, Group>();

  rows.forEach((row, i) => {
    const rowNum = i + 3;
    const partnerName = cell(row, idx.partner);
    const warehouseName = cell(row, idx.warehouse);
    const returnTime = cell(row, idx.returnTime);
    const materialCode = cell(row, idx.material);
    const qty = Number(row[idx.qty]);

    if (!partnerName) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.salesReturn.listImport.partnerRequired'),
      });
      return;
    }
    if (!warehouseName) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.salesReturn.listImport.warehouseRequired'),
      });
      return;
    }
    if (!returnTime) {
      errors.push({
        row: rowNum,
        message: t('app.kuaizhizao.salesReturn.listImport.returnTimeRequired'),
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
    const groupKey = code || `${partnerName}|${warehouseName}|${returnTime}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        code: code || undefined,
        partner: partnerName,
        warehouse: warehouseName,
        returnTime,
        returnReason: parse('RETURN_REASON', cell(row, idx.returnReason)),
        returnType: parse('RETURN_TYPE', cell(row, idx.returnType)) || defaultReturnType,
        shippingMethod: parse('SHIPPING_METHOD', cell(row, idx.shippingMethod)),
        notes: cell(row, idx.notes) || undefined,
        items: [],
      });
    }
    const g = groupMap.get(groupKey)!;
    const unit =
      parse('MATERIAL_UNIT', cell(row, idx.unit)) ||
      (mat as any).baseUnit ||
      (mat as any).base_unit ||
      defaultUnit;
    const unitPrice = idx.price >= 0 ? Number(row[idx.price]) || 0 : 0;
    const total = Number((qty * unitPrice).toFixed(2));
    g.items.push({
      material_id: Number(mat.id),
      material_code: (mat as any).mainCode || (mat as any).code || materialCode,
      material_name: mat.name || '',
      material_spec: (mat as any).specification || '',
      material_unit: unit,
      return_quantity: qty,
      unit_price: unitPrice,
      total_amount: total,
      batch_number: cell(row, idx.batch) || undefined,
      location_code: cell(row, idx.location) || undefined,
      notes: cell(row, idx.notes) || undefined,
    });
  });

  if (errors.length) return { errors, items: [] };

  const items: ReturnListImportPayload[] = [];
  for (const g of groupMap.values()) {
    const partner = matchPartner(partners, g.partner);
    const partnerId = Number(partner?.id ?? partner?.customer_id ?? partner?.supplier_id);
    if (!Number.isFinite(partnerId) || partnerId <= 0) {
      errors.push({
        row: 0,
        message: t('app.kuaizhizao.salesReturn.listImport.partnerNotFound', {
          name: g.partner,
        }),
      });
      continue;
    }
    const warehouse = matchWarehouse(warehouses, g.warehouse);
    const warehouseId = Number(warehouse?.id);
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
      errors.push({
        row: 0,
        message: t('app.kuaizhizao.salesReturn.listImport.warehouseNotFound', {
          name: g.warehouse,
        }),
      });
      continue;
    }
    items.push({
      return_code: g.code,
      partner_id: partnerId,
      partner_name: (partner?.name || partner?.customer_name || partner?.supplier_name || g.partner).trim(),
      warehouse_id: warehouseId,
      warehouse_name: (warehouse?.name || g.warehouse).trim(),
      return_time: g.returnTime,
      return_reason: g.returnReason,
      return_type: g.returnType,
      shipping_method: g.shippingMethod,
      notes: g.notes,
      items: g.items,
    });
  }

  return { errors, items };
}
