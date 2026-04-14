/**
 * pdfme 模板工具
 *
 * 检测模板格式、将业务变量转换为 pdfme inputs、预加载字段到模板
 */

import type { Template } from '@pdfme/common';

/** 单变量项（与 printTemplateSchemas 对齐） */
export interface TemplateVariableItem {
  key: string;
  label: string;
  kind?: 'detailTable';
}

/** 表格型模板配置 */
export interface ArrayTableTemplateConfig {
  arrayKey: string;
  label: string;
  maxRows?: number;
  columns: { key: string; label: string }[];
}

/** 明细表行高：表头/表体分开；与 pdfme table 的 headStyles/bodyStyles.minCellHeight 对应 */
export type DetailTableRowHeightMode = 'auto' | 'fixed';

export interface DetailTableRowHeightConfig {
  /** auto：按内容撑开，行高不低于下方毫米值；fixed：行高固定为下方毫米值（单行优先） */
  mode: DetailTableRowHeightMode;
  /** 表头行高（mm） */
  headMm: number;
  /** 表体行高（mm） */
  bodyMm: number;
}

export const DEFAULT_DETAIL_TABLE_ROW_HEIGHT: DetailTableRowHeightConfig = {
  mode: 'auto',
  headMm: 11,
  bodyMm: 11,
};

const ROW_HEIGHT_MM_MIN = 4;
const ROW_HEIGHT_MM_MAX = 80;

export function clampDetailRowHeightMm(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(ROW_HEIGHT_MM_MAX, Math.max(ROW_HEIGHT_MM_MIN, n));
}

/** 从表格 schema 读取或推断行高配置（供设计器弹窗初始化） */
export function getDetailTableRowHeightFromSchema(schema: {
  detailTableRowHeight?: unknown;
  headStyles?: { minCellHeight?: number };
  bodyStyles?: { minCellHeight?: number };
} | null | undefined): DetailTableRowHeightConfig {
  const d = schema?.detailTableRowHeight as Partial<DetailTableRowHeightConfig> | undefined;
  if (d && typeof d === 'object' && (d.mode === 'auto' || d.mode === 'fixed')) {
    return {
      mode: d.mode,
      headMm: clampDetailRowHeightMm(d.headMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.headMm),
      bodyMm: clampDetailRowHeightMm(d.bodyMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.bodyMm),
    };
  }
  const h = (schema?.headStyles as { minCellHeight?: number } | undefined)?.minCellHeight;
  const b = (schema?.bodyStyles as { minCellHeight?: number } | undefined)?.minCellHeight;
  return {
    mode: 'auto',
    headMm: clampDetailRowHeightMm(h, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.headMm),
    bodyMm: clampDetailRowHeightMm(b, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.bodyMm),
  };
}

/**
 * 明细列显示顺序或显隐变化后，按列 key 重映射 pdfme columnStyles.alignment（按列下标），
 * 避免右侧「列样式」里设置的对齐在调序/删列后与真实列错位。
 */
export function remapTableColumnStylesAlignment(
  oldSchema: {
    columns?: { key?: string }[];
    columnStyles?: { alignment?: Record<string, string> };
  },
  newColumns: { key: string }[]
): Record<string, string> {
  const oldCols = Array.isArray(oldSchema.columns) ? oldSchema.columns : [];
  const oldAlign = oldSchema.columnStyles?.alignment;
  if (!oldAlign || typeof oldAlign !== 'object') {
    return {};
  }

  const pickAlign = (i: number) => oldAlign[i] ?? oldAlign[String(i)];

  const keyToAlignment: Record<string, string> = {};
  let allHaveKey = oldCols.length > 0;
  for (let i = 0; i < oldCols.length; i++) {
    const k = oldCols[i]?.key;
    if (!k) {
      allHaveKey = false;
      break;
    }
    const a = pickAlign(i);
    if (typeof a === 'string') keyToAlignment[k] = a;
  }

  const alignment: Record<string, string> = {};
  if (allHaveKey && Object.keys(keyToAlignment).length > 0) {
    newColumns.forEach((col, j) => {
      const a = keyToAlignment[col.key];
      if (typeof a === 'string') alignment[String(j)] = a;
    });
    return alignment;
  }

  // 无 key 的旧模板：列数不变时按原列下标保留对齐
  if (oldCols.length === newColumns.length) {
    for (let j = 0; j < newColumns.length; j++) {
      const a = pickAlign(j);
      if (typeof a === 'string') alignment[String(j)] = a;
    }
  }
  return alignment;
}

