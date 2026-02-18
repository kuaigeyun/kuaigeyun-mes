/**
 * pdfme 打印模板常量
 *
 * 提供空白模板、纸张预设、边距配置、BasePDF（自定义 PDF 背景）
 */

import type { Template } from '@pdfme/common';
import { isBlankPdf } from '@pdfme/common';

/** 纸张预设（中国制造业常用规格，单位 mm） */
export interface PaperPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4', label: 'A4 (210×297mm)', width: 210, height: 297 },
  { id: 'a5', label: 'A5 (148×210mm)', width: 148, height: 210 },
  { id: 'a3', label: 'A3 (297×420mm)', width: 297, height: 420 },
  { id: '241_full', label: '241mm 一等分/整页 (241×279mm)', width: 241, height: 279.4 },
  { id: '241_half', label: '241mm 二等分 (241×140mm)', width: 241, height: 140 },
  { id: '241_third', label: '241mm 三联三等分 (241×93mm)', width: 241, height: 93.1 },
  { id: '381_full', label: '381mm 整张 (381×279mm)', width: 381, height: 279.4 },
  { id: '120_80', label: '120mm 收据/小票 (120×80mm)', width: 120, height: 80 },
  { id: '190_140', label: '190mm 二等分 (190×140mm)', width: 190, height: 140 },
  { id: 'custom', label: '自定义', width: 0, height: 0 },
];

/** 默认边距 [上, 右, 下, 左] mm */
export const DEFAULT_PADDING = [20, 20, 20, 20] as [number, number, number, number];

/** 空白 A4 模板（210×297mm） */
export const EMPTY_PDFME_TEMPLATE: Template = {
  basePdf: { width: 210, height: 297, padding: [...DEFAULT_PADDING] },
  schemas: [[]],
};

/** 新建模板时的默认 content JSON */
export const EMPTY_PDFME_TEMPLATE_JSON = JSON.stringify(EMPTY_PDFME_TEMPLATE);

/** 默认工单打印模板（含工单二维码、基础字段、工序表格） */
export const DEFAULT_WORK_ORDER_PDFME_TEMPLATE: Template = {
  basePdf: { width: 210, height: 297, padding: [...DEFAULT_PADDING] },
  schemas: [
    [
      { name: 'title', type: 'text', position: { x: 10, y: 10 }, width: 100, height: 12, content: '工单', readOnly: true },
      { name: 'work_order_qrcode', type: 'qrcode', position: { x: 160, y: 10 }, width: 30, height: 30, content: 'WO-SAMPLE-001', backgroundColor: '#ffffff', barColor: '#000000' },
      { name: 'code', type: 'text', position: { x: 10, y: 28 }, width: 80, height: 8, content: '{code}', readOnly: true },
      { name: 'name', type: 'text', position: { x: 100, y: 28 }, width: 90, height: 8, content: '{name}', readOnly: true },
      { name: 'product_code', type: 'text', position: { x: 10, y: 40 }, width: 80, height: 8, content: '{product_code}', readOnly: true },
      { name: 'product_name', type: 'text', position: { x: 100, y: 40 }, width: 90, height: 8, content: '{product_name}', readOnly: true },
      { name: 'quantity', type: 'text', position: { x: 10, y: 52 }, width: 40, height: 8, content: '{quantity}', readOnly: true },
      { name: 'status', type: 'text', position: { x: 60, y: 52 }, width: 50, height: 8, content: '{status}', readOnly: true },
      { name: 'workshop_name', type: 'text', position: { x: 120, y: 52 }, width: 70, height: 8, content: '{workshop_name}', readOnly: true },
      { name: 'planned_start_date', type: 'text', position: { x: 10, y: 64 }, width: 85, height: 8, content: '{planned_start_date}', readOnly: true },
      { name: 'planned_end_date', type: 'text', position: { x: 100, y: 64 }, width: 90, height: 8, content: '{planned_end_date}', readOnly: true },
      {
        name: 'operations',
        type: 'table',
        position: { x: 10, y: 82 },
        width: 180,
        height: 60,
        showHead: true,
        head: ['序号', '工序编码', '工序名称', '工序状态', '工作中心'],
        headWidthPercentages: [12, 18, 28, 20, 22],
        content: JSON.stringify([
          ['1', 'OP01', '下料', '待开始', '下料中心'],
          ['2', 'OP02', '加工', '进行中', '加工中心'],
          ['3', 'OP03', '检验', '待开始', '质检中心'],
        ]),
        tableStyles: { borderWidth: 0.3, borderColor: '#000000' },
        headStyles: { fontSize: 9, alignment: 'center', verticalAlignment: 'middle', backgroundColor: '#f0f0f0' },
        bodyStyles: { fontSize: 8, alignment: 'left', verticalAlignment: 'middle' },
      },
      { name: 'remarks', type: 'text', position: { x: 10, y: 150 }, width: 180, height: 15, content: '备注：{remarks}', readOnly: true },
    ],
  ],
};

