/**
 * 销售订单 OCR · 客户/物料比对与按需新建
 */

import { DEFAULT_MATERIAL_BASE_UNIT } from '../../../../../master-data/constants/materialDefaults';
import { materialApi } from '../../../../../master-data/services/material';
import { customerApi } from '../../../../../master-data/services/supply-chain';
import type { CustomerCreate } from '../../../../../master-data/types/supply-chain';
import type { MaterialCreate } from '../../../../../master-data/types/material';
import { generateCode } from '../../../../../../services/codeRule';
import { getPageRuleCode, isAutoGenerateEnabled } from '../../../../../../utils/codeRulePage';
import type { SalesOrderOcrResult } from '../../../../services/sales-order-ocr';

const CUSTOMER_PAGE_CODE = 'master-data-supply-chain-customer';
const MATERIAL_PAGE_CODE = 'master-data-material';

export type OcrMasterMatchStatus = 'matched' | 'will_create' | 'unresolved' | 'empty';

export type CustomerLike = {
  id: number;
  name?: string;
  customer_name?: string;
  code?: string;
  uuid?: string;
};

export type MaterialLike = {
  id: number;
  name?: string;
  mainCode?: string;
  main_code?: string;
  code?: string;
  specification?: string;
  base_unit?: string;
  baseUnit?: string;
};

export function normOcrText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function materialCodeOf(m: MaterialLike): string {
  return (m.mainCode ?? m.main_code ?? m.code ?? '').trim();
}

export function findOcrCustomer(
  customers: CustomerLike[],
  name?: string | null,
): CustomerLike | undefined {
  const target = normOcrText(name);
  if (!target) return undefined;
  return (
    customers.find((c) => normOcrText(c.name ?? c.customer_name) === target) ??
    customers.find((c) => {
      const n = normOcrText(c.name ?? c.customer_name);
      return n.includes(target) || target.includes(n);
    })
  );
}

export function findOcrMaterial(
  materials: MaterialLike[],
  code?: string | null,
  name?: string | null,
): MaterialLike | undefined {
  const codeNorm = normOcrText(code);
  const nameNorm = normOcrText(name);
  if (codeNorm) {
    const byCode = materials.find((m) => normOcrText(materialCodeOf(m)) === codeNorm);
    if (byCode) return byCode;
  }
  if (nameNorm) {
    const exact = materials.find((m) => normOcrText(m.name) === nameNorm);
    if (exact) return exact;
    return materials.find((m) => {
      const n = normOcrText(m.name);
      return n.includes(nameNorm) || nameNorm.includes(n);
    });
  }
  return undefined;
}

function materialDedupeKey(code?: string | null, name?: string | null): string {
  const codeNorm = normOcrText(code);
  if (codeNorm) return `code:${codeNorm}`;
  const nameNorm = normOcrText(name);
  if (nameNorm) return `name:${nameNorm}`;
  return '';
}

