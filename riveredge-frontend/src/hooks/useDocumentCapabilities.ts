/**
 * 单据业务态 capabilities 与 RBAC 合成（报价单试点）。
 * capabilities 来自后端 list/detail；不含 RBAC。
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { Quotation } from '../apps/kuaizhizao/services/quotation';
import type { SalesOrder } from '../apps/kuaizhizao/services/sales-order';
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
  'quotation.withdraw_submit.not_pending': '仅待审核的报价单可撤回提交',
  'quotation.approve.not_pending': '仅待审核的报价单可审核通过',
  'quotation.revoke_approval.not_allowed': '当前状态不可撤回审核',
  'quotation.revoke_approval.not_approved': '仅已审核通过的报价单可撤回审核',
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
  reasonMessages?: Record<string, string>,
  i18nPrefix?: string,
): CapabilityActionView {
  const bizAllowed = cap?.allowed === true;
  const disabled = !bizAllowed || !permAllowed;
  let title: string | undefined;
  if (!permAllowed) {
    title = permDeniedTitle;
  } else if (!bizAllowed) {
    title = salesOrderCapabilityReasonMessage(cap?.reason, t, reasonMessages, i18nPrefix);
  }
  return { allowed: bizAllowed, disabled, title };
}

function quotationCapView(
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
      update: quotationCapView(caps?.update, quotationPerms.canUpdate, permDeniedTitle, t),
      delete: quotationCapView(caps?.delete, quotationPerms.canDelete, permDeniedTitle, t),
      confirmCustomer: quotationCapView(
        caps?.confirm_customer,
        quotationPerms.canAction?.('execute') ?? false,
        permDeniedTitle,
        t,
      ),
      cancelCustomerConfirm: quotationCapView(
        caps?.cancel_customer_confirm,
        quotationPerms.canAction?.('execute') ?? false,
        permDeniedTitle,
        t,
      ),
      convertToOrder: quotationCapView(caps?.convert_to_order, quotationPerms.canUpdate, permDeniedTitle, t),
      convertToContract: quotationCapView(
        caps?.convert_to_contract,
        salesContractPerms.canCreate,
        permDeniedTitle,
        t,
      ),
      revokePush: quotationCapView(caps?.revoke_push, quotationPerms.canUpdate, permDeniedTitle, t),
      reopen: quotationCapView(caps?.reopen, quotationPerms.canUpdate, permDeniedTitle, t),
      createRevision: quotationCapView(caps?.create_revision, quotationPerms.canCreate, permDeniedTitle, t),
      printFormal: quotationCapView(caps?.print_formal, quotationPerms.canPrint, permDeniedTitle, t),
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

/** 与后端 CAPABILITY_REASON_MESSAGES 对齐 */
export const SALES_ORDER_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_order.update.not_allowed': '只能更新草稿或待审核的销售订单',
  'sales_order.update.locked': '销售订单已生效或执行中，禁止直接修改，请通过销售变更单变更',
  'sales_order.delete.not_allowed': '只能删除草稿或待审核状态的订单',
  'sales_order.submit.not_draft': '只能提交草稿状态的订单',
  'sales_order.approve.not_pending': '只有待审核状态的订单可审核',
  'sales_order.close.not_allowed': '当前状态不可关闭订单',
  'sales_order.close.already_closed': '订单已关闭',
  'sales_order.close.cancelled': '已取消的订单不能关闭',
  'sales_order.close.completed': '已完成的订单无需关闭',
  'sales_order.close.draft_use_delete': '草稿订单请使用删除，不能关闭',
  'sales_order.close.pending_review': '待审核订单不能关闭，请先撤回或完成审核',
  'sales_order.close.rejected': '已驳回订单不能关闭',
  'sales_order.close.not_approved': '只有已审核通过的订单才能关闭',
  'sales_order.withdraw_submit.not_allowed': '只能撤回已提交且未审核的订单（待审核或已生效）',
  'sales_order.withdraw_submit.computation_pushed': '订单已下推需求计算，请先在「下推」菜单中撤回计算后再撤回提交',
  'sales_order.revoke_approval.not_allowed': '只能反审核已审核或已驳回的订单',
  'sales_order.push.requires_approved': '只能下推已审核的销售订单',
  'sales_order.push.closed': '订单已关闭，无法继续执行',
  'sales_order.push.cancelled': '订单已取消，无法继续执行',
  'sales_order.push.completed': '订单已完成，无法继续执行',
  'sales_order.push.no_items': '销售订单无明细，无法下推',
  'sales_order.push_computation.not_allowed': '当前状态不可下推需求计算',
  'sales_order.push_computation.already_pushed': '已下推需求计算',
  'sales_order.push_computation.line_work_orders': '明细已挂工单，与需求计算下推互斥',
  'sales_order.withdraw_computation.not_allowed': '当前状态不可撤回需求计算',
  'sales_order.push_work_order.not_allowed': '当前状态不可直推工单',
  'sales_order.push_work_order.no_items': '销售订单无明细，无法直推工单',
  'sales_order.push_shipment.not_allowed': '当前状态不可下推发货通知单',
  'sales_order.push_delivery.not_allowed': '当前状态不可下推销售出库',
  'sales_order.push_invoice.not_allowed': '当前状态不可下推销售发票',
  'sales_order.create_change.not_allowed': '当前状态不可新建销售变更单',
};

