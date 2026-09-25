import type { SyncBinding, SyncSourceItem, SyncSourceType } from './types';
import { invertFieldMapping } from './syncSourceUtils';

export interface SyncSourceDraft {
  id: string;
  kind: SyncSourceType;
  api_uuid?: string;
  dataset_uuid?: string;
  /** 目标字段 -> 来源列 */
  targetToSource: Record<string, string>;
}

let _draftSeq = 0;

export function newSyncSourceDraft(kind: SyncSourceType = 'api'): SyncSourceDraft {
  _draftSeq += 1;
  return { id: `src-${_draftSeq}`, kind, targetToSource: {} };
}

export function bindingToSourceDrafts(binding: SyncBinding): SyncSourceDraft[] {
  if (binding.sources?.length) {
    return binding.sources.map((src, index) => ({
      id: `src-${index + 1}`,
      kind: src.kind,
      api_uuid: src.api_uuid,
      dataset_uuid: src.dataset_uuid,
      targetToSource: invertFieldMapping(src.field_mapping || {}),
    }));
  }
  const hasLegacy =
    Boolean(binding.api_uuid) ||
    Boolean(binding.dataset_uuid) ||
    Object.keys(binding.field_mapping || {}).length > 0;
  if (!hasLegacy) {
    return [];
  }
  const kind = (binding.source_type || 'api') as SyncSourceType;
  const draft = newSyncSourceDraft(kind);
  draft.targetToSource = invertFieldMapping(binding.field_mapping || {});
  if (kind === 'api' && binding.api_uuid) draft.api_uuid = binding.api_uuid;
  if (kind === 'dataset' && binding.dataset_uuid) draft.dataset_uuid = binding.dataset_uuid;
  return [draft];
}

export function draftsToPayloadSources(drafts: SyncSourceDraft[]): SyncSourceItem[] {
  return drafts.map((draft) => ({
    kind: draft.kind,
    api_uuid: draft.kind === 'api' ? draft.api_uuid : undefined,
    dataset_uuid: draft.kind === 'dataset' ? draft.dataset_uuid : undefined,
    field_mapping: invertFieldMapping(draft.targetToSource),
  }));
}