async function generateCustomerCode(): Promise<string | undefined> {
  const ruleCode = getPageRuleCode(CUSTOMER_PAGE_CODE);
  if (!ruleCode) return undefined;
  if (!isAutoGenerateEnabled(CUSTOMER_PAGE_CODE)) return undefined;
  try {
    const res = await generateCode({ rule_code: ruleCode });
    return res.code?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export interface OcrCustomerCreateDraft {
  enabled: boolean;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
}

export interface OcrMaterialCreateDraft {
  dedupeKey: string;
  lineIndices: number[];
  enabled: boolean;
  name: string;
  mainCode?: string;
  specification?: string;
  baseUnit: string;
}

export interface OcrCreatePlan {
  customer?: OcrCustomerCreateDraft;
  materials: OcrMaterialCreateDraft[];
  needsConfirmation: boolean;
}

export function buildOcrCreatePlan(
  result: SalesOrderOcrResult,
  customers: CustomerLike[],
  materials: MaterialLike[],
  gates: { canCreateCustomer: boolean; canCreateMaterial: boolean },
): OcrCreatePlan {
  const preview = buildOcrMatchPreview(result, customers, materials, gates);
  let customerDraft: OcrCustomerCreateDraft | undefined;
  if (preview.customer.status === 'will_create' && result.customerName?.trim()) {
    customerDraft = {
      enabled: true,
      name: result.customerName.trim(),
      code: '',
      contactPerson: result.customerContact?.trim() || undefined,
      phone: result.customerPhone?.trim() || undefined,
      address: result.shippingAddress?.trim() || undefined,
    };
  }

  const materialDrafts: OcrMaterialCreateDraft[] = [];
  const draftIndexByKey = new Map<string, number>();

  (result.items ?? []).forEach((row, lineIndex) => {
    const itemPreview = preview.items[lineIndex];
    if (itemPreview?.status !== 'will_create') return;
    const dedupeKey = materialDedupeKey(row.materialCode, row.materialName);
    if (!dedupeKey) return;
    const existingIdx = draftIndexByKey.get(dedupeKey);
    if (existingIdx != null) {
      materialDrafts[existingIdx].lineIndices.push(lineIndex);
      return;
    }
    draftIndexByKey.set(dedupeKey, materialDrafts.length);
    materialDrafts.push({
      dedupeKey,
      lineIndices: [lineIndex],
      enabled: true,
      name: (row.materialName ?? row.materialCode ?? '').trim(),
      mainCode: row.materialCode?.trim() || undefined,
      specification: row.materialSpec?.trim() || undefined,
      baseUnit: row.materialUnit?.trim() || DEFAULT_MATERIAL_BASE_UNIT,
    });
  });

  return {
    customer: customerDraft,
    materials: materialDrafts,
    needsConfirmation: Boolean(customerDraft || materialDrafts.length > 0),
  };
}

export async function prepareOcrCustomerDraftCode(
  draft: OcrCustomerCreateDraft,
): Promise<OcrCustomerCreateDraft> {
  if (draft.code.trim()) return draft;
  const code = await generateCustomerCode();
  return { ...draft, code: code ?? '' };
}

export async function commitOcrCreateDrafts(options: {
  plan: OcrCreatePlan;
  canCreateCustomer: boolean;
  canCreateMaterial: boolean;
  customers: CustomerLike[];
  materials: MaterialLike[];
}): Promise<{
  customers: CustomerLike[];
  materials: MaterialLike[];
  customer?: CustomerLike;
  materialsByDedupeKey: Map<string, MaterialLike>;
  createdCustomerCount: number;
  createdMaterialCount: number;
}> {
  const { plan, canCreateCustomer, canCreateMaterial } = options;
  let customers = [...options.customers];
  let materials = [...options.materials];
  const materialsByDedupeKey = new Map<string, MaterialLike>();
  let customer: CustomerLike | undefined;
  let createdCustomerCount = 0;
  let createdMaterialCount = 0;

  if (plan.customer?.enabled && canCreateCustomer) {
    const draft = plan.customer;
    const name = draft.name.trim();
    if (!name) throw new Error('CUSTOMER_NAME_REQUIRED');
    const code = draft.code.trim() || (await generateCustomerCode());
    if (!code) throw new Error('CUSTOMER_CODE_RULE_REQUIRED');
    const contacts =
      draft.contactPerson || draft.phone
        ? [
            {
              contactPerson: draft.contactPerson?.trim() || undefined,
              phone: draft.phone?.trim() || undefined,
            },
          ]
        : undefined;
    const payload: CustomerCreate = {
      code,
      name,
      address: draft.address?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      contacts,
      isActive: true,
    };
    const created = await customerApi.create(payload);
    customer = created;
    customers = [...customers, created];
    createdCustomerCount = 1;
  }

  if (canCreateMaterial) {
    for (const draft of plan.materials) {
      if (!draft.enabled) continue;
      const name = draft.name.trim();
      if (!name) throw new Error('MATERIAL_NAME_REQUIRED');
      const payload: MaterialCreate = {
        name,
        mainCode: draft.mainCode?.trim() || undefined,
        specification: draft.specification?.trim() || undefined,
        baseUnit: draft.baseUnit?.trim() || DEFAULT_MATERIAL_BASE_UNIT,
        sourceType: 'Buy',
        isActive: true,
      };
      const created = await materialApi.create(payload);
      const normalized: MaterialLike = {
        id: created.id,
        name: created.name,
        mainCode: created.mainCode,
        code: created.code,
        specification: created.specification,
        baseUnit: created.baseUnit,
      };
      materials = [...materials, normalized];
      materialsByDedupeKey.set(draft.dedupeKey, normalized);
      createdMaterialCount += 1;
    }
  }

  return {
    customers,
    materials,
    customer,
    materialsByDedupeKey,
    createdCustomerCount,
    createdMaterialCount,
  };
}

export interface OcrCustomerMatchPreview {
  status: OcrMasterMatchStatus;
  label?: string;
}

export interface OcrMaterialMatchPreview {
  status: OcrMasterMatchStatus;
  label: string;
  subLabel?: string;
}

export function buildOcrMatchPreview(
  result: SalesOrderOcrResult,
  customers: CustomerLike[],
  materials: MaterialLike[],
  gates: { canCreateCustomer: boolean; canCreateMaterial: boolean },
): {
  customer: OcrCustomerMatchPreview;
  items: OcrMaterialMatchPreview[];
} {
  const customerName = result.customerName?.trim();
  let customerStatus: OcrMasterMatchStatus = 'empty';
  if (customerName) {
    customerStatus = findOcrCustomer(customers, customerName)
      ? 'matched'
      : gates.canCreateCustomer
        ? 'will_create'
        : 'unresolved';
  }

  const items = (result.items ?? []).map((row) => {
    const label = row.materialCode || row.materialName || '';
    const subLabel = [row.materialName, row.materialSpec, row.requiredQuantity != null ? `×${row.requiredQuantity}` : null]
      .filter(Boolean)
      .join(' · ');
    if (!label && !row.materialName) {
      return { status: 'empty' as const, label: '', subLabel };
    }
    const matched = findOcrMaterial(materials, row.materialCode, row.materialName);
    const status: OcrMasterMatchStatus = matched
      ? 'matched'
      : gates.canCreateMaterial
        ? 'will_create'
        : 'unresolved';
    return { status, label: label || row.materialName || '', subLabel };
  });

  return {
    customer: { status: customerStatus, label: customerName },
    items,
  };
}

export interface ResolveSalesOrderOcrMastersOptions {
  result: SalesOrderOcrResult;
  customers: CustomerLike[];
  materials: MaterialLike[];
  /** 用户在确认弹窗中新建的客户 */
  createdCustomer?: CustomerLike;
  /** 用户在确认弹窗中新建的物料（按去重键） */
  createdMaterialsByDedupeKey?: Map<string, MaterialLike>;
}

export interface ResolveSalesOrderOcrMastersResult {
  customers: CustomerLike[];
  materials: MaterialLike[];
  customer?: CustomerLike;
  lineMaterials: Array<MaterialLike | undefined>;
  createdCustomerCount: number;
  createdMaterialCount: number;
  unresolvedCustomer: boolean;
  unresolvedMaterialCount: number;
}

export async function resolveSalesOrderOcrMasters(
  options: ResolveSalesOrderOcrMastersOptions,
): Promise<ResolveSalesOrderOcrMastersResult> {
  const { result, createdCustomer, createdMaterialsByDedupeKey } = options;
  let customers = [...options.customers];
  let materials = [...options.materials];

  let customer = findOcrCustomer(customers, result.customerName);
  if (!customer && createdCustomer) {
    customer = createdCustomer;
    customers = [...customers, createdCustomer];
  }

  const createdCustomerCount = createdCustomer ? 1 : 0;
  const unresolvedCustomer = !customer && Boolean(result.customerName?.trim());

  if (createdMaterialsByDedupeKey?.size) {
    for (const material of createdMaterialsByDedupeKey.values()) {
      if (!materials.some((m) => m.id === material.id)) {
        materials = [...materials, material];
      }
    }
  }

  const lineMaterials: Array<MaterialLike | undefined> = [];
  let unresolvedMaterialCount = 0;

  for (const row of result.items ?? []) {
    let matched = findOcrMaterial(materials, row.materialCode, row.materialName);
    const dedupeKey = materialDedupeKey(row.materialCode, row.materialName);

    if (!matched && dedupeKey && createdMaterialsByDedupeKey?.has(dedupeKey)) {
      matched = createdMaterialsByDedupeKey.get(dedupeKey);
    }

    if (!matched && (row.materialCode?.trim() || row.materialName?.trim())) {
      unresolvedMaterialCount += 1;
    }

    lineMaterials.push(matched);
  }

  const createdMaterialCount = createdMaterialsByDedupeKey?.size ?? 0;

  return {
    customers,
    materials,
    customer,
    lineMaterials,
    createdCustomerCount,
    createdMaterialCount,
    unresolvedCustomer,
    unresolvedMaterialCount,
  };
}
