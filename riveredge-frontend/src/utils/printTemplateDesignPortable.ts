/**
 * 打印模板可视化设计器 — 可移植导入/导出（不含租户 UUID、数据库 ID 等）
 */

export const PRINT_DESIGN_EXPORT_FORMAT = 'riveredge-print-template-design' as const;

export interface PrintTemplateDesignPortableV1 {
  format: typeof PRINT_DESIGN_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  template: {
    name: string;
    /** 编码建议（导入方可按需改写以避免冲突） */
    code?: string;
    description?: string;
    document_type?: string;
    designer_schema: Record<string, unknown>;
  };
}

export function buildPrintTemplateDesignExport(payload: {
  name: string;
  code?: string;
  description?: string;
  document_type?: string;
  designer_schema: Record<string, unknown>;
}): PrintTemplateDesignPortableV1 {
  return {
    format: PRINT_DESIGN_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    template: {
      name: payload.name || '未命名模板',
      ...(payload.code ? { code: payload.code } : {}),
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.document_type ? { document_type: payload.document_type } : {}),
      designer_schema: payload.designer_schema,
    },
  };
}

export type ParsePortableImportResult =
  | { ok: true; data: PrintTemplateDesignPortableV1 }
  | { ok: false; error: string };

export function parsePrintTemplateDesignImport(raw: unknown): ParsePortableImportResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: '文件内容不是有效的 JSON 对象' };
  }
  const obj = raw as Record<string, unknown>;
  const fmt = obj.format;
  if (fmt !== PRINT_DESIGN_EXPORT_FORMAT) {
    return {
      ok: false,
      error: `格式不匹配（期望 format 为 "${PRINT_DESIGN_EXPORT_FORMAT}"），请勿直接导入列表页导出的完整数据库 JSON`,
    };
  }
  if (obj.version !== 1) {
    return { ok: false, error: `不支持的导出版本：${String(obj.version)}` };
  }
  const tpl = obj.template;
  if (!tpl || typeof tpl !== 'object') {
    return { ok: false, error: '缺少 template 对象' };
  }
  const t = tpl as Record<string, unknown>;
  const name = typeof t.name === 'string' ? t.name.trim() : '';
  if (!name) {
    return { ok: false, error: '模板名称缺失或为空' };
  }
  const schema = t.designer_schema;
  if (!schema || typeof schema !== 'object') {
    return { ok: false, error: '缺少 designer_schema' };
  }
  const blocks = (schema as Record<string, unknown>).blocks;
  if (!Array.isArray(blocks)) {
    return { ok: false, error: 'designer_schema.blocks 必须为数组' };
  }

  const exportedAt =
    typeof obj.exportedAt === 'string' && obj.exportedAt.trim()
      ? obj.exportedAt
      : new Date(0).toISOString();

  const data: PrintTemplateDesignPortableV1 = {
    format: PRINT_DESIGN_EXPORT_FORMAT,
    version: 1,
    exportedAt,
    template: {
      name,
      ...(typeof t.code === 'string' && t.code.trim() ? { code: t.code.trim() } : {}),
      ...(typeof t.description === 'string' && t.description.trim()
        ? { description: t.description.trim() }
        : {}),
      ...(typeof t.document_type === 'string' && t.document_type.trim()
        ? { document_type: t.document_type.trim() }
        : {}),
      designer_schema: schema as Record<string, unknown>,
    },
  };
  return { ok: true, data };
}
