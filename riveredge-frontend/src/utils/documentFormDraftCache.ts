type DraftValue = Record<string, unknown>;

const inMemoryDraftStore = new Map<string, DraftValue>();

function cloneDraft<T extends DraftValue>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function buildDocumentCreateDraftKey(
  resourceKey: string,
  pathname: string,
  search?: string,
): string {
  const params = new URLSearchParams(search || '');
  params.delete('_refresh');
  const cleanSearch = params.toString();
  const routeKey = cleanSearch ? `${pathname}?${cleanSearch}` : pathname;
  return `doc-create-draft:${resourceKey}:${routeKey}`;
}

export function setDocumentFormDraft(key: string, value: DraftValue): void {
  if (!key) return;
  inMemoryDraftStore.set(key, cloneDraft(value));
}

export function getDocumentFormDraft<T extends DraftValue>(key: string): T | null {
  if (!key) return null;
  const value = inMemoryDraftStore.get(key);
  if (!value) return null;
  return cloneDraft(value as T);
}

export function clearDocumentFormDraft(key: string): void {
  if (!key) return;
  inMemoryDraftStore.delete(key);
}

