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

