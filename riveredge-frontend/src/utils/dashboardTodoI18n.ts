import type { TFunction } from 'i18next';
import type { TodoItem } from '../services/dashboard';
import { joinDisplayParts } from './joinDisplayParts';

function getTodoKind(id: string): string {
  const lastUnderscore = id.lastIndexOf('_');
  if (lastUnderscore <= 0) return id;
  const suffix = id.slice(lastUnderscore + 1);
  if (/^\d+$/.test(suffix)) {
    return id.slice(0, lastUnderscore);
  }
  return id;
}

function extractTitleParam(title: string, kind: string): string {
  const colonMatch = title.match(/[:：]\s*(.+)$/);
  if (colonMatch) return colonMatch[1].trim();
  if (kind === 'work_order') {
    const workOrderMatch = title.match(/工单\s*(.+)$/);
    if (workOrderMatch) return workOrderMatch[1].trim();
  }
  return title;
}

function splitDotDescription(description: string): [string, string] {
  const parts = description.split(/\s*[·•]\s*|\s+-\s+/);
  return [parts[0]?.trim() ?? '', parts.slice(1).join(' ').trim()];
}

function joinSegments(...parts: Array<string | undefined | null>): string | undefined {
  const joined = joinDisplayParts(...parts);
  return joined || undefined;
}

const TITLE_KEYS: Record<string, string> = {
  work_order: 'pages.dashboard.todo.workOrder',
  exception_material: 'pages.dashboard.todo.materialShortage',
  exception_delay: 'pages.dashboard.todo.deliveryDelay',
  exception_quality: 'pages.dashboard.todo.qualityException',
  inventory_alert: 'pages.dashboard.todo.inventoryAlert',
  purchase_receipt: 'pages.dashboard.todo.purchaseReceiptPending',
  finished_goods_receipt: 'pages.dashboard.todo.finishedGoodsReceiptPending',
  production_return: 'pages.dashboard.todo.productionReturnPending',
  other_inbound: 'pages.dashboard.todo.otherInboundPending',
  material_borrow: 'pages.dashboard.todo.materialBorrowPending',
  material_return: 'pages.dashboard.todo.materialReturnPending',
  material_call: 'pages.dashboard.todo.materialCallPending',
  receipt_notice: 'pages.dashboard.todo.receiptNoticePending',
  production_picking: 'pages.dashboard.todo.productionPickingPending',
  sales_delivery: 'pages.dashboard.todo.salesDeliveryPending',
  other_outbound: 'pages.dashboard.todo.otherOutboundPending',
  purchase_requisition: 'pages.dashboard.todo.purchaseRequisitionPending',
  purchase_return: 'pages.dashboard.todo.purchaseReturnPending',
  shipment_notice: 'pages.dashboard.todo.shipmentNoticePending',
  sales_return: 'pages.dashboard.todo.salesReturnPending',
  equipment_fault: 'pages.dashboard.todo.equipmentFaultPending',
  inspection_incoming: 'pages.dashboard.todo.incomingInspectionPending',
  inspection_process: 'pages.dashboard.todo.processInspectionPending',
  inspection_finished: 'pages.dashboard.todo.finishedInspectionPending',
};

