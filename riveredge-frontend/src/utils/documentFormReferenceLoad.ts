/**
 * 业务单据表单引用数据加载（走 reference display + host_resource 隐式授权）。
 */

import type { Material } from '../apps/master-data/types/material';
import type { Customer, Supplier } from '../apps/master-data/types/supply-chain';
import { formatBankAccountOptionLabel } from '../apps/kuaicaiwu/utils/financeSharedOptions';
import {
  searchReferenceDisplay,
  searchReferenceDisplayAll,
  resolveReferenceDisplay,
  referenceDisplayToIdOptions,
  type ReferenceDisplayItem,
} from './referenceDisplay';

export type DocumentFormSelectOption = { label: string; value: number };

/** 快智造常见单据宿主 resource（{app}:{module}） */
export const KUAIZHIZAO_DOC_HOST = {
  salesOrder: 'kuaizhizao:sales-order',
  salesOrderChange: 'kuaizhizao:sales-order-change',
  salesContract: 'kuaizhizao:sales-contract',
  quotation: 'kuaizhizao:quotation',
  shipmentNotice: 'kuaizhizao:shipment-notice',
  salesReturn: 'kuaizhizao:sales-return',
  customerFollowUp: 'kuaizhizao:customer-follow-up',
  purchaseOrder: 'kuaizhizao:purchase-order',
  purchaseOrderChange: 'kuaizhizao:purchase-order-change',
  purchaseRequisition: 'kuaizhizao:purchase-requisition',
  purchaseReturn: 'kuaizhizao:purchase-return',
  receiptNotice: 'kuaizhizao:receipt-notice',
  purchaseInquiry: 'kuaizhizao:purchase-inquiry',
  workOrder: 'kuaizhizao:work-order',
  afterSalesInstall: 'kuaizhizao:after-sales-install',
  salesDelivery: 'kuaizhizao:sales-delivery',
  barcodeMappingRules: 'kuaizhizao:warehouse-management-barcode-mapping-rules',
  afterSalesTicket: 'kuaizhizao:after-sales-ticket',
  salesReview: 'kuaizhizao:sales-review',
} as const;

export async function loadBankAccountFormOptions(
  hostResource: string,
): Promise<DocumentFormSelectOption[]> {
  try {
    const items = await searchReferenceDisplayAll(
      {
        resource: 'kuaicaiwu:bank-account',
        hostResource,
        isActive: true,
      },
      500,
    );
    return referenceDisplayItemsToBankAccountOptions(items);
  } catch {
    return [];
  }
}

export function referenceDisplayItemsToBankAccountOptions(
  items: ReferenceDisplayItem[],
): DocumentFormSelectOption[] {
  return items
    .filter((item) => item.id != null)
    .map((item) => {
      const extra = item.extra ?? {};
      const accountName = String(item.name ?? extra.account_name ?? item.code ?? '').trim();
      return {
        label: formatBankAccountOptionLabel({
          account_name: accountName,
          account_number: (extra.account_number as string | null | undefined) ?? null,
          account_type: (extra.account_type as string | null | undefined) ?? null,
        }),
        value: item.id as number,
      };
    });
}

export async function loadCustomerFormReferenceList(hostResource: string): Promise<Customer[]> {
  try {
    const items = await searchReferenceDisplayAll(
      {
        resource: 'master-data:supply-chain:customer',
        hostResource,
        isActive: true,
      },
      2000,
    );
    return referenceDisplayItemsToCustomers(items);
  } catch {
    return [];
  }
}

export function referenceDisplayItemsToCustomers(items: ReferenceDisplayItem[]): Customer[] {
  return items
    .filter((item) => item.id != null)
    .map(
      (item) =>
        ({
          id: item.id as number,
          uuid: item.uuid ?? undefined,
          code: item.code ?? undefined,
          name: item.name ?? undefined,
        }) as Customer,
    );
}

export async function loadSupplierFormReferenceList(hostResource: string): Promise<Supplier[]> {
  try {
    const items = await searchReferenceDisplayAll(
      {
        resource: 'master-data:supply-chain:supplier',
        hostResource,
        isActive: true,
      },
      2000,
    );
    return referenceDisplayItemsToSuppliers(items);
  } catch {
    return [];
  }
}

export function referenceDisplayItemsToSuppliers(items: ReferenceDisplayItem[]): Supplier[] {
  return items
    .filter((item) => item.id != null)
    .map(
      (item) =>
        ({
          id: item.id as number,
          uuid: item.uuid ?? undefined,
          code: item.code ?? undefined,
          name: item.name ?? undefined,
        }) as Supplier,
    );
}

export async function loadMaterialFormReferenceList(hostResource: string): Promise<Material[]> {
  try {
    const items = await searchReferenceDisplayAll(
      {
        resource: 'master-data:material',
        hostResource,
        isActive: true,
      },
      2000,
    );
    return referenceDisplayItemsToMaterials(items);
  } catch {
    return [];
  }
}

export async function resolveMaterialFormReference(
  hostResource: string,
  recordIds: number[],
): Promise<Material[]> {
  if (recordIds.length === 0) return [];
  try {
    const items = await resolveReferenceDisplay({
      resource: 'master-data:material',
      recordIds,
      hostResource,
    });
    return referenceDisplayItemsToMaterials(items);
  } catch {
    return [];
  }
}

export async function searchMaterialFormReferenceOptions(
  hostResource: string,
  keyword?: string,
  limit = 100,
): Promise<DocumentFormSelectOption[]> {
  try {
    const res = await searchReferenceDisplay({
      resource: 'master-data:material',
      hostResource,
      keyword,
      pageSize: limit,
      isActive: true,
    });
    return referenceDisplayToIdOptions(res.items ?? []);
  } catch {
    return [];
  }
}

export function referenceDisplayItemsToMaterials(items: ReferenceDisplayItem[]): Material[] {
  return items
    .filter((item) => item.id != null)
    .map((item) => {
      const extra = item.extra ?? {};
      const code = String(item.code ?? extra.main_code ?? '').trim();
      return {
        id: item.id as number,
        uuid: item.uuid ?? undefined,
        mainCode: code,
        main_code: String(extra.main_code ?? code),
        code,
        name: item.name ?? undefined,
        specification: extra.specification as string | undefined,
        base_unit: extra.base_unit as string | undefined,
        source_type: extra.source_type as string | undefined,
        group_id: extra.group_id as number | undefined,
        images: extra.images,
      } as Material;
    });
}
