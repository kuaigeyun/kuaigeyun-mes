import { warehouseApi } from '../../../services/warehouse-execution';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import type { InboundHubOrder } from './inboundHubTypes';
import { normalizeInboundHubDetail } from './inboundHubNormalize';

export async function fetchInboundHubDetail(
  record: InboundHubOrder,
): Promise<Record<string, unknown> | null> {
  const id = String(record.id);
  const receiptType = record.receipt_type;
  if (!receiptType) return null;
  try {
    let raw: Record<string, unknown> | null = null;
    switch (receiptType) {
      case 'purchase':
        raw = (await warehouseApi.purchaseReceipt.get(id)) as Record<string, unknown>;
        break;
      case 'finished_goods':
        raw = (await warehouseApi.finishedGoodsReceipt.get(id)) as Record<string, unknown>;
        break;
      case 'semi_finished_goods':
        raw = (await warehouseApi.semiFinishedGoodsReceipt.get(id)) as Record<string, unknown>;
        break;
      case 'production_return':
        raw = (await warehouseApi.productionReturn.get(id)) as Record<string, unknown>;
        break;
      case 'sales_return':
        raw = (await warehouseApi.salesReturn.get(id)) as Record<string, unknown>;
        break;
      case 'other_inbound':
        raw = (await warehouseApi.otherInbound.get(id)) as Record<string, unknown>;
        break;
      case 'material_return':
        raw = (await warehouseApi.materialReturn.get(id)) as Record<string, unknown>;
        break;
      case 'outsource_receipt':
        raw = (await outsourceMaterialReceiptApi.get(id)) as Record<string, unknown>;
        break;
      case 'outsource_material_return':
        raw = (await outsourceMaterialReturnApi.get(id)) as Record<string, unknown>;
        break;
      case 'outsource_product_return':
        raw = (await outsourceProductReturnApi.get(id)) as Record<string, unknown>;
        break;
      case 'customer_material':
        raw = (await customerMaterialRegistrationApi.get(id)) as Record<string, unknown>;
        break;
      default:
        return null;
    }
    if (!raw) return null;
    return normalizeInboundHubDetail(receiptType, raw, record) as Record<string, unknown>;
  } catch {
    return null;
  }
}
