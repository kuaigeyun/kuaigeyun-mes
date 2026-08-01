/**
 * 物料列表：客户料号导入（写入物料 customerCodes）
 */

import type { TFunction } from 'i18next';

import type { Customer } from '../types/supply-chain';
import type { CustomerCodeMapping, Material } from '../types/material';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export interface MaterialCustomerCodeImportRow {
  rowNum: number;
  mainCode: string;
  customerId: number;
  customerName?: string;
  code: string;
  name?: string;
  description?: string;
}

export interface MaterialCustomerCodeImportColumnIndex {
  mainCode: number;
  customerCode: number;
  customerName: number;
  customerPartCode: number;
  customerPartName: number;
  description: number;
}

export interface MaterialCustomerCodeImportGroup {
  mainCode: string;
  rowNums: number[];
  customerCodes: CustomerCodeMapping[];
}

export function buildMaterialCustomerCodeImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialCustomerCodeImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    mainCode: idx('mainCode'),
    customerCode: idx('customerCode'),
    customerName: idx('customerName'),
    customerPartCode: idx('customerPartCode'),
    customerPartName: idx('customerPartName'),
    description: idx('description'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

export function resolveCustomerForImport(
  customerCode: string,
  customerName: string,
  customers: Customer[],
): Customer | null {
  const code = customerCode.trim();
  const name = customerName.trim();
  if (code) {
    const byCode = customers.find((c) => (c.code || '').trim() === code);
    if (byCode) return byCode;
  }
  if (name) {
    const byName = customers.find((c) => (c.name || '').trim() === name);
    if (byName) return byName;
  }
  return null;
}

export function extractCustomerCodesFromMaterial(material: Material): CustomerCodeMapping[] {
  const aliases = material.codeAliases ?? (material as { code_aliases?: unknown[] }).code_aliases;
  if (!Array.isArray(aliases)) return [];

  const result: CustomerCodeMapping[] = [];
  for (const alias of aliases as Array<Record<string, unknown>>) {
    const codeType = String(alias.code_type ?? alias.codeType ?? '').toUpperCase();
    const externalEntityType = String(alias.external_entity_type ?? alias.externalEntityType ?? '');
    if (codeType !== 'CUSTOMER' && externalEntityType !== 'customer') continue;
    const rawCustomerId = alias.external_entity_id ?? alias.customerId ?? alias.customer_id;
    const customerId =
      rawCustomerId != null && rawCustomerId !== '' ? Number(rawCustomerId) : undefined;
    result.push({
      customerId: Number.isFinite(customerId) ? customerId! : 0,
      code: String(alias.code ?? '').trim(),
      name: alias.name != null ? String(alias.name) : undefined,
      description: alias.description != null ? String(alias.description) : undefined,
    });
  }
  return result.filter((c) => c.customerId > 0 && c.code);
}

export function mergeCustomerCodes(
  existing: CustomerCodeMapping[],
  incoming: CustomerCodeMapping[],
): CustomerCodeMapping[] {
  const merged = [...existing];
  for (const row of incoming) {
    const idx = merged.findIndex(
      (c) => c.customerId === row.customerId && c.code === row.code,
    );
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...row };
    } else {
      merged.push(row);
    }
  }
  return merged;
}

export function parseMaterialCustomerCodeImportRows(
  rows: unknown[][],
  idx: MaterialCustomerCodeImportColumnIndex,
  customers: Customer[],
  rowOffset = 3,
  t?: TFunction,
): { groups: MaterialCustomerCodeImportGroup[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const parsedRows: MaterialCustomerCodeImportRow[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const mainCode = cell(row, idx.mainCode);
    const customerCode = cell(row, idx.customerCode);
    const customerName = cell(row, idx.customerName);
    const partCode = cell(row, idx.customerPartCode);
    const partName = cell(row, idx.customerPartName);
    const description = cell(row, idx.description);

    if (!mainCode) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importCustomerCodes.mainCodeRequired') ?? '主编码不能为空',
      });
      return;
    }
    if (!customerCode && !customerName) {
      errors.push({
        row: rowNum,
        message:
          t?.('app.master-data.materials.importCustomerCodes.customerRequired') ??
          '客户编码或客户名称至少填一项',
      });
      return;
    }
    if (!partCode) {
      errors.push({
        row: rowNum,
        message:
          t?.('app.master-data.materials.importCustomerCodes.partCodeRequired') ?? '客户料号不能为空',
      });
      return;
    }

    const customer = resolveCustomerForImport(customerCode, customerName, customers);
    if (!customer) {
      errors.push({
        row: rowNum,
        message:
          t?.('app.master-data.materials.importCustomerCodes.customerNotFound', {
            value: customerCode || customerName,
          }) ?? `未找到客户：${customerCode || customerName}`,
      });
      return;
    }

    parsedRows.push({
      rowNum,
      mainCode,
      customerId: customer.id,
      customerName: customer.name,
      code: partCode,
      name: partName || undefined,
      description: description || undefined,
    });
  });

  const groupMap = new Map<string, MaterialCustomerCodeImportGroup>();
  for (const row of parsedRows) {
    const key = row.mainCode.trim().toUpperCase();
    let group = groupMap.get(key);
    if (!group) {
      group = { mainCode: row.mainCode.trim(), rowNums: [], customerCodes: [] };
      groupMap.set(key, group);
    }
    group.rowNums.push(row.rowNum);
    group.customerCodes.push({
      customerId: row.customerId,
      customerName: row.customerName,
      code: row.code,
      name: row.name,
      description: row.description,
    });
  }

  for (const group of groupMap.values()) {
    group.customerCodes = mergeCustomerCodes([], group.customerCodes);
  }

  return { groups: [...groupMap.values()], errors };
}