/** 零散明细占位：旧版侧栏展开的 items.0.xxx / operations.0.xxx 文本框 */
const DETAIL_LINE_SCALAR_NAME_RE = /^(items|operations)\.[0-9]+\./;

/**
 * 明细表默认宽高（mm）：占满版心宽度，行高足够避免设计器里表头与表体重叠
 */
export function getDetailTableDimensions(
  columnCount: number,
  sampleBodyRows: number,
  rowHeight?: Pick<DetailTableRowHeightConfig, 'headMm' | 'bodyMm'>
): { width: number; height: number } {
  const n = Math.max(1, columnCount);
  const width = Math.min(190, Math.max(150, n * 20));
  const body = Math.max(1, Math.min(sampleBodyRows, 12));
  const headMm = clampDetailRowHeightMm(rowHeight?.headMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.headMm);
  const bodyMm = clampDetailRowHeightMm(rowHeight?.bodyMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.bodyMm);
  // 设计器内表格外框高度需 ≥ 表头 + 示例行 * 表体行高，避免叠在一起
  const height = Math.max(72, Math.ceil(headMm + body * bodyMm + 8));
  return { width, height };
}

/** 是否存在 items.N.xxx / operations.N.xxx 零散文本 schema */
export function countDetailLinePlaceholderSchemas(template: Template): number {
  let count = 0;
  for (const page of template.schemas || []) {
    for (const s of page as any[]) {
      const name = s?.name;
      if (
        (s?.type === 'text' || s?.type === 'multiVariableText') &&
        typeof name === 'string' &&
        DETAIL_LINE_SCALAR_NAME_RE.test(name)
      ) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * 若页面上已有整块 items/operations 表格，则移除同名的零散行占位文本，避免与表格叠在一起「不像表」
 */
export function stripOverlappingDetailLineTextSchemas(template: Template): Template {
  const next = JSON.parse(JSON.stringify(template)) as Template;
  next.schemas = (next.schemas || []).map((page: any[]) => {
    const hasItemsTable = page.some((s: any) => s?.type === 'table' && s?.name === 'items');
    const hasOpsTable = page.some((s: any) => s?.type === 'table' && s?.name === 'operations');
    return page.filter((s: any) => {
      const name = s?.name;
      if (
        (s?.type === 'text' || s?.type === 'multiVariableText') &&
        typeof name === 'string' &&
        DETAIL_LINE_SCALAR_NAME_RE.test(name)
      ) {
        if (name.startsWith('items.') && hasItemsTable) return false;
        if (name.startsWith('operations.') && hasOpsTable) return false;
      }
      return true;
    });
  });
  return next;
}

/** 移除所有零散明细行占位（保留整块 table），用于用户一键清理旧模板 */
export function removeAllDetailLinePlaceholderSchemas(template: Template): Template {
  const next = JSON.parse(JSON.stringify(template)) as Template;
  next.schemas = (next.schemas || []).map((page: any[]) =>
    page.filter((s: any) => {
      const name = s?.name;
      if (
        (s?.type === 'text' || s?.type === 'multiVariableText') &&
        typeof name === 'string' &&
        DETAIL_LINE_SCALAR_NAME_RE.test(name)
      ) {
        return false;
      }
      return true;
    })
  );
  return next;
}

/**
 * 将业务字段预加载到 pdfme 模板
 * 空模板时调用，在「字段列表」中生成可编辑的 schema
 */
export function buildTemplateWithFields(
  template: Template,
  variableItems: TemplateVariableItem[],
  arrayTableConfigs: ArrayTableTemplateConfig[] = []
): Template {
  const pageSchemas: any[] = [];
  let y = 10;

  const arrayKeys = new Set(arrayTableConfigs.map((c) => c.arrayKey));
  // 单变量：添加 text 或 qrcode schema（整块明细表由下方 table 生成，不生成 {items} 文本）
  for (const item of variableItems) {
    if (arrayKeys.has(item.key)) {
      continue;
    }
    const parts = item.key.split('.');
    if (parts.length >= 3 && /^\d+$/.test(parts[1]) && arrayKeys.has(parts[0])) {
      continue; // 兼容旧版：跳过 operations.0.xxx，由表格覆盖
    }
    if (item.key.endsWith('_qrcode')) {
      pageSchemas.push({
        name: item.key,
        type: 'qrcode',
        position: { x: 10, y },
        width: 30,
        height: 30,
        content: 'WO-SAMPLE-001', // 设计器预览用，实际渲染由 inputs 提供
        backgroundColor: '#ffffff',
        barColor: '#000000',
      });
      y += 36;
    } else if (item.key === 'signature') {
      pageSchemas.push({
        name: item.key,
        type: 'signature',
        position: { x: 10, y },
        width: 80,
        height: 40,
        content: '',
        rotate: 0,
        opacity: 1,
      });
      y += 46;
    } else {
      pageSchemas.push({
        name: item.key,
        type: 'text',
        position: { x: 10, y },
        width: 80,
        height: 8,
        content: `{${item.key}}`,
        readOnly: true,
      });
      y += 12;
    }
  }

  // 表格型：添加 table schema
  for (const config of arrayTableConfigs) {
    const rowCount = Math.min(3, config.maxRows ?? 5);
    const sampleRows = Array.from({ length: rowCount }, (_, i) =>
      config.columns.map((_, j) => `示例${i + 1}-${j + 1}`)
    );
    const dim = getDetailTableDimensions(config.columns.length, rowCount, DEFAULT_DETAIL_TABLE_ROW_HEIGHT);
    pageSchemas.push({
      name: config.arrayKey,
      type: 'table',
      columns: config.columns.map((c) => ({ key: c.key, label: c.label })),
      position: { x: 10, y },
      width: dim.width,
      height: dim.height,
      showHead: true,
      head: config.columns.map((c) => c.label),
      headWidthPercentages: config.columns.map(() => 100 / config.columns.length),
      content: JSON.stringify(sampleRows),
      tableStyles: { borderWidth: 0.3, borderColor: '#000000' },
      detailTableRowHeight: { ...DEFAULT_DETAIL_TABLE_ROW_HEIGHT },
      headStyles: {
        fontSize: 10,
        alignment: 'center',
        verticalAlignment: 'middle',
        backgroundColor: '#f0f0f0',
        padding: { top: 5, right: 5, bottom: 5, left: 5 },
      },
      bodyStyles: {
        fontSize: 9,
        alignment: 'left',
        verticalAlignment: 'middle',
        padding: { top: 5, right: 5, bottom: 5, left: 5 },
      },
    });
    y += dim.height + 12;
  }

  const newTemplate = JSON.parse(JSON.stringify(template)) as Template;
  newTemplate.schemas = [[...pageSchemas]];
  return newTemplate;
}

/** 
 * 为现有模板中的字段增加中文标签：将 "code" 转换为 "工单编号 (code)"
 * 仅在加载模板时调用，提升可读性而不破坏数据绑定
 */
export function enhanceTemplateWithLabels(
  template: Template,
  variableItems: TemplateVariableItem[]
): Template {
  if (!template.schemas) return template;
  
  const keyToLabelMap = new Map(variableItems.map(item => [item.key, item.label]));
  const next = JSON.parse(JSON.stringify(template)) as Template;
  
  // 遍历所有页面和所有 schema 项
  next.schemas = next.schemas.map((page: any[]) => {
    if (!Array.isArray(page)) return page;
    return page.map((schema: any) => {
      const currentName = schema.name;
      if (!currentName) return schema;

      // 如果能在变量字典中找到对应的中文 label，则进行替换
      const label = keyToLabelMap.get(currentName);
      if (label) {
        return { ...schema, name: label };
      }
      return schema;
    });
  });

  return next;
}

/**
 * 模板加固层：全方位修复 Generator 渲染器对缺失样式与结构的“敏锐性”
 * 针对所有插件类型补齐默认值与必需的数组/对象结构：
 * 1. 补齐 padding/margin 防止 reading 'right'
 * 2. 补齐 table 的 columns/styles 防止 reading 'push' 或 reading 'alignment'
 * 3. 补齐 multiVariableText 的 variables 数组
 */
/**
 * 规范化文本 content 中因递归替换导致的重复标签
 * 例如 "备注: 备注: 备注: {remarks}" -> "备注：{remarks}"
 */
function normalizeRepeatedLabelInContent(content: string): string {
  if (!content || typeof content !== 'string') return content;
  // 匹配 "备注" 或 "备注：" 重复多次后跟 {remarks} 的模式
  const repeatedRemarks = /^(备注[：:]\s*)+(\{remarks\})$/;
  const match = content.match(repeatedRemarks);
  if (match) {
    return `备注：${match[2]}`;
  }
  // 更通用的模式：任意 "备注：" 重复
  const anyRepeated = content.replace(/(备注[：:]\s*){2,}/g, '备注：');
  return anyRepeated;
}

/**
 * 模板加固层：全方位修复 Generator 渲染器对缺失样式与结构的“敏锐性”
 * 针对所有插件类型补齐默认值与必需的数组/对象结构
 */
export function sanitizeTemplate(template: Template): Template {
  if (!template) return { basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }, schemas: [[]] };
  
  const ensurePadding = (p: any) => {
    if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
    const base = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!p || typeof p !== 'object') return base;
    return { ...base, ...p };
  };

  // --- 二进制安全克隆策略 ---
  // JSON.stringify 会破坏 base64 以外的二进制 basePdf (如 ArrayBuffer)
  const isBinaryBasePdf = template.basePdf instanceof ArrayBuffer || ArrayBuffer.isView(template.basePdf);
  
  const next: Template = {
    // 如果是二进制背景，直接引用（Generator 内部会处理），否则深拷贝
    basePdf: isBinaryBasePdf ? template.basePdf : JSON.parse(JSON.stringify(template.basePdf)),
    schemas: JSON.parse(JSON.stringify(template.schemas || [[]]))
  };

  // 1. 基础配置样式补全
  if (!next.basePdf) {
    next.basePdf = { width: 210, height: 297, padding: [10, 10, 10, 10] };
  } else if (!isBinaryBasePdf && typeof next.basePdf === 'object') {
    const bp = next.basePdf as any;
    if ('padding' in bp) {
      bp.padding = Array.isArray(bp.padding) ? bp.padding : [10, 10, 10, 10];
    }
  }

  // 2. 页面内容递归加固
  next.schemas = next.schemas.map((page: any, pageIdx) => {
    const actualPage = Array.isArray(page) ? page : [];
    return actualPage.map((schema: any, schemaIdx) => {
      if (!schema || typeof schema !== 'object') return { type: 'text', content: '', position: { x: 0, y: 0 }, width: 10, height: 10 };

      const s = { ...schema };
      s.name = s.name || `schema_${pageIdx}_${schemaIdx}`;
      
      // 通用样式字典兜底
      if (s.padding !== undefined) s.padding = ensurePadding(s.padding);
      if (s.margin !== undefined) s.margin = ensurePadding(s.margin);
      
      // 字体兜底 (Canvas 测量宽高的命脉)
      if (['text', 'table', 'multiVariableText', 'date', 'time', 'dateTime'].includes(s.type)) {
        s.fontName = s.fontName || 'NotoSansSC';
      }

      // --- 表格专项加固 (修复 reading 'alignment' / 'top' / columnStyles 的终极方案) ---
      // pdfme TableSchema 要求: columnStyles 为 { alignment?: { [colIndex]: ALIGNMENT } }
      // headStyles/bodyStyles 需包含 padding、borderWidth 为 BoxDimensions { top, right, bottom, left }
      if (s.type === 'table') {
        s.columns = Array.isArray(s.columns) && s.columns.length > 0 ? s.columns : [{ key: 'dummy', label: ' ' }];
        s.showHead = s.showHead !== false;
        s.showFoot = !!s.showFoot;
        s.tableStyles = s.tableStyles || { borderWidth: 0.1, borderColor: '#b1b1b1' };

        // head 与 headWidthPercentages 为 getTableOptions 必需
        if (!Array.isArray(s.head) || s.head.length === 0) {
          s.head = s.columns.map((c: any) => c.label ?? c.key ?? '');
        }
        // 修复表头污染：当 head 与首行数据合并时（如 "3序号"、"OP03工序编号"），恢复为纯表头
        const OPERATIONS_HEAD = ['序号', '工序编号', '工序名称', '工序状态', '工作中心'];
        const knownTableHeads: Record<string, string[]> = {
          operations: OPERATIONS_HEAD,
          工序列表: OPERATIONS_HEAD, // enhanceTemplateWithLabels 可能将 name 改为中文
        };
        const expectedHead = s.name ? knownTableHeads[s.name] : null;
        if (expectedHead && Array.isArray(s.head) && s.head.length === expectedHead.length) {
          const isCorrupted = s.head.some(
            (h: string, i: number) =>
              typeof h === 'string' && h !== expectedHead[i] && h.includes(expectedHead[i])
          );
          if (isCorrupted) {
            s.head = [...expectedHead];
          }
        }
        if (!Array.isArray(s.headWidthPercentages) || s.headWidthPercentages.length !== s.head.length) {
          s.headWidthPercentages = s.head.map(() => 100 / s.head.length);
        }

        // 单元格内边距：5mm 与 pdfme 默认一致，确保行高正确计算，避免多行压缩为 1 行
        const defaultCellPadding = 5;
        const defaultBorderWidth = { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 };
        const defaultCellStyle = {
          fontSize: 9,
          lineHeight: 1.2,
          alignment: 'center' as const,
          verticalAlignment: 'middle' as const,
          fontName: 'NotoSansSC',
          padding: ensurePadding(defaultCellPadding),
          borderWidth: defaultBorderWidth,
        };

        s.headStyles = {
          ...defaultCellStyle,
          backgroundColor: '#f1f1f1',
          ...s.headStyles,
          padding: ensurePadding(s.headStyles?.padding ?? defaultCellPadding),
          borderWidth: typeof s.headStyles?.borderWidth === 'object' && s.headStyles.borderWidth
            ? { ...defaultBorderWidth, ...s.headStyles.borderWidth }
            : defaultBorderWidth,
        };

        s.bodyStyles = {
          ...defaultCellStyle,
          fontSize: 8,
          lineHeight: 1.25,
          alignment: 'left' as const,
          ...s.bodyStyles,
          padding: ensurePadding(s.bodyStyles?.padding ?? defaultCellPadding),
          borderWidth: typeof s.bodyStyles?.borderWidth === 'object' && s.bodyStyles.borderWidth
            ? { ...defaultBorderWidth, ...s.bodyStyles.borderWidth }
            : defaultBorderWidth,
          alternateBackgroundColor: s.bodyStyles?.alternateBackgroundColor ?? '',
        };

        // 明细表行高：表头/表体可分别设置；写入 detailTableRowHeight 供设计器回显
        const drhIn = getDetailTableRowHeightFromSchema(s);
        s.detailTableRowHeight = {
          mode: drhIn.mode,
          headMm: clampDetailRowHeightMm(drhIn.headMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.headMm),
          bodyMm: clampDetailRowHeightMm(drhIn.bodyMm, DEFAULT_DETAIL_TABLE_ROW_HEIGHT.bodyMm),
        };
        const headMm = s.detailTableRowHeight.headMm;
        const bodyMm = s.detailTableRowHeight.bodyMm;
        (s.headStyles as any).minCellHeight = headMm;
        (s.bodyStyles as any).minCellHeight = bodyMm;
        if (s.detailTableRowHeight.mode === 'fixed') {
          s.headStyles.lineHeight = 1;
          s.bodyStyles.lineHeight = 1;
        } else {
          if (s.headStyles.lineHeight == null || (s.headStyles as any).lineHeight === 0) {
            (s.headStyles as any).lineHeight = 1.2;
          }
          if (s.bodyStyles.lineHeight == null || (s.bodyStyles as any).lineHeight === 0) {
            (s.bodyStyles as any).lineHeight = 1.25;
          }
        }

        // columnStyles 必须存在；pdfme 期望结构为 { alignment?: { [colIndex]: ALIGNMENT } }
        s.columnStyles = s.columnStyles && typeof s.columnStyles === 'object' ? s.columnStyles : {};

        // __bodyRange.end 为 null 时，pdfme 内部 arr.slice(start, null) 会把 null 当成 0，表体变空（仅表头可见）
        if (s.__bodyRange && typeof s.__bodyRange === 'object' && s.__bodyRange.end === null) {
          delete s.__bodyRange.end;
        }

        // 确保表格外框高度 ≥ 实际排版所需（过矮时 pdfme 设计器内单元格仍会绘制，与下方组件视觉糊成一团）
        const bodyRows = (() => {
          try {
            const c = s.content;
            const parsed = typeof c === 'string' ? JSON.parse(c || '[]') : c;
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 1;
          }
        })();
        const minHeight = Math.max(
          48,
          Math.ceil(headMm + Math.max(1, bodyRows) * bodyMm + 8)
        );
        if (typeof s.height !== 'number' || s.height < minHeight) {
          s.height = minHeight;
        }
        // 列多时略缩表头字号，减少格内换行堆叠
        const colCount = Array.isArray(s.head) ? s.head.length : 0;
        if (colCount > 8 && s.headStyles && typeof s.headStyles.fontSize === 'number') {
          s.headStyles.fontSize = Math.min(s.headStyles.fontSize, 8);
        } else if (colCount > 8 && s.headStyles) {
          s.headStyles.fontSize = 8;
        }
        if (colCount > 8 && s.bodyStyles && typeof s.bodyStyles.fontSize === 'number') {
          s.bodyStyles.fontSize = Math.min(s.bodyStyles.fontSize, 8);
        } else if (colCount > 8 && s.bodyStyles) {
          s.bodyStyles.fontSize = 8;
        }

        // 若 content 首行与 head 相同（误将表头写入 body），移除首行避免重复/错乱
        if (Array.isArray(s.head) && s.head.length > 0) {
          try {
            const parsed = typeof s.content === 'string' ? JSON.parse(s.content || '[]') : s.content;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const firstRow = parsed[0];
              if (Array.isArray(firstRow) && firstRow.length === s.head.length &&
                  firstRow.every((v: string, i: number) => String(v) === String(s.head[i]))) {
                s.content = JSON.stringify(parsed.slice(1));
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      // --- 动态文本加固 ---
      if (s.type === 'multiVariableText') {
        s.variables = Array.isArray(s.variables) ? s.variables : [];
        s.fontSize = s.fontSize || 10;
        s.alignment = s.alignment || 'left';
      }

      // --- 基础文本加固 ---
      if (s.type === 'text') {
        s.alignment = s.alignment || 'left';
        s.verticalAlignment = s.verticalAlignment || 'top';
        s.lineHeight = s.lineHeight || 1;
        s.fontSize = s.fontSize || 10;
        // 修复「备注」等标签因递归替换导致的重复：将 "备注: 备注: 备注: {remarks}" 规范为 "备注：{remarks}"
        if (s.content && typeof s.content === 'string') {
          s.content = normalizeRepeatedLabelInContent(s.content);
        }
      }

      return s;
    });
  });

  return next;
}

/** 检测 content 是否为 pdfme 模板格式 */
export function isPdfmeTemplate(content: string): boolean {
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

/** 从嵌套对象按点号路径取值 */
function resolveValue(key: string, vars: Record<string, unknown>): unknown {
  const keys = key.split('.');
  let val: unknown = vars;
  for (const k of keys) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
      val = (val as Record<string, unknown>)[k];
    } else if (Array.isArray(val) && /^\d+$/.test(k)) {
      val = val[parseInt(k, 10)];
    } else {
      return undefined;
    }
  }
  return val;
}

function formatValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
  return String(val);
}

/** 工序列表转 pdfme 表格 2D 数组 */
const OPERATIONS_TABLE_COLUMNS = [
  'sequence',
  'operation_code',
  'operation_name',
  'status',
  'work_center_name',
] as const;

function operationsToTableRows(operations: unknown[]): string[][] {
  return operations.map((op: any) =>
    OPERATIONS_TABLE_COLUMNS.map((col) => formatValue(op?.[col] ?? ''))
  );
}

/**
 * 将业务变量转换为 pdfme inputs 格式
 * - 文本 schema：inputs[schemaName] = 变量值
 * - 表格 schema：inputs[schemaName] = [[col1,col2,...], ...]
 * - 合并所有变量到 inputs，支持 Expression 表达式如 {code}、{code + " - " + name}
 */
export function variablesToPdfmeInputs(
  template: Template,
  variables: Record<string, unknown>
): Record<string, unknown>[] {
  const allPageInputs: Record<string, unknown>[] = [];
  const schemas = template.schemas ?? [];

  // 获取所有页面的输入映射
  for (const pageSchemas of schemas) {
    const pageInput: Record<string, unknown> = {};
    
    // 基础上下文：合并所有变量，供 Expression 使用
    for (const [k, v] of Object.entries(variables)) {
      if (!Array.isArray(v)) {
        pageInput[k] = formatValue(v);
      }
    }

    // 针对当前页面 schema 的特定映射
    for (const schema of pageSchemas) {
      const name = (schema as any).name;
      const type = (schema as any).type;
      if (!name) continue;

      if (type === 'table') {
        const arrData = variables[name] ?? resolveValue(name, variables);
        if (Array.isArray(arrData)) {
          let tableRows: string[][] = [];
          const schemaCols = (schema as any).columns;
          if (Array.isArray(schemaCols) && schemaCols.length > 0) {
            const keys = schemaCols
              .map((c: { key?: string }) => c?.key)
              .filter(
                (k: string | undefined): k is string =>
                  typeof k === 'string' && k.length > 0 && k !== 'dummy'
              );
            if (keys.length > 0) {
              tableRows = arrData.map((item) =>
                typeof item === 'object' && item !== null
                  ? keys.map((k) => formatValue((item as Record<string, unknown>)[k] ?? ''))
                  : [formatValue(item)]
              );
            }
          }
          if (tableRows.length === 0 && name === 'operations') {
            tableRows = operationsToTableRows(arrData);
          } else if (tableRows.length === 0) {
            tableRows = arrData.map((item) =>
              typeof item === 'object' && item !== null
                ? Object.values(item).map((v) => formatValue(v))
                : [formatValue(item)]
            );
          }
          // 重要：PDFme Table 插件在 Generator 中通常要求 input 为 JSON 字符串
          console.debug('[pdfme table]', name, '| arrData.length:', arrData.length, '| tableRows.length:', tableRows.length, '| colKeys:', (schema as any).columns?.map((c: any) => c?.key));
          pageInput[name] = JSON.stringify(tableRows);
        } else {
          console.debug('[pdfme table]', name, '| arrData is NOT array:', typeof arrData, arrData);
          pageInput[name] = '[]';
        }
      } else {
        const val = variables[name] ?? resolveValue(name, variables);
        if (val !== undefined && val !== null) {
          pageInput[name] = formatValue(val);
        }
      }
    }
    allPageInputs.push(pageInput);
  }

  return allPageInputs.length > 0 ? allPageInputs : [variables];
}
