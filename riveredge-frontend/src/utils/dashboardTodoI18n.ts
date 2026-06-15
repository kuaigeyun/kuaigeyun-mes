import type { TFunction } from 'i18next';
import type { TodoItem } from '../services/dashboard';

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
  const parts = description.split(/\s*[·•]\s*/);
  return [parts[0]?.trim() ?? '', parts.slice(1).join(' · ').trim()];
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

export function localizeDashboardTodoItem(item: TodoItem, t: TFunction): TodoItem {
  const kind = getTodoKind(item.id);
  const titleKey = TITLE_KEYS[kind];
  if (!titleKey) return item;

  const param = extractTitleParam(item.title, kind);
  return {
    ...item,
    title: t(titleKey, { code: param, name: param, title: param }),
    description: localizeDescription(kind, item.description, t),
  };
}

export function localizeDashboardTodos(items: TodoItem[], t: TFunction): TodoItem[] {
  return items.map((item) => localizeDashboardTodoItem(item, t));
}
