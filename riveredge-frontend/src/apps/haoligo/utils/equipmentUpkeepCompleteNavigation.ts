/** 设备维保单 → 设备维保完成单（带出来源）深链 */

export const EQUIPMENT_UPKEEP_COMPLETE_PATH = '/apps/haoligo/equipment/documents/upkeep-complete';

export const EQUIPMENT_UPKEEP_COMPLETE_SOURCE_PARAM = 'source_upkeep_sheet_id';

export function buildEquipmentUpkeepCompleteCreateFromSheetUrl(upkeepSheetId: number): string {
  return `${EQUIPMENT_UPKEEP_COMPLETE_PATH}?${EQUIPMENT_UPKEEP_COMPLETE_SOURCE_PARAM}=${upkeepSheetId}`;
}
