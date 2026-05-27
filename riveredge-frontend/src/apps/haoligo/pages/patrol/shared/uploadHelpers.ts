import {
  uuidsToSecureUploadFileList,
  uuidsToUploadFileList,
} from '../../../utils/secureUploadFileList';

export { uuidsToSecureUploadFileList, uuidsToUploadFileList };

export function normUploadUuids(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    const anyItem = item as { response?: { uuid?: string }; uid?: string };
    const u =
      anyItem?.response?.uuid ??
      (typeof anyItem?.uid === 'string' && /^[0-9a-f-]{36}$/i.test(anyItem.uid) ? anyItem.uid : null);
    if (u) out.push(u);
  }
  return out;
}

