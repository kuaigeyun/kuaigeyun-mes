import { warehouseApi } from '../../../services/warehouse-execution';
import type { OutboundHubOrder } from './outboundHubTypes';

export async function withdrawOutboundDocument(record: OutboundHubOrder): Promise<void> {
  const id = String(record.id);
  switch (record.outbound_type) {
    case 'production_picking':
      await warehouseApi.productionPicking.withdraw(id);
      return;
    case 'sales_delivery':
      await warehouseApi.salesDelivery.withdraw(id);
      return;
    case 'other_outbound':
      await warehouseApi.otherOutbound.withdraw(id);
      return;
    case 'material_borrow':
      await warehouseApi.materialBorrow.withdraw(id);
      return;
    default:
      throw new Error('该类型不支持撤回');
  }
}

export async function deleteOutboundDocument(record: OutboundHubOrder): Promise<void> {
  const id = String(record.id);
  switch (record.outbound_type) {
    case 'production_picking':
      await warehouseApi.productionPicking.delete(id);
      return;
    case 'sales_delivery':
      await warehouseApi.salesDelivery.delete(id);
      return;
    case 'other_outbound':
      await warehouseApi.otherOutbound.delete(id);
      return;
    case 'material_borrow':
      await warehouseApi.materialBorrow.delete(id);
      return;
    default:
      throw new Error('该类型不支持删除');
  }
}
