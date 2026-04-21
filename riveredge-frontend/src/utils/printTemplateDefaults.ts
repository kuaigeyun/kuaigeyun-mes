/**
 * 打印模板默认内容常量
 */

/** 新建模板时的默认 HTML content */
export const EMPTY_HTML_TEMPLATE = `<div style="font-family: 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.6;">
  <h2 style="margin: 0 0 12px 0;">打印模板</h2>
  <p>请在此编辑模板内容，例如：单据编号 {{code}}</p>
</div>`;

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