function renderMetaDescription(
  kind: string,
  meta: Record<string, string>,
  t: TFunction,
): string | undefined {
  const qty = (value?: string) =>
    value ? t('pages.dashboard.todo.meta.segmentQuantity', { quantity: value }) : undefined;
  const workOrder = (value?: string) =>
    value ? t('pages.dashboard.todo.meta.segmentWorkOrder', { code: value }) : undefined;
  const planned = (value?: string) =>
    value ? t('pages.dashboard.todo.meta.segmentPlannedDate', { date: value }) : undefined;

  switch (kind) {
    case 'work_order':
      return joinSegments(
        meta.product_name
          ? t('pages.dashboard.todo.meta.segmentProduct', { name: meta.product_name })
          : undefined,
        qty(meta.quantity),
        meta.work_center_name
          ? t('pages.dashboard.todo.meta.segmentWorkCenter', { name: meta.work_center_name })
          : undefined,
      );
    case 'exception_material':
      return joinSegments(
        meta.shortage_quantity
          ? t('pages.dashboard.todo.meta.segmentShortageQty', { quantity: meta.shortage_quantity })
          : undefined,
        workOrder(meta.work_order_code),
      );
    case 'exception_delay':
      return joinSegments(
        meta.delay_days
          ? t('pages.dashboard.todo.meta.segmentDelayDays', { days: meta.delay_days })
          : undefined,
        planned(meta.planned_end),
      );
    case 'exception_quality':
      return meta.summary || undefined;
    case 'inventory_alert':
      return joinSegments(
        meta.warehouse_name,
        meta.current_quantity
          ? t('pages.dashboard.todo.meta.segmentCurrentStock', { quantity: meta.current_quantity })
          : undefined,
      );
    case 'purchase_receipt':
      return joinSegments(meta.supplier_name, meta.warehouse_name, qty(meta.quantity));
    case 'finished_goods_receipt':
      return joinSegments(workOrder(meta.work_order_code), meta.warehouse_name, qty(meta.quantity));
    case 'production_return':
      return joinSegments(workOrder(meta.work_order_code), meta.warehouse_name);
    case 'other_inbound':
      return joinSegments(meta.reason_type, meta.warehouse_name, qty(meta.quantity));
    case 'material_borrow':
      return joinSegments(meta.borrower_name, meta.warehouse_name);
    case 'material_return':
      return joinSegments(
        meta.borrow_code
          ? t('pages.dashboard.todo.meta.segmentBorrowDoc', { code: meta.borrow_code })
          : undefined,
        meta.warehouse_name,
      );
    case 'material_call':
      return joinSegments(
        workOrder(meta.work_order_code),
        meta.material_name,
        qty(meta.quantity),
        meta.caller_name
          ? t('pages.dashboard.todo.meta.segmentCaller', { name: meta.caller_name })
          : undefined,
      );
    case 'receipt_notice':
      return joinSegments(
        meta.supplier_name,
        meta.purchase_order_code,
        qty(meta.quantity),
        planned(meta.planned_date),
      );
    case 'production_picking':
      return joinSegments(
        workOrder(meta.work_order_code),
        meta.workshop_name
          ? t('pages.dashboard.todo.meta.segmentWorkshop', { name: meta.workshop_name })
          : undefined,
        meta.picker_name
          ? t('pages.dashboard.todo.meta.segmentPicker', { name: meta.picker_name })
          : undefined,
      );
    case 'sales_delivery':
      return joinSegments(meta.customer_name, meta.warehouse_name, qty(meta.quantity));
    case 'other_outbound':
      return joinSegments(meta.reason_type, meta.warehouse_name, qty(meta.quantity));
    case 'purchase_requisition':
      return joinSegments(
        meta.requisition_name,
        meta.applicant_name
          ? t('pages.dashboard.todo.meta.segmentApplicant', { name: meta.applicant_name })
          : undefined,
      );
    case 'purchase_return':
      return joinSegments(meta.supplier_name, meta.warehouse_name, qty(meta.quantity));
    case 'shipment_notice':
      return joinSegments(
        meta.customer_name,
        meta.sales_order_code,
        qty(meta.quantity),
        meta.warehouse_name,
      );
    case 'sales_return':
      return joinSegments(meta.customer_name, meta.warehouse_name, qty(meta.quantity));
    case 'equipment_fault':
      return joinSegments(meta.equipment_name, meta.fault_type, meta.fault_level);
    case 'inspection_incoming':
      return joinSegments(meta.material_name, meta.supplier_name, qty(meta.quantity));
    case 'inspection_process':
      return joinSegments(meta.operation_name, workOrder(meta.work_order_code), qty(meta.quantity));
    case 'inspection_finished':
      return joinSegments(meta.material_name, workOrder(meta.work_order_code), qty(meta.quantity));
    default:
      return undefined;
  }
}

