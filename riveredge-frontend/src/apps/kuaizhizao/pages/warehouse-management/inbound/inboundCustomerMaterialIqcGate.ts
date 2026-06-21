import type { TFunction } from 'i18next';
import {
  qualityApi,
  type EnsureIqcForCustomerMaterialRegistrationResult,
} from '../../../services/quality-execution';

export async function fetchCustomerMaterialIqcEnsure(
  registrationId: string | number,
): Promise<EnsureIqcForCustomerMaterialRegistrationResult> {
  return qualityApi.incomingInspection.ensureForCustomerMaterialRegistration(String(registrationId));
}

/** 批量确认：未通过检验时抛出后端 message */
export async function checkCustomerMaterialIqcForConfirm(
  registrationId: string | number,
  t?: TFunction,
): Promise<EnsureIqcForCustomerMaterialRegistrationResult> {
  const ensure = await fetchCustomerMaterialIqcEnsure(registrationId);
  if (!ensure.can_confirm_inbound) {
    throw new Error(
      ensure.message ||
        t?.('app.kuaizhizao.warehouseInbound.cmIqc.ensureBlocked.content') ||
        '相关物料须完成来料检验并合格后方可确认入库',
    );
  }
  return ensure;
}
