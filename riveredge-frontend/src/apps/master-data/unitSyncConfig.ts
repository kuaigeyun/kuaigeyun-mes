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
    getBinding: getMaterialUnitSyncBinding,
    syncFromSource: syncMaterialUnitsFromSource,
    completeSuccessKey: 'app.master-data.units.syncComplete',
    completePartialKey: 'app.master-data.units.syncPartial',
    failedKey: 'app.master-data.units.syncFailed',
  };
}
