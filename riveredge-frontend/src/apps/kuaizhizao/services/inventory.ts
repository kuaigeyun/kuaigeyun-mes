import { api, apiRequest } from '../../../services/api';
import { apiRequestSyncNdjson } from '../../../components/sync-from-source-modal/apiRequestSyncNdjson';

export type InventorySyncBinding = {
  source_type?: 'api' | 'dataset' | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field?: string;
  sync_direction?: string;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
};

export type InventorySyncFromSourceResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  fetched?: number;
  mode?: string;
};

export async function getInventorySyncBinding(): Promise<InventorySyncBinding> {
  return api.get('/apps/kuaizhizao/reports/inventory/sync-binding');
}

export async function syncInventoryFromSource(
  payload: {
    source_type?: 'api' | 'dataset';
    api_uuid?: string;
    dataset_uuid?: string;
    field_mapping?: Record<string, string>;
    save_binding?: boolean;
    skip_prerequisite_syncs?: boolean;
    sync_direction?: 'pull' | 'push' | 'bidirectional';
    sync_mode?: string;
    schedule_interval_minutes?: number;
    incremental?: boolean;
    active_only?: boolean;
  },
  onProgress?: (message: string) => void,
): Promise<InventorySyncFromSourceResult> {
  return apiRequestSyncNdjson<InventorySyncFromSourceResult>(
    '/apps/kuaizhizao/reports/inventory/sync-from-source',
    {
      data: payload,
      timeoutMs: 600_000,
      onProgress,
    },
  );
}
