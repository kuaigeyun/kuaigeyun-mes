/** Windows / macOS 文件名非法字符 */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFileNamePart(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, '_').replace(/\s+/g, ' ').trim();
}

/** 生成导入模板下载文件名，如「账户管理 - 导入模板.xlsx」 */
export function buildImportTemplateFileName(
  documentName: string,
  suffix = '导入模板',
): string {
  const base = sanitizeFileNamePart(documentName);
  if (!base) return `${suffix}.xlsx`;
  const safeSuffix = sanitizeFileNamePart(suffix) || '导入模板';
  return `${base} - ${safeSuffix}.xlsx`;
}
