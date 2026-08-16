import type { QmsEvidenceLink } from '../../../services/quality-qms';

/** 将表单中的 JSON 文本解析为证据链接数组；空串视为空数组。 */
export function parseEvidenceLinksText(raw: unknown): QmsEvidenceLink[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw as QmsEvidenceLink[];
  const text = String(raw).trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('evidence_links_must_be_array');
  }
  return parsed as QmsEvidenceLink[];
}

export function stringifyEvidenceLinks(links?: QmsEvidenceLink[] | null): string {
  if (!links || !links.length) return '[]';
  return JSON.stringify(links, null, 2);
}

export const QMS_DOC_TYPE_OPTIONS = [
  { value: 'manual', labelKey: 'app.kuaizhizao.quality.qms.docType.manual' },
  { value: 'procedure', labelKey: 'app.kuaizhizao.quality.qms.docType.procedure' },
  { value: 'work_instruction', labelKey: 'app.kuaizhizao.quality.qms.docType.workInstruction' },
  { value: 'form', labelKey: 'app.kuaizhizao.quality.qms.docType.form' },
  { value: 'record', labelKey: 'app.kuaizhizao.quality.qms.docType.record' },
] as const;

export const QMS_DOC_STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'app.kuaizhizao.quality.qms.docStatus.draft' },
  { value: 'effective', labelKey: 'app.kuaizhizao.quality.qms.docStatus.effective' },
  { value: 'obsolete', labelKey: 'app.kuaizhizao.quality.qms.docStatus.obsolete' },
] as const;

export const QMS_AUDIT_STATUS_OPTIONS = [
  { value: 'planned', labelKey: 'app.kuaizhizao.quality.qms.auditStatus.planned' },
  { value: 'in_progress', labelKey: 'app.kuaizhizao.quality.qms.auditStatus.inProgress' },
  { value: 'completed', labelKey: 'app.kuaizhizao.quality.qms.auditStatus.completed' },
  { value: 'closed', labelKey: 'app.kuaizhizao.quality.qms.auditStatus.closed' },
] as const;

export const QMS_REVIEW_STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'app.kuaizhizao.quality.qms.reviewStatus.draft' },
  { value: 'in_progress', labelKey: 'app.kuaizhizao.quality.qms.reviewStatus.inProgress' },
  { value: 'completed', labelKey: 'app.kuaizhizao.quality.qms.reviewStatus.completed' },
  { value: 'closed', labelKey: 'app.kuaizhizao.quality.qms.reviewStatus.closed' },
] as const;