export function salesOrderCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
  fallbackMap = SALES_ORDER_CAPABILITY_REASON_MESSAGES,
  i18nPrefix = 'app.kuaizhizao.salesOrder.capability',
): string {
  if (!code) return '';
  if (t) {
    const key = `${i18nPrefix}.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return fallbackMap[code] ?? code;
}

export function useSalesOrderCapabilities(
  record: SalesOrder | null | undefined,
  salesOrderPerms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;

  return useMemo(
    () => ({
      update: capView(caps?.update, salesOrderPerms.canUpdate, permDeniedTitle, t),
      delete: capView(caps?.delete, salesOrderPerms.canDelete, permDeniedTitle, t),
      submit: capView(caps?.submit, salesOrderPerms.canAction?.('submit') ?? false, permDeniedTitle, t),
      approve: capView(caps?.approve, salesOrderPerms.canAction?.('audit') ?? false, permDeniedTitle, t),
      close: capView(caps?.close, salesOrderPerms.canUpdate, permDeniedTitle, t),
      print: capView(caps?.print, salesOrderPerms.canPrint, permDeniedTitle, t),
      withdrawSubmit: capView(
        caps?.withdraw_submit,
        salesOrderPerms.canAction?.('revoke') ?? false,
        permDeniedTitle,
        t,
      ),
      revokeApproval: capView(
        caps?.revoke_approval,
        salesOrderPerms.canAction?.('revoke') ?? false,
        permDeniedTitle,
        t,
      ),
      pushComputation: capView(caps?.push_computation, salesOrderPerms.canUpdate, permDeniedTitle, t),
      withdrawComputation: capView(
        caps?.withdraw_computation,
        salesOrderPerms.canUpdate,
        permDeniedTitle,
        t,
      ),
      pushWorkOrder: capView(caps?.push_work_order, salesOrderPerms.canUpdate, permDeniedTitle, t),
      pushShipmentNotice: capView(caps?.push_shipment_notice, salesOrderPerms.canUpdate, permDeniedTitle, t),
      pushSalesDelivery: capView(caps?.push_sales_delivery, salesOrderPerms.canUpdate, permDeniedTitle, t),
      pushInvoice: capView(caps?.push_invoice, salesOrderPerms.canUpdate, permDeniedTitle, t),
      pushSalesReturn: capView(caps?.push_sales_return, salesOrderPerms.canUpdate, permDeniedTitle, t),
      createChangeOrder: capView(caps?.create_change_order, salesOrderPerms.canCreate, permDeniedTitle, t),
    }),
    [caps, salesOrderPerms, t, permDeniedTitle],
  );
}

export type SalesOrderCapabilityGates = ReturnType<typeof useSalesOrderCapabilities>;

export function batchSomeCapabilityAllowed<T>(
  records: T[],
  permAllowed: boolean,
  pick: (record: T) => ActionCapability | undefined | null,
): boolean {
  if (!permAllowed || records.length === 0) return false;
  return records.some((r) => pick(r)?.allowed === true);
}

export function salesOrderBatchCloseAllowed(records: SalesOrder[], canUpdate: boolean): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.close);
}

/** 是否存在任一可执行的下推类动作（工具栏下推按钮显隐） */
export function salesOrderHasToolbarPushActions(record: SalesOrder): boolean {
  const c = record.capabilities;
  if (!c) return true;
  return (
    c.push_computation?.allowed ||
    c.push_work_order?.allowed ||
    c.push_shipment_notice?.allowed ||
    c.push_sales_delivery?.allowed ||
    c.push_invoice?.allowed ||
    c.push_sales_return?.allowed ||
    c.withdraw_computation?.allowed
  );
}

type ShipmentNoticeRecord = import('../apps/kuaizhizao/services/shipment-notice').ShipmentNotice;
type SalesReturnRecord = import('../apps/kuaizhizao/services/sales-return').SalesReturn;

export function shipmentNoticeBatchNotifyAllowed(
  records: ShipmentNoticeRecord[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.notify);
}

export function shipmentNoticeBatchWithdrawAllowed(
  records: ShipmentNoticeRecord[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.withdraw);
}

export function salesReturnBatchConfirmAllowed(
  records: SalesReturnRecord[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.confirm);
}

export function salesReturnBatchWithdrawAllowed(
  records: SalesReturnRecord[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.withdraw);
}

export const SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_order_change.update.not_draft': '仅草稿或待审核状态可编辑变更单',
  'sales_order_change.delete.not_draft': '仅草稿状态可删除',
  'sales_order_change.submit.not_draft': '仅草稿可提交',
  'sales_order_change.submit.no_changes': '变更单无任何变更内容，无法提交',
  'sales_order_change.withdraw_submit.not_pending': '仅待审核状态可撤回',
  'sales_order_change.apply.not_audited': '变更单未审核通过，无法生效',
  'sales_order_change.reopen.not_rejected': '仅已驳回的变更单可重新编辑',
};

export function salesOrderChangeCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.salesOrderChange.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

export function useSalesOrderChangeCapabilities(
  record: import('../apps/kuaizhizao/services/sales-order-change').SalesOrderChange | null | undefined,
  perms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return useMemo(
    () => ({
      update: capView(caps?.update, perms.canUpdate, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      delete: capView(caps?.delete, perms.canDelete, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      submit: capView(caps?.submit, perms.canAction?.('submit') ?? false, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      withdrawSubmit: capView(caps?.withdraw_submit, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      apply: capView(caps?.apply, perms.canCreate, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      print: capView(caps?.print, perms.canPrint, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
      reopen: capView(caps?.reopen, perms.canUpdate, permDeniedTitle, t, SALES_ORDER_CHANGE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesOrderChange.capability'),
    }),
    [caps, perms, t, permDeniedTitle],
  );
}

export const SALES_CONTRACT_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_contract.update.not_draft': '仅草稿或待审核状态合同可编辑',
  'sales_contract.delete.not_draft': '仅草稿状态合同可删除',
  'sales_contract.submit.not_draft': '仅草稿状态可提交审核',
  'sales_contract.withdraw_submit.not_pending': '仅待审核合同可撤回提交',
  'sales_contract.approve.not_pending': '仅待审核合同可审批',
  'sales_contract.reject.not_pending': '仅待审核合同可驳回',
  'sales_contract.revoke_approval.not_effective': '仅已生效且未下推的合同可撤回审核',
  'sales_contract.revoke_approval.has_release': '合同已有释放记录，无法撤回审核',
  'sales_contract.revoke_approval.not_allowed': '当前状态不可撤回审核',
  'sales_contract.push.not_effective': '合同须已生效后方可下推销售订单',
  'sales_contract.push.not_approved': '合同未审核通过',
  'sales_contract.push.expired': '合同已过期，无法下推订单',
  'sales_contract.push.not_yet_valid': '合同尚未到生效日期',
  'sales_contract.push.no_items': '合同无明细',
  'sales_contract.push.no_remaining': '合同剩余额度不足',
  'sales_contract.push.no_releasable_items': '无可释放的合同明细',
  'sales_contract.print.not_allowed': '正式合同打印须在已生效、执行中或已关闭且审核通过后',
  'sales_contract.close.already_closed': '合同已关闭或已到期',
  'sales_contract.create_change.not_effective': '仅生效中合同可发起变更',
};

export function salesContractCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.salesContract.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SALES_CONTRACT_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

export function useSalesContractCapabilities(
  record: import('../apps/kuaizhizao/services/sales-contract').SalesContract | null | undefined,
  perms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return useMemo(
    () => ({
      update: capView(caps?.update, perms.canUpdate, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      delete: capView(caps?.delete, perms.canDelete, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      submit: capView(caps?.submit, perms.canAction?.('submit') ?? false, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      withdrawSubmit: capView(caps?.withdraw_submit, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      approve: capView(caps?.approve, perms.canAction?.('audit') ?? false, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      reject: capView(caps?.reject, perms.canAction?.('audit') ?? false, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      revokeApproval: capView(caps?.revoke_approval, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      pushToSalesOrder: capView(caps?.push_to_sales_order, perms.canCreate, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      print: capView(caps?.print, perms.canPrint, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      close: capView(caps?.close, perms.canUpdate, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
      createChange: capView(caps?.create_change, perms.canCreate, permDeniedTitle, t, SALES_CONTRACT_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesContract.capability'),
    }),
    [caps, perms, t, permDeniedTitle],
  );
}

export function salesContractHasToolbarPushActions(record: import('../apps/kuaizhizao/services/sales-contract').SalesContract): boolean {
  const c = record.capabilities;
  if (!c) return true;
  return c.push_to_sales_order?.allowed === true;
}

export function salesContractBatchDeleteAllowed(
  records: import('../apps/kuaizhizao/services/sales-contract').SalesContract[],
  canDelete: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canDelete, (r) => r.capabilities?.delete);
}

export function salesContractBatchPrintAllowed(
  records: import('../apps/kuaizhizao/services/sales-contract').SalesContract[],
  canPrint: boolean,
): boolean {
  if (!canPrint || records.length !== 1) return false;
  return records[0]?.capabilities?.print?.allowed === true;
}

export const SALES_FORECAST_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_forecast.update.not_allowed': '仅草稿、待审核或已驳回状态可编辑销售预测',
  'sales_forecast.delete.not_allowed': '仅草稿或待审核状态可删除销售预测',
  'sales_forecast.submit.not_draft': '只有草稿状态的销售预测才能提交',
  'sales_forecast.withdraw_submit.not_pending': '只有待审核状态的销售预测可撤回提交',
  'sales_forecast.approve.not_pending': '仅待审核销售预测可审批',
  'sales_forecast.reject.not_pending': '仅待审核销售预测可驳回',
  'sales_forecast.revoke_approval.not_audited': '仅已审核的销售预测支持撤回审核',
  'sales_forecast.revoke_approval.not_approved': '销售预测未审核通过，无法撤回审核',
  'sales_forecast.revoke_approval.has_downstream': '该销售预测已下推下游单据，不能撤回审核',
  'sales_forecast.push.not_approved': '只有已审核通过的销售预测才能下推到需求计算',
  'sales_forecast.push.already_pushed': '已下推需求计算',
  'sales_forecast.push.rejected': '已驳回的销售预测不能下推',
  'sales_forecast.push.cancelled': '已取消的销售预测不能下推',
  'sales_forecast.push.completed': '已完成的销售预测不能下推',
  'sales_forecast.push.no_items': '销售预测无明细，无法下推',
};

export function salesForecastCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.salesForecast.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SALES_FORECAST_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

export function useSalesForecastCapabilities(
  record: import('../apps/kuaizhizao/services/sales-forecast').SalesForecast | null | undefined,
  perms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return useMemo(
    () => ({
      update: capView(caps?.update, perms.canUpdate, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      delete: capView(caps?.delete, perms.canDelete, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      submit: capView(caps?.submit, perms.canAction?.('submit') ?? false, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      withdrawSubmit: capView(caps?.withdraw_submit, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      approve: capView(caps?.approve, perms.canAction?.('audit') ?? false, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      reject: capView(caps?.reject, perms.canAction?.('audit') ?? false, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      revokeApproval: capView(caps?.revoke_approval, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      print: capView(caps?.print, perms.canPrint, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
      pushComputation: capView(caps?.push_computation, perms.canUpdate, permDeniedTitle, t, SALES_FORECAST_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesForecast.capability'),
    }),
    [caps, perms, t, permDeniedTitle],
  );
}

export function salesForecastHasToolbarPushActions(record: import('../apps/kuaizhizao/services/sales-forecast').SalesForecast): boolean {
  const c = record.capabilities;
  if (!c) return true;
  return c.push_computation?.allowed === true;
}

export const SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'shipment_notice.update.not_pending': '只能更新待发货状态的发货通知单',
  'shipment_notice.delete.not_pending': '只能删除待发货状态的发货通知单',
  'shipment_notice.notify.not_pending': '只有待发货状态的通知单才能通知仓库',
  'shipment_notice.notify.no_warehouse': '发货通知单缺少仓库，无法通知仓库',
  'shipment_notice.notify.no_items': '发货通知单无明细，无法通知仓库',
  'shipment_notice.withdraw.not_notified': '只有已通知状态的发货通知单才能撤回',
  'shipment_notice.withdraw.delivery_processing': '关联的销售出库单已在处理中，无法撤回',
};

export function shipmentNoticeCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.shipmentNotice.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

export function useShipmentNoticeCapabilities(
  record: import('../apps/kuaizhizao/services/shipment-notice').ShipmentNotice | null | undefined,
  perms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return useMemo(
    () => ({
      update: capView(caps?.update, perms.canUpdate, permDeniedTitle, t, SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.shipmentNotice.capability'),
      delete: capView(caps?.delete, perms.canDelete, permDeniedTitle, t, SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.shipmentNotice.capability'),
      notify: capView(caps?.notify, perms.canUpdate, permDeniedTitle, t, SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.shipmentNotice.capability'),
      withdraw: capView(caps?.withdraw, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.shipmentNotice.capability'),
      print: capView(caps?.print, perms.canPrint, permDeniedTitle, t, SHIPMENT_NOTICE_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.shipmentNotice.capability'),
    }),
    [caps, perms, t, permDeniedTitle],
  );
}

export const SALES_RETURN_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_return.update.not_editable': '仅「待退货」或「草稿」状态的销售退货单可编辑',
  'sales_return.delete.not_pending': '只有待退货状态的销售退货单才能删除',
  'sales_return.confirm.not_pending': '只有待退货状态的销售退货单才能确认退货',
  'sales_return.confirm.no_items': '销售退货单无明细，无法确认退货',
  'sales_return.confirm.already_returned': '销售退货单已确认退货',
  'sales_return.confirm.cancelled': '已取消的销售退货单不能确认退货',
  'sales_return.withdraw.not_returned': '只有已退货状态的销售退货单才能撤回',
};

export function salesReturnCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaizhizao.salesReturn.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SALES_RETURN_CAPABILITY_REASON_MESSAGES[code] ?? code;
}

export function useSalesReturnCapabilities(
  record: import('../apps/kuaizhizao/services/sales-return').SalesReturn | null | undefined,
  perms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return useMemo(
    () => ({
      update: capView(caps?.update, perms.canUpdate, permDeniedTitle, t, SALES_RETURN_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesReturn.capability'),
      delete: capView(caps?.delete, perms.canDelete, permDeniedTitle, t, SALES_RETURN_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesReturn.capability'),
      confirm: capView(caps?.confirm, perms.canAction?.('submit') ?? false, permDeniedTitle, t, SALES_RETURN_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesReturn.capability'),
      withdraw: capView(caps?.withdraw, perms.canAction?.('revoke') ?? false, permDeniedTitle, t, SALES_RETURN_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesReturn.capability'),
      print: capView(caps?.print, perms.canPrint, permDeniedTitle, t, SALES_RETURN_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.salesReturn.capability'),
    }),
    [caps, perms, t, permDeniedTitle],
  );
}

export const PRODUCTION_PLAN_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'production_plan.update.executed': '已执行的生产计划不允许修改',
  'production_plan.update.not_allowed': '当前状态不可修改生产计划',
  'production_plan.delete.executed': '已执行的生产计划不允许删除',
  'production_plan.submit.not_rejected': '只有已驳回状态的生产计划才能重新提交',
  'production_plan.withdraw_submit.not_pending': '只有待审核状态的生产计划可撤回提交',
  'production_plan.approve.not_pending': '只有待审核状态的生产计划可审核',
  'production_plan.revoke_approval.not_allowed': '当前状态不可撤回审核',
  'production_plan.execute.already_executed': '该生产计划已执行，请勿重复操作',
  'production_plan.execute.requires_approved': '当前配置要求生产计划审核通过后才能执行，请先审核计划',
  'production_plan.push_work_order.not_allowed': '当前状态不可下推工单',
  'production_plan.push_work_order.executed': '已执行的生产计划不可下推工单',
  'production_plan.push_work_order.no_items': '生产计划中无需要生产的明细，无法转工单',
  'production_plan.push_work_order.requires_approved': '生产计划须审核通过后方可下推工单',
};

export function productionPlanBatchExecuteAllowed(
  records: { capabilities?: { execute?: ActionCapability } }[],
  canExecute: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExecute, (r) => r.capabilities?.execute);
}

export function productionPlanBatchPushWorkOrderAllowed(
  records: { capabilities?: { push_work_order?: ActionCapability } }[],
  canExecute: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExecute, (r) => r.capabilities?.push_work_order);
}

export const DEMAND_COMPUTATION_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'demand_computation.execute.not_allowed': '只能执行进行中或失败状态的计算',
  'demand_computation.recompute.not_allowed': '只能对已完成或失败的计算执行重新计算',
  'demand_computation.compare.not_completed': '只能对比已完成的需求计算',
};

export function demandComputationBatchExecuteAllowed(
  records: { capabilities?: { execute?: ActionCapability } }[],
  canExecute: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExecute, (r) => r.capabilities?.execute);
}

export function demandComputationBatchRecomputeAllowed(
  records: { capabilities?: { recompute?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.recompute);
}

export function demandComputationBatchCompareAllowed(
  records: { capabilities?: { compare?: ActionCapability } }[],
  canRead: boolean,
): boolean {
  return canRead && records.length === 2 && records.every((r) => r.capabilities?.compare?.allowed === true);
}

export function demandComputationBatchExportAllowed(
  records: { capabilities?: { export?: ActionCapability } }[],
  canExport: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExport, (r) => r.capabilities?.export);
}

export function demandBatchMergeComputationAllowed(
  records: { capabilities?: { merge_computation?: ActionCapability } }[],
  canCreate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canCreate, (r) => r.capabilities?.merge_computation);
}

export function purchaseOrderBatchPushReceiptNoticeAllowed(
  records: { capabilities?: { push_receipt_notice?: ActionCapability } }[],
  canExecute: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExecute, (r) => r.capabilities?.push_receipt_notice);
}

export function receiptNoticeBatchNotifyAllowed(
  records: { capabilities?: { notify?: ActionCapability } }[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.notify);
}

export function receiptNoticeBatchWithdrawAllowed(
  records: { capabilities?: { withdraw?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.withdraw);
}

export function purchaseReturnBatchConfirmAllowed(
  records: { capabilities?: { confirm?: ActionCapability } }[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.confirm);
}

export function purchaseReturnBatchWithdrawAllowed(
  records: { capabilities?: { withdraw?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.withdraw);
}

export const WORK_ORDER_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'work_order.not_applicable': '该行不是可操作的工单',
  'work_order.update.not_draft': '仅草稿状态工单可编辑',
  'work_order.delete.not_allowed': '当前状态不可删除工单',
  'work_order.release.not_draft': '只能下达草稿状态的工单',
  'work_order.release.frozen': '工单已冻结，不能下达',
  'work_order.release.split': '已拆分主工单不可下达',
  'work_order.freeze.already_frozen': '工单已冻结，不能重复冻结',
  'work_order.freeze.not_allowed': '当前状态不可冻结工单',
  'work_order.unfreeze.not_frozen': '工单未冻结，不能解冻',
  'work_order.cancel.not_allowed': '当前状态不可取消工单',
  'work_order.set_priority.not_allowed': '当前状态不可调整优先级',
};

export const REPORTING_RECORD_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'reporting_record.update.not_pending': '仅待审核报工记录可编辑',
  'reporting_record.delete.not_pending': '仅待审核报工记录可删除',
  'reporting_record.approve.not_pending': '只有待审核状态的报工记录才可以审核',
  'reporting_record.revoke_approval.not_approved': '只有已审核通过的报工记录才可以撤回审核',
};

export const EXCEPTION_PROCESS_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'exception_process.cancel.already_finished': '该异常处理流程已结束，无法取消',
};

export function workOrderBatchReleaseAllowed(
  records: { capabilities?: { release?: ActionCapability } }[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.release);
}

export function workOrderBatchFreezeAllowed(
  records: { capabilities?: { freeze?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.freeze);
}

export function workOrderBatchCancelAllowed(
  records: { capabilities?: { cancel?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.cancel);
}

export function workOrderBatchSetPriorityAllowed(
  records: { capabilities?: { set_priority?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.set_priority);
}

export function workOrderBatchPrintAllowed(
  records: { capabilities?: { print?: ActionCapability } }[],
  canPrint: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canPrint, (r) => r.capabilities?.print);
}

export function reportingRecordBatchRevokeApprovalAllowed(
  records: { capabilities?: { revoke_approval?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.revoke_approval);
}

export function reportingRecordBatchApproveAllowed(
  records: { capabilities?: { approve?: ActionCapability } }[],
  canAudit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canAudit, (r) => r.capabilities?.approve);
}

export function exceptionProcessBatchCancelAllowed(
  records: { capabilities?: { cancel?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.cancel);
}

export function packingBindingBatchPrintAllowed(
  records: { capabilities?: { print?: ActionCapability } }[],
  canPrint: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canPrint, (r) => r.capabilities?.print);
}

export function inboundHubBatchConfirmAllowed(
  records: { capabilities?: { confirm?: ActionCapability } }[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.confirm);
}

export function outboundHubBatchConfirmAllowed(
  records: { capabilities?: { confirm?: ActionCapability } }[],
  canSubmit: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canSubmit, (r) => r.capabilities?.confirm);
}

export function customerMaterialBatchConfirmAllowed(
  records: { capabilities?: { confirm?: ActionCapability } }[],
  canExecute: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canExecute, (r) => r.capabilities?.confirm);
}

export function customerMaterialBatchWithdrawAllowed(
  records: { capabilities?: { withdraw?: ActionCapability } }[],
  canRevoke: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canRevoke, (r) => r.capabilities?.withdraw);
}

export function customerMaterialBatchCancelAllowed(
  records: { capabilities?: { cancel?: ActionCapability } }[],
  canReject: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canReject, (r) => r.capabilities?.cancel);
}

export function inventoryAlertBatchResolveAllowed(
  records: { capabilities?: { resolve?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.resolve);
}

export function inventoryAlertBatchIgnoreAllowed(
  records: { capabilities?: { ignore?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.ignore);
}

export function replenishmentBatchProcessAllowed(
  records: { capabilities?: { process?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.process);
}

export function replenishmentBatchIgnoreAllowed(
  records: { capabilities?: { ignore?: ActionCapability } }[],
  canUpdate: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canUpdate, (r) => r.capabilities?.ignore);
}

export const QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'quality_inspection.conduct.not_pending': '只有待检验状态的检验单才能执行检验',
  'quality_inspection.approve.not_pending': '检验单审核状态不是待审核',
  'quality_inspection.create_defect.not_allowed': '只有已检验且不合格的检验单才能登记不良',
  'quality_inspection.push_purchase_return.not_allowed': '只有不合格的来料检验单才能下推采购退货单',
  'quality_inspection.update.not_pending': '只能更新待检验状态的检验单',
};

export const OQC_INSPECTION_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'oqc_inspection.conduct.not_pending': '只有待检验状态的出货检验单可执行检验',
  'oqc_inspection.approve.not_pending': '出货检验单当前不可审核',
  'oqc_inspection.revoke_approval.not_approved': '仅已审核通过的出货检验单可撤销审核',
  'oqc_inspection.delete.not_pending': '仅待检验状态的出货检验单可删除',
};

export const EIGHT_D_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'eight_d_report.update.closed': '已关闭的 8D 报告不可编辑',
  'eight_d_report.delete.closed': '已关闭的 8D 报告不可删除',
  'eight_d_report.transition.closed': '已关闭的 8D 报告不可推进阶段',
  'eight_d_report.transition.no_next': '当前阶段不可推进',
  'eight_d_report.transition.stage_incomplete': '推进前需先完善当前阶段内容',
  'eight_d_report.close.already_closed': '8D 报告已关闭',
  'eight_d_report.close.not_at_final_stage': '仅 D8 总结阶段可关闭报告',
  'eight_d_report.close.stage_incomplete': '关闭前需先完善 D8 总结内容',
};

export const NC_LEDGER_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'nonconforming_ledger.update.closed': '已处理或已取消的台账不可更新处置',
  'nonconforming_ledger.start_8d.closed': '已处理或已取消的台账不可发起 8D',
  'nonconforming_ledger.start_8d.already_linked': '该台账已关联 8D 报告',
};

function qualityCapView(
  cap: ActionCapability | undefined,
  permAllowed: boolean,
  permDeniedTitle?: string,
  t?: TFunction,
  reasonMessages?: Record<string, string>,
  i18nPrefix?: string,
): CapabilityActionView {
  return capView(cap, permAllowed, permDeniedTitle, t, reasonMessages, i18nPrefix);
}

export interface QualityInspectionCapabilitiesShape {
  conduct?: ActionCapability;
  approve?: ActionCapability;
  reject?: ActionCapability;
  create_defect?: ActionCapability;
  push_purchase_return?: ActionCapability;
  update?: ActionCapability;
  print?: ActionCapability;
}

export function qualityInspectionRowGates(
  record: { capabilities?: QualityInspectionCapabilitiesShape } | null | undefined,
  inspectionPerms: ResourcePermissionGates,
  ncPerms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return {
    conduct: qualityCapView(
      caps?.conduct,
      inspectionPerms.canUpdate,
      permDeniedTitle,
      t,
      QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.capability',
    ),
    createDefect: qualityCapView(
      caps?.create_defect,
      ncPerms.canCreate,
      permDeniedTitle,
      t,
      QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.capability',
    ),
    approve: qualityCapView(
      caps?.approve,
      inspectionPerms.canAction?.('audit') ?? false,
      permDeniedTitle,
      t,
      QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.capability',
    ),
    reject: qualityCapView(
      caps?.reject,
      inspectionPerms.canAction?.('audit') ?? false,
      permDeniedTitle,
      t,
      QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.capability',
    ),
    update: qualityCapView(
      caps?.update,
      inspectionPerms.canUpdate,
      permDeniedTitle,
      t,
      QUALITY_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.capability',
    ),
  };
}

export function oqcInspectionRowGates(
  record: { capabilities?: { conduct?: ActionCapability; delete?: ActionCapability } } | null | undefined,
  oqcPerms: ResourcePermissionGates,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return {
    conduct: qualityCapView(
      caps?.conduct,
      oqcPerms.canUpdate,
      permDeniedTitle,
      t,
      OQC_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.oqc.capability',
    ),
    delete: qualityCapView(
      caps?.delete,
      oqcPerms.canDelete,
      permDeniedTitle,
      t,
      OQC_INSPECTION_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.oqc.capability',
    ),
  };
}

export function eightDReportRowGates(
  record: {
    capabilities?: {
      update?: ActionCapability;
      delete?: ActionCapability;
      transition?: ActionCapability;
      close?: ActionCapability;
    };
  } | null | undefined,
  canUpdate: boolean,
  canDelete: boolean,
  canClose: boolean,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return {
    update: qualityCapView(
      caps?.update,
      canUpdate,
      permDeniedTitle,
      t,
      EIGHT_D_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.eightD.capability',
    ),
    delete: qualityCapView(
      caps?.delete,
      canDelete,
      permDeniedTitle,
      t,
      EIGHT_D_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.eightD.capability',
    ),
    transition: qualityCapView(
      caps?.transition,
      canUpdate || canClose,
      permDeniedTitle,
      t,
      EIGHT_D_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.eightD.capability',
    ),
    close: qualityCapView(caps?.close, canClose, permDeniedTitle, t, EIGHT_D_CAPABILITY_REASON_MESSAGES, 'app.kuaizhizao.eightD.capability'),
  };
}

export function nonconformingLedgerRowGates(
  record: {
    capabilities?: { update_disposition?: ActionCapability; start_8d?: ActionCapability };
  } | null | undefined,
  ncPerms: ResourcePermissionGates,
  canStart8d: boolean,
  t?: TFunction,
  permDeniedTitle?: string,
) {
  const caps = record?.capabilities;
  return {
    updateDisposition: qualityCapView(
      caps?.update_disposition,
      ncPerms.canUpdate,
      permDeniedTitle,
      t,
      NC_LEDGER_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.nc.capability',
    ),
    start8d: qualityCapView(
      caps?.start_8d,
      canStart8d,
      permDeniedTitle,
      t,
      NC_LEDGER_CAPABILITY_REASON_MESSAGES,
      'app.kuaizhizao.quality.nc.capability',
    ),
  };
}
