/**
 * 打印模板默认内容常量
 */

/** 新建模板时的默认可视化 schema（空画布起点） */
export const EMPTY_DESIGNER_SCHEMA = {
  version: 'v1',
  pageSize: 'A4',
  orientation: 'portrait' as const,
  margins: { top: 14, right: 12, bottom: 16, left: 12 },
  itemSpacing: 6,
  blocks: [
    {
      id: 'text-welcome',
      type: 'text' as const,
      content: '打印模板',
      tag: 'h2' as const,
      style: { fontSize: '18px', fontWeight: '700', textAlign: 'center' },
    },
    {
      id: 'field-code',
      type: 'field' as const,
      key: 'code',
      label: '单据编号',
      showLabel: true,
    },
  ],
};

/** 新建模板时的默认 HTML content（与 EMPTY_DESIGNER_SCHEMA 对应的简易占位） */
export const EMPTY_HTML_TEMPLATE = `<div style="font-family: 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.6;">
  <h2 style="margin: 0 0 12px 0; text-align: center;">打印模板</h2>
  <p><strong>单据编号：</strong>{{ code }}</p>
</div>`;

/** 新建模板默认 config：可视化真源 */
export const EMPTY_VISUAL_PRINT_CONFIG = (documentType?: string) => ({
  ...(documentType ? { document_type: documentType } : {}),
  engine: 'jinja2',
  strict_variables: false,
  source_type: 'designer_json',
  designer_version: 'v1',
  designer_schema: EMPTY_DESIGNER_SCHEMA,
  page: { size: 'A4', orientation: 'portrait', margin: '14mm 12mm' },
});

/** 默认工单模板 HTML（用于一键加载预设） */
export const DEFAULT_WORK_ORDER_HTML_TEMPLATE = `<div style="font-family: 'Microsoft YaHei', sans-serif; font-size: 12px; line-height: 1.5;">
  <h2 style="text-align: center; margin: 0 0 12px 0;">工单</h2>
  <p><strong>工单编号：</strong>{{code}}</p>
  <p><strong>工单名称：</strong>{{name}}</p>
  <p><strong>产品编码：</strong>{{product_code}}</p>
  <p><strong>产品名称：</strong>{{product_name}}</p>
  <p><strong>数量：</strong>{{quantity}}</p>
  <p><strong>状态：</strong>{{status}}</p>
  <p><strong>计划开始：</strong>{{planned_start_date}}</p>
  <p><strong>计划结束：</strong>{{planned_end_date}}</p>
  <p><strong>备注：</strong>{{remarks}}</p>
</div>`;
