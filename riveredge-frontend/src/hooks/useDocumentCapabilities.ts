/**
 * 单据业务态 capabilities 与 RBAC 合成（报价单试点）。
 * capabilities 来自后端 list/detail；不含 RBAC。
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { Quotation } from '../apps/kuaizhizao/services/quotation';
import type { ResourcePermissionGates } from './useResourcePermissions';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface CapabilityActionView {
  /** 业务态是否允许 */
  allowed: boolean;
  /** 合成禁用：业务态或 RBAC 不允许 */
  disabled: boolean;
  /** 禁用原因（tooltip） */
  title?: string;
}

/** 与后端 CAPABILITY_REASON_MESSAGES 对齐 */
export const QUOTATION_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'quotation.delete.not_allowed': '只能删除草稿、已驳回或待审核状态的报价单',
  'quotation.delete.linked_sales_order': '已关联有效销售订单的报价单不能删除',
  'quotation.delete.linked_contract': '已关联销售合同的报价单不能删除',
  'quotation.update.not_draft': '只能更新草稿状态的报价单',
  'quotation.confirm.not_sent': '仅已发送状态的报价单可客户确认',
  'quotation.confirm.not_approved': '请先完成审核通过后再标记客户确认',
  'quotation.cancel_customer_confirm.not_allowed': '当前状态不可取消客户确认',
  'quotation.cancel_customer_confirm.linked_contract': '已关联有效销售合同，请先处理合同后再取消确认',
  'quotation.convert_order.not_allowed': '当前状态不可转销售订单',
  'quotation.convert_order.linked_contract': '该报价已关联销售合同，请从销售合同下推订单',
  'quotation.convert_order.not_latest': '仅能对当前系列的最新版本报价单转销售订单',
  'quotation.convert_order.already_converted': '该报价单已转为销售订单',
  'quotation.convert_contract.not_allowed': '当前状态不可转销售合同',
  'quotation.convert_contract.linked_contract': '该报价单已关联销售合同',
  'quotation.convert_contract.linked_sales_order': '该报价单已关联销售订单',
  'quotation.convert_contract.superseded': '此为历史版本报价单，请使用系列最新版',
  'quotation.revoke_push.not_allowed': '仅已转订单且下游销售订单已删除时可撤回下推',
  'quotation.reopen.not_rejected': '仅已驳回的报价单可重新编辑',
  'quotation.revision.not_allowed': '仅非草稿的最新系列版本可新建修订版',
  'quotation.print.not_allowed': '正式报价 PDF 须在审核通过、客户确认或已转单后生成',
};

export function quotationCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.quotation.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return QUOTATION_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

function capView(
  cap: ActionCapability | undefined,
  permAllowed: boolean,
  permDeniedTitle?: string,
  t?: TFunction,
): CapabilityActionView {
  const bizAllowed = cap?.allowed === true;
  const disabled = !bizAllowed || !permAllowed;
  let title: string | undefined;
  if (!permAllowed) {
    title = permDeniedTitle;
  } else if (!bizAllowed) {
    title = quotationCapabilityReasonMessage(cap?.reason, t);
  }
  return { allowed: bizAllowed, disabled, title };
}

export function useQuotationCapabilities(
  record: Quotation | null | undefined,
  quotationPerms: ResourcePermissionGates,
  salesContractPerms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;

  return useMemo(
    () => ({
      update: capView(caps?.update, quotationPerms.canUpdate, permDeniedTitle, t),
      delete: capView(caps?.delete, quotationPerms.canDelete, permDeniedTitle, t),
      confirmCustomer: capView(
        caps?.confirm_customer,
        quotationPerms.canAction?.('execute') ?? false,
        permDeniedTitle,
        t,
      ),
      cancelCustomerConfirm: capView(
        caps?.cancel_customer_confirm,
        quotationPerms.canAction?.('execute') ?? false,
        permDeniedTitle,
        t,
      ),
      convertToOrder: capView(caps?.convert_to_order, quotationPerms.canUpdate, permDeniedTitle, t),
      convertToContract: capView(
        caps?.convert_to_contract,
        salesContractPerms.canCreate,
        permDeniedTitle,
        t,
      ),
      revokePush: capView(caps?.revoke_push, quotationPerms.canUpdate, permDeniedTitle, t),
      reopen: capView(caps?.reopen, quotationPerms.canUpdate, permDeniedTitle, t),
      createRevision: capView(caps?.create_revision, quotationPerms.canCreate, permDeniedTitle, t),
      printFormal: capView(caps?.print_formal, quotationPerms.canPrint, permDeniedTitle, t),
    }),
    [caps, quotationPerms, salesContractPerms, t, permDeniedTitle],
  );
}

export type QuotationCapabilityGates = ReturnType<typeof useQuotationCapabilities>;

const PENDING_REVIEW_STATUSES = new Set(['待审核', 'PENDING', 'PENDING_REVIEW', '']);

/** 选中行中是否存在可批量删除的报价单 */
export function quotationBatchDeleteAllowed(
  records: Quotation[],
  canDelete: boolean,
): boolean {
  if (!canDelete || records.length === 0) return false;
  return records.some((q) => q.capabilities?.delete?.allowed === true);
}

/** 选中行中是否存在可批量审核通过的报价单 */
export function quotationBatchApproveAllowed(
  records: Quotation[],
  canApprove: boolean,
): boolean {
  if (!canApprove || records.length === 0) return false;
  return records.some((q) => {
    const st = (q.status || '').trim();
    const rs = (q.review_status || '').trim();
    return st === '已发送' && (PENDING_REVIEW_STATUSES.has(rs) || rs === '');
  });
}

/** capabilities 为唯一业务门控（与后端 derive_quotation_capabilities 一致） */
export function quotationCapabilityAllowed(
  record: Quotation,
  key: 'convert_to_order' | 'convert_to_contract',
): boolean {
  return record.capabilities?.[key]?.allowed === true;
}

/** 转销售订单 RBAC：路由映射为 update；兼容仅授予 execute 的角色 */
export function quotationCanPushToSalesOrder(
  quotationPerms: ResourcePermissionGates,
): boolean {
  return quotationPerms.canUpdate || quotationPerms.canAction?.('execute') === true;
}

/** 列表行是否允许勾选（用于 rowSelection；与「仅可删」不同，需覆盖下推/确认/打印等工具栏操作） */
export function isQuotationRowSelectable(
  record: Quotation,
  auditRequired = true,
): boolean {
  const caps = record.capabilities;
  if (!caps) {
    // 后端尚未下发 capabilities 时保持可选，避免整表锁死
    return true;
  }
  if (
    caps.delete?.allowed ||
    caps.update?.allowed ||
    caps.submit?.allowed ||
    caps.confirm_customer?.allowed ||
    caps.cancel_customer_confirm?.allowed ||
    caps.convert_to_order?.allowed ||
    caps.convert_to_contract?.allowed ||
    caps.print_formal?.allowed ||
    caps.create_revision?.allowed ||
    caps.reopen?.allowed ||
    caps.revoke_push?.allowed
  ) {
    return true;
  }
  if (auditRequired && (record.status || '').trim() === '已发送') {
    const rs = (record.review_status || '').trim();
    if (PENDING_REVIEW_STATUSES.has(rs) || rs === '') return true;
  }
  return false;
}