/** 判断 basePdf 是否为空白页（可配置纸张/边距） */
export { isBlankPdf };

/** 从模板提取 basePdf 配置（仅 BlankPdf 有效） */
export function getBasePdfFromTemplate(template: Template): {
  width: number;
  height: number;
  padding: [number, number, number, number];
  isCustomPdf: boolean;
} {
  const bp = template.basePdf;
  if (isBlankPdf(bp)) {
    const p = bp.padding;
    return {
      width: bp.width,
      height: bp.height,
      padding: Array.isArray(p) && p.length === 4 ? [p[0], p[1], p[2], p[3]] : [...DEFAULT_PADDING],
      isCustomPdf: false,
    };
  }
  return { width: 210, height: 297, padding: [...DEFAULT_PADDING], isCustomPdf: true };
}

/** 页眉页脚配置（staticSchema，仅空白页 basePdf 有效） */
export interface StaticSchemaConfig {
  headerText?: string;
  footerText?: string;
}

/** 应用 basePdf 配置到模板（空白页模式，支持页眉页脚） */
export function applyBasePdfToTemplate(
  template: Template,
  basePdf: {
    width: number;
    height: number;
    padding: [number, number, number, number];
    staticSchema?: import('@pdfme/common').Schema[];
  }
): Template {
  const next = JSON.parse(JSON.stringify(template)) as Template;
  const bp = template.basePdf as any;
  const prevStatic = isBlankPdf(bp) && bp.staticSchema ? bp.staticSchema : [];
  next.basePdf = {
    width: basePdf.width,
    height: basePdf.height,
    padding: basePdf.padding,
    staticSchema: basePdf.staticSchema ?? prevStatic,
  };
  return next;
}

/** 从 staticSchema 提取页眉页脚文本 */
export function getStaticSchemaTexts(template: Template): { headerText: string; footerText: string } {
  const bp = template.basePdf as any;
  if (!isBlankPdf(bp) || !Array.isArray(bp.staticSchema)) {
    return { headerText: '', footerText: '' };
  }
  let headerText = '';
  let footerText = '';
  for (const s of bp.staticSchema) {
    const content = (s as any).content || '';
    const name = (s as any).name || '';
    if (name === 'staticHeader') headerText = content;
    else if (name === 'staticFooter') footerText = content;
    else {
      const y = (s as any).position?.y ?? 0;
      const height = bp.height || 297;
      if (y >= height / 2) headerText = content;
      else footerText = content;
    }
  }
  return { headerText, footerText };
}

/** 根据页眉页脚配置生成 staticSchema */
export function buildStaticSchemaFromConfig(
  config: StaticSchemaConfig,
  basePdf: { width: number; height: number; padding: [number, number, number, number] }
): import('@pdfme/common').Schema[] {
  const schemas: any[] = [];
  const [pt, pr, pb, pl] = basePdf.padding;
  const w = basePdf.width - pl - pr;
  const h = basePdf.height;

  if (config.headerText) {
    schemas.push({
      name: 'staticHeader',
      type: 'text',
      position: { x: pl, y: h - pt - 12 },
      width: w,
      height: 10,
      content: config.headerText,
      readOnly: true,
      fontSize: 9,
      alignment: 'center',
      verticalAlignment: 'middle',
    });
  }
  if (config.footerText) {
    schemas.push({
      name: 'staticFooter',
      type: 'text',
      position: { x: pl, y: pb },
      width: w,
      height: 10,
      content: config.footerText,
      readOnly: true,
      fontSize: 9,
      alignment: 'center',
      verticalAlignment: 'middle',
    });
  }
  return schemas;
}

/** 将上传的 PDF 文件转为 base64，用于 basePdf */
export function fileToBasePdfBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result.startsWith('data:application/pdf;base64,')) {
        resolve(result);
      } else {
        reject(new Error('无法读取 PDF 文件'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 使用自定义 PDF 作为 basePdf 更新模板 */
export function applyCustomBasePdfToTemplate(template: Template, base64Pdf: string): Template {
  const next = JSON.parse(JSON.stringify(template)) as Template;
  next.basePdf = base64Pdf;
  return next;
}
