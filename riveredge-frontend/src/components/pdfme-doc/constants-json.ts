/**
 * pdfme 模板 JSON 常量（无 @pdfme 依赖，供列表等轻量页面使用）
 *
 * 避免列表页导入 constants.ts 时拉入整个 @pdfme 库
 */

/** 新建模板时的默认 content JSON */
export const EMPTY_PDFME_TEMPLATE_JSON =
  '{"basePdf":{"width":210,"height":297,"padding":[20,20,20,20]},"schemas":[[]]}';

/** 默认工单打印模板 JSON（含工单二维码、基础字段、工序表格） */
export const DEFAULT_WORK_ORDER_PDFME_TEMPLATE_JSON = JSON.stringify({
  basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] },
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
        headStyles: {
          fontSize: 9,
          alignment: 'center',
          verticalAlignment: 'middle',
          backgroundColor: '#f0f0f0',
          padding: { top: 5, right: 5, bottom: 5, left: 5 },
        },
        bodyStyles: {
          fontSize: 8,
          alignment: 'left',
          verticalAlignment: 'middle',
          padding: { top: 5, right: 5, bottom: 5, left: 5 },
        },
      },
      { name: 'remarks', type: 'text', position: { x: 10, y: 150 }, width: 180, height: 15, content: '备注：{remarks}', readOnly: true },
    ],
  ],
});
