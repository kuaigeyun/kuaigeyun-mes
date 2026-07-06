import { warehouseApi } from '../../../services/warehouse-execution';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import type { InboundHubOrder } from './inboundHubTypes';

export async function fetchInboundHubDetail(record: InboundHubOrder): Promise<Record<string, unknown> | null> {
  const id = String(record.id);
  try {
    switch (record.receipt_type) {
      case 'purchase':
        return (await warehouseApi.purchaseReceipt.get(id)) as Record<string, unknown>;
      case 'finished_goods':
        return (await warehouseApi.finishedGoodsReceipt.get(id)) as Record<string, unknown>;
      case 'semi_finished_goods':
        return (await warehouseApi.semiFinishedGoodsReceipt.get(id)) as Record<string, unknown>;
      case 'production_return':
        return (await warehouseApi.productionReturn.get(id)) as Record<string, unknown>;
      case 'sales_return':
        return (await warehouseApi.salesReturn.get(id)) as Record<string, unknown>;
      case 'other_inbound':
        return (await warehouseApi.otherInbound.get(id)) as Record<string, unknown>;
      case 'material_return':
        return (await warehouseApi.materialReturn.get(id)) as Record<string, unknown>;
      case 'outsource_receipt':
        return (await outsourceMaterialReceiptApi.get(id)) as Record<string, unknown>;
      case 'outsource_material_return':
        return (await outsourceMaterialReturnApi.get(id)) as Record<string, unknown>;
      case 'outsource_product_return':
        return (await outsourceProductReturnApi.get(id)) as Record<string, unknown>;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