function renderMetaDetail(
  kind: string,
  meta: Record<string, string>,
  t: TFunction,
): string | undefined {
  switch (kind) {
    case 'shipment_notice': {
      const detail = meta.detail?.trim();
      return detail ? t('pages.dashboard.todo.meta.segmentShippingAddress', { address: detail }) : undefined;
    }
    case 'inventory_alert':
      return meta.alert_message?.trim() || undefined;
    default:
      return undefined;
  }
}

function localizeDescription(
  kind: string,
  description: string | undefined,
  t: TFunction,
): string | undefined {
  if (!description) return undefined;

  switch (kind) {
    case 'work_order': {
      const match = description.match(/产品：(.+?)，数量：(.+)/);
      if (match) {
        return t('pages.dashboard.todo.workOrderDesc', {
          product: match[1],
          quantity: match[2],
        });
      }
      return description;
    }
    case 'exception_material': {
      const match = description.match(/缺料数量：(.+?)，工单：(.+)/);
      if (match) {
        return t('pages.dashboard.todo.materialShortageDesc', {
          quantity: match[1],
          workOrder: match[2],
        });
      }
      return description;
    }
    case 'exception_delay': {
      const match = description.match(/延期天数：(\d+)天/);
      if (match) {
        return t('pages.dashboard.todo.deliveryDelayDesc', { days: match[1] });
      }
      return description;
    }
    case 'inventory_alert': {
      const match = description.match(/^(.+?)\s*[·•]\s*当前\s*(.+)$/);
      if (match) {
        return t('pages.dashboard.todo.inventoryAlertDesc', {
          warehouse: match[1],
          quantity: match[2],
        });
      }
      return description;
    }
    case 'material_return': {
      const match = description.match(/借料单\s*(.+?)\s*[·•]\s*(.+)/);
      if (match) {
        return t('pages.dashboard.todo.materialReturnDesc', {
          borrowCode: match[1],
          warehouse: match[2],
        });
      }
      return description;
    }
    case 'production_picking': {
      const match = description.match(/工单\s*(.+)/);
      if (match) {
        return t('pages.dashboard.todo.productionPickingDesc', { workOrder: match[1] });
      }
      return description;
    }
    case 'inspection_process':
    case 'inspection_finished': {
      const [label, rest] = splitDotDescription(description);
      const workOrderMatch = rest.match(/工单\s*(.+)/);
      if (workOrderMatch) {
        return t('pages.dashboard.todo.inspectionWorkOrderDesc', {
          label,
          workOrder: workOrderMatch[1],
        });
      }
      return description;
    }
    default: {
      const [left, right] = splitDotDescription(description);
      if (right) {
        return t('pages.dashboard.todo.dotPairDesc', { left, right });
      }
      return description;
    }
  }
}

export type LocalizedTodoItem = TodoItem & {
  detail?: string;
};

export function localizeDashboardTodoItem(item: TodoItem, t: TFunction): LocalizedTodoItem {
  const kind = getTodoKind(item.id);
  const titleKey = TITLE_KEYS[kind];
  const param = extractTitleParam(item.title, kind);

  let description = item.description;
  let detail: string | undefined;

  if (item.meta && Object.keys(item.meta).length > 0) {
    const metaDesc = renderMetaDescription(kind, item.meta, t);
    if (metaDesc) {
      description = metaDesc;
    }
    detail = renderMetaDetail(kind, item.meta, t);
  } else if (description) {
    description = localizeDescription(kind, description, t);
  }

  return {
    ...item,
    title: titleKey ? t(titleKey, { code: param, name: param, title: param }) : item.title,
    description,
    detail,
  };
}

export function localizeDashboardTodos(items: TodoItem[], t: TFunction): LocalizedTodoItem[] {
  return items.map((item) => localizeDashboardTodoItem(item, t));
}
