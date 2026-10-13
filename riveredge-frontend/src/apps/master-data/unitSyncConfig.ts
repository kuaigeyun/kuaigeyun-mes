import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { getMaterialUnitSyncBinding, syncMaterialUnitsFromSource } from './services/material-unit';
import {
  UNIT_SYNC_AVAILABLE_TARGET_FIELDS,
  UNIT_SYNC_REQUIRED_TARGETS,
  UNIT_SYNC_TARGET_FIELDS,
} from './pages/materials/unitSyncFields';

export function createUnitSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.units.syncFromSource',
    hintKey: 'app.master-data.units.syncHint',
    apiRealtimeHintKey: 'app.master-data.units.syncApiHint',
    datasetBatchHintKey: 'app.master-data.units.syncDatasetHint',
    targetFields: UNIT_SYNC_TARGET_FIELDS,
    availableTargetFields: UNIT_SYNC_AVAILABLE_TARGET_FIELDS,
    requiredTargets: UNIT_SYNC_REQUIRED_TARGETS,
    previewPreferredSourceKeys: [
      'baseunit.number',
      'baseunit.name',
      'baseunit_number',
      'baseunit_name',
      'measureunitid_number',
      'measureunitid_name',
      'number',
      'name',
      'FNumber',
      'FName',
      'code',
    ],
    // 与物料同步拆开：单位编码优先绑基础单位列，绝不能抢物料 number
    targetAliases: {
      code: [
        'baseunit.number',
        'baseunit_number',
        'measureunitid_number',
        'measureunitid.number',
        'number',
        'FNumber',
        'code',
      ],
      name: [
        'baseunit.name',
        'baseunit_name',
        'measureunitid_name',
        'measureunitid.name',
        'name',
        'FName',
      ],
    },
    preferredApiCodeSuffixes: ['query_measureunits'],
    collapsePreviewToUniqueUnits: true,
    getBinding: getMaterialUnitSyncBinding,
    syncFromSource: syncMaterialUnitsFromSource,
    completeSuccessKey: 'app.master-data.units.syncComplete',
    completePartialKey: 'app.master-data.units.syncPartial',
    failedKey: 'app.master-data.units.syncFailed',
  };
}
