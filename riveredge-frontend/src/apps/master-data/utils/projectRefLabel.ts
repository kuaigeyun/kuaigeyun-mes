/** 工程图纸等项目关联：代号与名称展示、表单 project_ref 解析 */

export function formatProjectRefLabel(
  projectCode?: string | null,
  projectName?: string | null,
): string {
  const code = String(projectCode || '').trim();
  const name = String(projectName || '').trim();
  if (code && name && name !== code) {
    return `${code} - ${name}`;
  }
  return code || name;
}

export function resolveProjectRefPick(
  pick: unknown,
  idByLabel: ReadonlyMap<string, number>,
): { project_id?: number | null; project_code?: string | null } {
  if (pick === null || pick === undefined || pick === '') {
    return { project_id: null, project_code: null };
  }
  if (typeof pick === 'number' && Number.isFinite(pick)) {
    return { project_id: pick, project_code: null };
  }
  const text = String(pick).trim();
  if (!text) {
    return { project_id: null, project_code: null };
  }
  const linkedId = idByLabel.get(text);
  if (linkedId != null) {
    return { project_id: linkedId, project_code: null };
  }
  const code = text.includes(' - ') ? text.split(' - ')[0]?.trim() || text : text;
  return { project_id: null, project_code: code };
}
