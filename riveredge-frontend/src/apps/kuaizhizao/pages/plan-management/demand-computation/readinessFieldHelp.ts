/** 补齐基础资料：按 field 路径映射 i18n 说明键 */
export function readinessFieldHelpI18nKey(field: string): string {
  const slug = field.replace(/\./g, '_')
  return `app.kuaizhizao.demandComputation.readinessFieldHelp.${slug}`
}
