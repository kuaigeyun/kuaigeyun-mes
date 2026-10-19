import { apiRequest } from '../../../services/api';

export type DashboardSummary = {
  events_today: number;
  ok_today: number;
  ng_today: number;
  unknown_today: number;
  ok_rate_today?: number | null;
  agent_count: number;
  agent_enabled: number;
  pending_reviews?: number;
  last_agent_heartbeat_at?: string | null;
};

export type InspectionListItem = {
  uuid: string;
  event_id: string;
  occurred_at: string;
  judgment: string;
  confidence?: number | null;
  recipe_code?: string | null;
  recipe_version?: string | null;
  station_code?: string | null;
  camera_code?: string | null;
  agent_code?: string | null;
  duration_ms?: number | null;
  work_order_code?: string | null;
  batch_no?: string | null;
  thickness_mm?: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

export type InspectionDetail = InspectionListItem & {
  operation_code?: string | null;
  step_results?: Record<string, unknown> | null;
  remark?: string | null;
  measurements: Array<{ name: string; value?: number | null; unit?: string | null }>;
  images: Array<{ object_key: string; label?: string | null; sort_order: number }>;
};

export type VisionAgent = {
  uuid: string;
  id: number;
  code: string;
  name: string;
  device_token: string;
  is_enabled: boolean;
  is_online?: boolean;
  last_heartbeat_at?: string | null;
  config_version: number;
  run_mode?: string;
  agent_version?: string | null;
  last_error?: string | null;
  buffer_pending_count?: number;
  disk_free_mb?: number | null;
  remark?: string | null;
};

export type VisionCamera = {
  uuid: string;
  id: number;
  code: string;
  name: string;
  sdk_type: string;
  serial_no?: string | null;
  station_code?: string | null;
  plant_code?: string | null;
  workshop_code?: string | null;
  is_enabled: boolean;
  remark?: string | null;
};

export type RecipeVersion = {
  uuid: string;
  id: number;
  version: string;
  status: string;
  params?: Record<string, unknown> | null;
  model_artifact_uuid?: string | null;
  model_artifact_code?: string | null;
  require_model?: boolean;
  published_at?: string | null;
  published_by_name?: string | null;
  remark?: string | null;
};

export type VisionRecipe = {
  uuid: string;
  id: number;
  code: string;
  name: string;
  recipe_type: string;
  review_threshold?: number | null;
  default_camera_code?: string | null;
  trigger_mode?: string;
  trigger_interval_seconds?: number | null;
  is_enabled: boolean;
  published_version?: string | null;
  remark?: string | null;
  versions?: RecipeVersion[];
};

export type ReviewTask = {
  uuid: string;
  id: number;
  status: string;
  original_judgment: string;
  reviewed_judgment?: string | null;
  reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  event_uuid?: string | null;
  event_id?: string | null;
  occurred_at?: string | null;
  confidence?: number | null;
  recipe_code?: string | null;
  station_code?: string | null;
  images?: Array<{ object_key: string; label?: string | null; sort_order: number }>;
  measurements?: Array<{ name: string; value?: number | null; unit?: string | null }>;
};

export type VisionSettings = {
  require_published_recipe: boolean;
  offline_timeout_seconds?: number;
  image_retention_days?: number;
  event_retention_days?: number;
  buffer_alert_threshold?: number;
  disk_alert_mb?: number;
};

export type VisionModelArtifact = {
  uuid: string;
  id: number;
  code: string;
  name: string;
  framework: string;
  object_key: string;
  checksum: string;
  input_width?: number | null;
  input_height?: number | null;
  label_map?: Record<string, unknown> | null;
  is_enabled: boolean;
  remark?: string | null;
};

export type VisionSampleSet = {
  uuid: string;
  id: number;
  code: string;
  name: string;
  recipe_code?: string | null;
  is_enabled: boolean;
  item_count?: number;
  remark?: string | null;
  items?: Array<{
    uuid: string;
    id: number;
    label: string;
    object_key: string;
    source_event_uuid?: string | null;
  }>;
};

type PageResult<T> = { items: T[]; total: number; page: number; page_size: number };

export async function getDashboardSummary() {
  return apiRequest<DashboardSummary>('/apps/kuaivision/dashboard/summary', { method: 'GET' });
}

export async function listInspections(params: Record<string, unknown>) {
  return apiRequest<PageResult<InspectionListItem>>('/apps/kuaivision/inspections', {
    method: 'GET',
    params,
  });
}

export async function getInspection(uuid: string) {
  return apiRequest<InspectionDetail>(`/apps/kuaivision/inspections/${uuid}`, { method: 'GET' });
}

export async function listAgents(params: Record<string, unknown>) {
  return apiRequest<PageResult<VisionAgent>>('/apps/kuaivision/agents', { method: 'GET', params });
}

export async function createAgent(data: {
  code: string;
  name: string;
  run_mode?: string;
  remark?: string;
  is_enabled?: boolean;
}) {
  return apiRequest<VisionAgent>('/apps/kuaivision/agents', { method: 'POST', data });
}

export async function updateAgent(
  uuid: string,
  data: { name?: string; run_mode?: string; remark?: string; is_enabled?: boolean },
) {
  return apiRequest<VisionAgent>(`/apps/kuaivision/agents/${uuid}`, { method: 'PUT', data });
}

export async function rotateAgentToken(uuid: string) {
  return apiRequest<VisionAgent>(`/apps/kuaivision/agents/${uuid}/rotate-token`, { method: 'POST' });
}

export async function bumpAgentConfig(uuid: string) {
  return apiRequest<VisionAgent>(`/apps/kuaivision/agents/${uuid}/bump-config`, { method: 'POST' });
}

export async function deleteAgent(uuid: string) {
  return apiRequest(`/apps/kuaivision/agents/${uuid}`, { method: 'DELETE' });
}

export async function listCameras(params: Record<string, unknown>) {
  return apiRequest<PageResult<VisionCamera>>('/apps/kuaivision/cameras', { method: 'GET', params });
}

export async function createCamera(data: Record<string, unknown>) {
  return apiRequest<VisionCamera>('/apps/kuaivision/cameras', { method: 'POST', data });
}

export async function updateCamera(uuid: string, data: Record<string, unknown>) {
  return apiRequest<VisionCamera>(`/apps/kuaivision/cameras/${uuid}`, { method: 'PUT', data });
}

export async function deleteCamera(uuid: string) {
  return apiRequest(`/apps/kuaivision/cameras/${uuid}`, { method: 'DELETE' });
}

export async function listRecipes(params: Record<string, unknown>) {
  return apiRequest<PageResult<VisionRecipe>>('/apps/kuaivision/recipes', { method: 'GET', params });
}

export async function getRecipe(uuid: string) {
  return apiRequest<VisionRecipe>(`/apps/kuaivision/recipes/${uuid}`, { method: 'GET' });
}

export async function createRecipe(data: Record<string, unknown>) {
  return apiRequest<VisionRecipe>('/apps/kuaivision/recipes', { method: 'POST', data });
}

export async function updateRecipe(uuid: string, data: Record<string, unknown>) {
  return apiRequest<VisionRecipe>(`/apps/kuaivision/recipes/${uuid}`, { method: 'PUT', data });
}

export async function deleteRecipe(uuid: string) {
  return apiRequest(`/apps/kuaivision/recipes/${uuid}`, { method: 'DELETE' });
}

export async function addRecipeVersion(recipeUuid: string, data: Record<string, unknown>) {
  return apiRequest<VisionRecipe>(`/apps/kuaivision/recipes/${recipeUuid}/versions`, {
    method: 'POST',
    data,
  });
}

export async function publishRecipeVersion(recipeUuid: string, versionUuid: string) {
  return apiRequest<VisionRecipe>(
    `/apps/kuaivision/recipes/${recipeUuid}/versions/${versionUuid}/publish`,
    { method: 'POST' },
  );
}

export async function listReviews(params: Record<string, unknown>) {
  return apiRequest<PageResult<ReviewTask>>('/apps/kuaivision/reviews', { method: 'GET', params });
}

export async function getReview(uuid: string) {
  return apiRequest<ReviewTask>(`/apps/kuaivision/reviews/${uuid}`, { method: 'GET' });
}

export async function completeReview(
  uuid: string,
  data: { reviewed_judgment: string; reason?: string },
) {
  return apiRequest<ReviewTask>(`/apps/kuaivision/reviews/${uuid}/complete`, {
    method: 'POST',
    data,
  });
}

export async function getVisionSettings() {
  return apiRequest<VisionSettings>('/apps/kuaivision/settings', { method: 'GET' });
}

export async function updateVisionSettings(data: Partial<VisionSettings>) {
  return apiRequest<VisionSettings>('/apps/kuaivision/settings', { method: 'PUT', data });
}

export async function promoteInspectionSample(
  uuid: string,
  data: {
    sample_set_uuid?: string;
    sample_set_code?: string;
    sample_set_name?: string;
    label?: string;
    recipe_code?: string;
  },
) {
  return apiRequest<VisionSampleSet>(`/apps/kuaivision/inspections/${uuid}/promote-sample`, {
    method: 'POST',
    data,
  });
}

export async function listModels(params: Record<string, unknown>) {
  return apiRequest<PageResult<VisionModelArtifact>>('/apps/kuaivision/models', {
    method: 'GET',
    params,
  });
}

export async function createModel(data: Record<string, unknown>) {
  return apiRequest<VisionModelArtifact>('/apps/kuaivision/models', { method: 'POST', data });
}

export async function updateModel(uuid: string, data: Record<string, unknown>) {
  return apiRequest<VisionModelArtifact>(`/apps/kuaivision/models/${uuid}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteModel(uuid: string) {
  return apiRequest(`/apps/kuaivision/models/${uuid}`, { method: 'DELETE' });
}

export async function listSampleSets(params: Record<string, unknown>) {
  return apiRequest<PageResult<VisionSampleSet>>('/apps/kuaivision/sample-sets', {
    method: 'GET',
    params,
  });
}

export async function getSampleSet(uuid: string) {
  return apiRequest<VisionSampleSet>(`/apps/kuaivision/sample-sets/${uuid}`, { method: 'GET' });
}

export async function createSampleSet(data: Record<string, unknown>) {
  return apiRequest<VisionSampleSet>('/apps/kuaivision/sample-sets', { method: 'POST', data });
}

export async function updateSampleSet(uuid: string, data: Record<string, unknown>) {
  return apiRequest<VisionSampleSet>(`/apps/kuaivision/sample-sets/${uuid}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteSampleSet(uuid: string) {
  return apiRequest(`/apps/kuaivision/sample-sets/${uuid}`, { method: 'DELETE' });
}

export async function exportSamplePack(uuid: string) {
  return apiRequest<Record<string, unknown>>(`/apps/kuaivision/sample-sets/${uuid}/export-pack`, {
    method: 'GET',
  });
}

export async function updateRecipeVersion(
  recipeUuid: string,
  versionUuid: string,
  data: Record<string, unknown>,
) {
  return apiRequest<VisionRecipe>(
    `/apps/kuaivision/recipes/${recipeUuid}/versions/${versionUuid}`,
    { method: 'PUT', data },
  );
}
