import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import {
  getMaterialGroupSyncBinding,
  getMaterialSyncBinding,
  syncMaterialGroupsFromSource,
  syncMaterialsFromSource,
} from './services/material';
import {
  getMaterialUnitSyncBinding,
  syncMaterialUnitsFromSource,
} from './services/material-unit';
import {
  MATERIAL_SYNC_AVAILABLE_TARGET_FIELDS,
  MATERIAL_SYNC_CUSTOM_FIELD_TABLE,
  MATERIAL_SYNC_REQUIRED_TARGETS,
  MATERIAL_SYNC_TARGET_FIELDS,
} from './pages/materials/materialSyncFields';

export function createMaterialSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.materials.syncFromSource',
    hintKey: 'app.master-data.materials.syncHint',
    apiRealtimeHintKey: 'app.master-data.materials.syncApiHint',
    datasetBatchHintKey: 'app.master-data.materials.syncDatasetHint',
    mainStepTitleKey: 'app.master-data.materials.syncStep.material',
    prerequisiteSteps: [
      {
        id: 'unit',
        titleKey: 'app.master-data.materials.syncStep.unit',
        getBinding: getMaterialUnitSyncBinding,
        syncFromSource: syncMaterialUnitsFromSource,
      },
      {
        id: 'group',
        titleKey: 'app.master-data.materials.syncStep.group',
        getBinding: getMaterialGroupSyncBinding,
        syncFromSource: syncMaterialGroupsFromSource,
      },
    ],
    skipBackendPrerequisites: true,
    targetFields: MATERIAL_SYNC_TARGET_FIELDS,
    availableTargetFields: MATERIAL_SYNC_AVAILABLE_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(MATERIAL_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: MATERIAL_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: MATERIAL_SYNC_REQUIRED_TARGETS,
    previewPreferredSourceKeys: [
      'number',
      'name',
      'modelnum',
      'model',
      'baseunit.number',
      'baseunit.name',
      'baseunit_number',
      'baseunit_name',
      'group.number',
      'group.name',
      'group_number',
      'group_name',
      'FNumber',
      'FName',
      'FSpecification',
      'FBaseUnitId.FNumber',
      'FBaseUnitId.FName',
      'FMaterialGroup.FNumber',
      'FMaterialGroup.FName',
    ],
    // 与单位同步拆开：主编码走物料 number，不与单位 code 别名混用
    targetAliases: {
      main_code: ['number', 'FNumber', 'material.number', 'material_number'],
      name: ['name', 'FName'],
      base_unit: [
        'baseunit.number',
        'baseunit_number',
        'measureunitid_number',
        'FBaseUnitId.FNumber',
        'FUnitId.FNumber',
      ],
      base_unit_name: [
        'baseunit.name',
        'baseunit_name',
        'measureunitid_name',
        'FBaseUnitId.FName',
        'FUnitId.FName',
      ],
      specification: [
        'modelnum',
        'model_num',
        'modelnumber',
        'model',
        'modelNum',
        'FSpecification',
      ],
      group_code: ['group_number', 'group.number', 'FMaterialGroup.FNumber'],
      group_name: ['group_name', 'group.name', 'FMaterialGroup.FName'],
    },
    preferredApiCodeSuffixes: ['query_material'],
    getBinding: getMaterialSyncBinding,
    syncFromSource: syncMaterialsFromSource,
    completeSuccessKey: 'app.master-data.materials.syncComplete',
    completePartialKey: 'app.master-data.materials.syncPartial',
    failedKey: 'app.master-data.materials.syncFailed',
  };
}
