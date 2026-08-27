/**
 * 仓储单据列表列序（唯一允许的领域旁路）。
 *
 * 仓储语义与 GLOBAL_DOC_LIST_FIELD_RANK 冲突（数量/状态/仓库需靠前），
 * 故独立维护；其它应用域禁止再开旁路 map，一律改 GLOBAL_DOC_LIST_FIELD_RANK。
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
  /** 出库 Hub 主叠列 key（与 subjectDocNo 同段） */
  subject_doc: 10,
  registration_code: 10,

  // 类型 / 来源（picking_code 在入库列表作来源展示时走 source 段，勿与主单号抢 10）
  task_type: 20,
  receipt_type: 20,
  outbound_type: 20,
  reason_type: 20,
  return_reason: 24,
  transfer_mode: 20,
  stocktaking_type: 20,
  call_type: 20,
  sourceDocNo: 21,
  source_doc_no: 21,
  purchase_order_code: 21,
  sales_order_code: 21,
  sales_delivery_code: 21,
  work_order_code: 21,
  reserved_work_order_code: 40,
  outsource_work_order_code: 21,
  customer_name: 22,
  supplier_name: 22,
  mapped_material_name: 23,

  // 数量 / 种类数 / 金额
  /** 明细物料名预览（替代入库品种数，余量列） */
  line_materials: 29.5,
  total_quantity: 30,
  quantity: 30,
  requested_quantity: 30,
  delivered_quantity: 31,
  batch_no: 28,
  /** 可用 → 库存 → 预留（线边仓等拆列后同序） */
  available_quantity: 29.7,
  reserved_quantity: 31,
  total_items: 32,
  items_count: 32,
  counted_items: 33,
  total_differences: 34,
  total_amount: 35,
  total_difference_amount: 36,

  // 进度（数量占比；lifecycle 固定右侧，勿插在业务列中间）
  quantity_progress: 41,
  kitting_rate: 41,
  fulfillment_progress: 41,
  receipt_progress: 41,
  lifecycle_stage: 88,

  // 状态（表内流程状态用 key=lifecycle→91；此处 status 仅兜底）
  status: 50,
  alert_label: 51,
  alert_level: 52,
  is_enabled: 53,
  // 优先级紧挨进度/齐套等徽章段，勿落到仓库段之后
  priority: 42,

  // 库存预警（规则 / 记录）
  alert_type: 20,
  rule_name: 11,
  material_group_name: 23,
  current_quantity: 30,
  threshold_value: 33,
  threshold_type: 34,
  inherit_material_threshold: 35,
  triggered_at: 70,

  // 仓库
  warehouse_name: 60,
  from_warehouse_name: 60,
  to_warehouse_name: 61,
  suggested_warehouse_name: 60,
  target_warehouse_name: 60,

  // 倒冲：出库仓 → 报工/BOM/倒冲量 → 错误信息（余量列）
  report_quantity: 62,
  bom_quantity: 63,
  backflush_quantity: 64,
  error_message: 65,

  // 业务时间（与操作员堆叠列）/ 责任人
  biz_time_operator: 70,
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
  received_by: 70,
  returner_name: 70,
  delivered_by: 70,
  deliverer_name: 70,
  receiver_name: 70,
  borrower_name: 70,
  caller_name: 70,
  department: 76,
  carrier: 77,
  tracking_number: 78,

  // 物料信息（库存/配料）；编码 → 名称 → 规格（拆列同序）
  /** 物料中心任务队列：产品/物料叠列（列上须设 key=material） */
  material: 22,
  material_code: 21,
  material_name: 22,
  material_spec: 22.5,
  model: 24,
  brand: 25,
  texture: 26,
  material_unit: 27,
  product_material_name: 22,
  in_transit_quantity: 31,

  /**
   * 线边仓库存：编码/名称/规格 → 线边仓 → 批号 → 可用/库存/预留 → 预留工单 → 状态
   * （列上须设同名 key；勿用 warehouse_name 以免与其它仓储单据仓库段位冲突）
   */
  line_side_warehouse: 23,
  line_side_batch: 28,
  line_side_qty: 30,
  lifecycle: 91,

  // 审计
  updated_at: 92,
  created_at: 93,
  updatedAt: 92,
  createdAt: 93,
};
