/**
 * 仓储单据列表列序真源。
 * 勿套用销售单据 SALES_DOC_LIST_FIELD_RANK：后者把 quantity/total_quantity 提前、
 * 未登记的仓储字段落到默认末段，导致列序不贴合仓储语义。
 *
 * 目标顺序：主单号 → 类型/来源 → 数量 → 种类数 → 进度 → 状态 → 仓库 → 业务日期 → 责任人 → 审计 → 操作
 */
export const WAREHOUSE_DOC_LIST_FIELD_RANK: Record<string, number> = {
  // 主标识
  code: 10,
  receipt_code: 10,
  return_code: 10,
  delivery_code: 10,
  picking_code: 10,
  inbound_code: 10,
  outbound_code: 10,
  borrow_code: 11,
  notice_code: 10,
  doc_code: 10,
  subjectDocNo: 10,
  registration_code: 10,

  // 类型 / 来源
  receipt_type: 20,
  outbound_type: 20,
  reason_type: 20,
  transfer_mode: 20,
  stocktaking_type: 20,
  call_type: 20,
  sourceDocNo: 21,
  purchase_order_code: 21,
  sales_order_code: 21,
  sales_delivery_code: 21,
  work_order_code: 21,
  outsource_work_order_code: 21,
  customer_name: 22,
  mapped_material_name: 23,

  // 数量 / 种类数 / 金额
  total_quantity: 30,
  quantity: 30,
  requested_quantity: 30,
  delivered_quantity: 31,
  total_items: 32,
  items_count: 32,
  counted_items: 33,
  total_differences: 34,
  total_amount: 35,
  total_difference_amount: 36,

  // 进度（阶段 / 数量占比）
  lifecycle_stage: 40,
  quantity_progress: 41,
  kitting_rate: 41,
  fulfillment_progress: 41,

  // 状态
  status: 50,
  alert_label: 51,
  priority: 52,

  // 仓库
  warehouse_name: 60,
  from_warehouse_name: 60,
  to_warehouse_name: 61,
  suggested_warehouse_name: 60,
  target_warehouse_name: 60,

  // 业务日期 / 责任人
  receipt_date: 70,
  receipt_time: 70,
  delivery_date: 70,
  delivery_time: 70,
  return_time: 70,
  borrow_time: 70,
  transfer_date: 70,
  stocktaking_date: 70,
  assembly_date: 70,
  disassembly_date: 70,
  registration_date: 70,
  planned_delivery_date: 71,
  expected_return_date: 71,
  needed_at: 71,
  sent_at: 72,
  received_by: 75,
  returner_name: 75,
  delivered_by: 75,
  deliverer_name: 75,
  receiver_name: 75,
  borrower_name: 75,
  caller_name: 75,
  department: 76,
  carrier: 77,
  tracking_number: 78,

  // 物料信息（库存/配料）
  material_name: 22,
  material_code: 22,
  material_spec: 23,
  model: 24,
  brand: 25,
  texture: 26,
  material_unit: 27,
  product_material_name: 22,
  in_transit_quantity: 31,

  // 审计
  updated_at: 92,
  created_at: 93,
  updatedAt: 92,
  createdAt: 93,
};
