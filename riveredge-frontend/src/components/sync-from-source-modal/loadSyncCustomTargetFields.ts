import { getCustomFieldsByTable } from '../../services/customField';
import type { SyncTargetField } from './types';
import { syncCustomFieldTargetKey } from './types';

/** 按表名加载启用中的自定义字段，转为同步映射目标 custom:{code} */
export async function loadSyncCustomTargetFields(
  tableName: string,
): Promise<SyncTargetField[]> {
  const customFields = await getCustomFieldsByTable(tableName, true);
  return customFields.map((field) => ({
    value: syncCustomFieldTargetKey(field.code),
    label: field.label || field.name,
    kind: 'custom' as const,
    required: field.is_required || undefined,
  }));
}
