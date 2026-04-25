/**
 * 打印模板格式工具
 */

/** 判断模板内容是否为结构化设计模板（JSON） */
export function isStructuredPrintTemplate(content: string): boolean {
  try {
    const obj = JSON.parse(content);
    return (
      typeof obj === 'object' &&
      obj !== null &&
      (obj.basePdf !== undefined || obj.schemas !== undefined)
    );
  } catch {
    return false;
  }
}

/**
 * 判断模板是否可进入可视化设计器。
 * 兼容两类来源：
 * 1) 旧版结构化 JSON（pdfme 历史数据）
 * 2) 新版 designer_json（Craft.js + Jinja2）
 */
export function canOpenVisualDesigner(content: string, config?: Record<string, any>): boolean {
  if (isStructuredPrintTemplate(content)) return true;
  const sourceType = String(config?.source_type || '').trim().toLowerCase();
  if (sourceType === 'designer_json') return true;
  if (config?.designer_schema && typeof config.designer_schema === 'object') return true;
  return false;
}

