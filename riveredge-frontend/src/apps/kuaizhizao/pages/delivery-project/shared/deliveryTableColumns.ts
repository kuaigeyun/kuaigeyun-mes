/** 交付项目列表：客户定宽（含客户+销售订单叠列） */

export const DELIVERY_CUSTOMER_COLUMN_DEFAULTS = {
  width: 220,
  minWidth: 220,
  uniTableKeepWidth: true,
  ellipsis: true,
} as const;

/**
 * 流程排单等：项目名称 RemainderFlex（与 filler 互斥）。
 * 交付项目列表余量已改挂「节点进度」，勿再对本页项目名使用本常量。
 */
export const DELIVERY_PROJECT_NAME_REMAINDER_COLUMN_DEFAULTS = {
  minWidth: 200,
  uniTableRemainderFlex: true,
  uniTablePrimaryFlex: true,
  resizable: false,
  ellipsis: false,
} as const;

/**
 * 交付项目列表：节点进度 RemainderFlex（与 filler 互斥，避免状态/操作间空白）。
 * 禁止与项目名/客户列同时挂 RemainderFlex。
 */
export const DELIVERY_NODE_PROGRESS_REMAINDER_COLUMN_DEFAULTS = {
  minWidth: 200,
  uniTableRemainderFlex: true,
  uniTablePrimaryFlex: true,
  resizable: false,
  ellipsis: false,
} as const;
