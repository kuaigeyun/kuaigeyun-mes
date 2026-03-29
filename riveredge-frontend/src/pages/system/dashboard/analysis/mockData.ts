export interface KpiItem {
  id: string;
  titleKey: string;
  value: string;
  sub?: string;
  trend: "up" | "down" | "flat";
  trendValue: string;
  accent: "cyan" | "emerald" | "amber" | "violet" | "rose" | "slate";
}

/** 轨道 KPI：数值带业务口径说明，增强「运营驾驶舱」质感 */
export const kpiItems: KpiItem[] = [
  {
    id: "orders",
    titleKey: "dashboard.businessBoard.kpi.todayOrders",
    value: "192",
    sub: "CRM 待审 42 · EDI 已校 186",
    trend: "up",
    trendValue: "+8.4%",
    accent: "cyan",
  },
  {
    id: "otd",
    titleKey: "dashboard.businessBoard.kpi.ontimeDelivery",
    value: "94.2%",
    sub: "SLA 窗口内 118 单 · 临界 6 单",
    trend: "up",
    trendValue: "+1.1pt",
    accent: "emerald",
  },
  {
    id: "wip",
    titleKey: "dashboard.businessBoard.kpi.wipOrders",
    value: "1,286",
    sub: "8 车间 · 瓶颈装配 412 · 喷涂 198",
    trend: "flat",
    trendValue: "+1.2%",
    accent: "amber",
  },
  {
    id: "exceptions",
    titleKey: "dashboard.businessBoard.kpi.openExceptions",
    value: "21",
    sub: "质量 8 · 交期 7 · 库存 4 · 设备 2",
    trend: "down",
    trendValue: "−3",
    accent: "rose",
  },
  {
    id: "turnover",
    titleKey: "dashboard.businessBoard.kpi.inventoryTurnover",
    value: "26.4",
    sub: "目标 ≤28d · A 类 18d",
    trend: "up",
    trendValue: "−1.6d",
    accent: "violet",
  },
  {
    id: "closedWo7d",
    titleKey: "dashboard.businessBoard.kpi.closedWorkOrders7d",
    value: "358",
    sub: "按期 332 · 延期结案 26 · 复核 31",
    trend: "up",
    trendValue: "+9.1%",
    accent: "emerald",
  },
  {
    id: "shipmentsToday",
    titleKey: "dashboard.businessBoard.kpi.todayShipments",
    value: "96",
    sub: "整车 16 · 零担 74 · 在途 22",
    trend: "up",
    trendValue: "+7 批",
    accent: "slate",
  },
  {
    id: "oeeAvg",
    titleKey: "dashboard.businessBoard.kpi.avgEquipmentUtil",
    value: "77.8%",
    sub: "联网 186 台 · 采集 99.2%",
    trend: "flat",
    trendValue: "+0.4pt",
    accent: "cyan",
  },
];

/** 产线产出：计划 vs 实际（分组柱 + 达成标签） */
export const unitOutputData = [
  { name: "金工一线", target: 1200, actual: 1216, rateLabel: "101%↑" },
  { name: "金工二线", target: 1150, actual: 1098, rateLabel: "96%" },
  { name: "装配", target: 1000, actual: 938, rateLabel: "94%·T+12" },
  { name: "喷涂", target: 820, actual: 772, rateLabel: "89%" },
  { name: "质检", target: 540, actual: 556, rateLabel: "100%" },
  { name: "包装", target: 660, actual: 684, rateLabel: "97%" },
];

export interface FeedItem {
  id: string;
  time: string;
  level: "info" | "warn" | "risk";
  titleKey: string;
  detailKey: string;
}

/** 设备现场流：按时间倒序堆叠，覆盖 NC/刀具/视觉/能源/网络等 */
export const operationsFeed: FeedItem[] = [
  { id: "1", time: "10:42", level: "risk", titleKey: "dashboard.businessBoard.feed.equipFault", detailKey: "dashboard.businessBoard.feed.equipFaultDetail" },
  { id: "2", time: "10:35", level: "warn", titleKey: "dashboard.businessBoard.feed.equipToolLife", detailKey: "dashboard.businessBoard.feed.equipToolLifeDetail" },
  { id: "3", time: "10:28", level: "info", titleKey: "dashboard.businessBoard.feed.equipNcUpload", detailKey: "dashboard.businessBoard.feed.equipNcUploadDetail" },
  { id: "4", time: "10:18", level: "warn", titleKey: "dashboard.businessBoard.feed.equipMaintDue", detailKey: "dashboard.businessBoard.feed.equipMaintDueDetail" },
  { id: "5", time: "10:05", level: "warn", titleKey: "dashboard.businessBoard.feed.equipVisionReject", detailKey: "dashboard.businessBoard.feed.equipVisionRejectDetail" },
  { id: "6", time: "09:55", level: "warn", titleKey: "dashboard.businessBoard.feed.equipDowntime", detailKey: "dashboard.businessBoard.feed.equipDowntimeDetail" },
  { id: "7", time: "09:48", level: "info", titleKey: "dashboard.businessBoard.feed.equipMesHeartbeat", detailKey: "dashboard.businessBoard.feed.equipMesHeartbeatDetail" },
  { id: "8", time: "09:40", level: "info", titleKey: "dashboard.businessBoard.feed.equipReset", detailKey: "dashboard.businessBoard.feed.equipResetDetail" },
  { id: "9", time: "09:31", level: "warn", titleKey: "dashboard.businessBoard.feed.equipCoolantLow", detailKey: "dashboard.businessBoard.feed.equipCoolantLowDetail" },
  { id: "10", time: "09:22", level: "info", titleKey: "dashboard.businessBoard.feed.equipEnergyReport", detailKey: "dashboard.businessBoard.feed.equipEnergyReportDetail" },
  { id: "11", time: "09:12", level: "info", titleKey: "dashboard.businessBoard.feed.equipCalib", detailKey: "dashboard.businessBoard.feed.equipCalibDetail" },
  { id: "12", time: "08:58", level: "info", titleKey: "dashboard.businessBoard.feed.equipOtaOk", detailKey: "dashboard.businessBoard.feed.equipOtaOkDetail" },
];

/** 设备状态占比（含换型/调试） */
export const deviceStatusMixData = [
  { typeKey: "running", value: 52 },
  { typeKey: "idle", value: 21 },
  { typeKey: "setup", value: 10 },
  { typeKey: "fault", value: 5 },
  { typeKey: "maint", value: 12 },
];

export const equipmentUtilTrendData = [
  { dayIdx: 0, oee: 74.2, downtimeMin: 42 },
  { dayIdx: 1, oee: 77.1, downtimeMin: 33 },
  { dayIdx: 2, oee: 72.8, downtimeMin: 54 },
  { dayIdx: 3, oee: 78.9, downtimeMin: 26 },
  { dayIdx: 4, oee: 79.4, downtimeMin: 29 },
  { dayIdx: 5, oee: 71.2, downtimeMin: 51 },
  { dayIdx: 6, oee: 73.6, downtimeMin: 41 },
];

/** 工单计划达成率（%）— 含周末波动 */
export const planExecutionLineData = [
  { dayIdx: 0, rate: 86 },
  { dayIdx: 1, rate: 89 },
  { dayIdx: 2, rate: 84 },
  { dayIdx: 3, rate: 92 },
  { dayIdx: 4, rate: 90 },
  { dayIdx: 5, rate: 79 },
  { dayIdx: 6, rate: 83 },
];

/** 销售接单 vs 发运（近 7 日） */
export const salesShipTrendData = [
  { dayIdx: 0, orders: 124, shipments: 102 },
  { dayIdx: 1, orders: 132, shipments: 108 },
  { dayIdx: 2, orders: 118, shipments: 96 },
  { dayIdx: 3, orders: 141, shipments: 118 },
  { dayIdx: 4, orders: 156, shipments: 128 },
  { dayIdx: 5, orders: 134, shipments: 112 },
  { dayIdx: 6, orders: 122, shipments: 101 },
];

/** 采购到货批次数（含周末低谷） */
export const procurementInboundData = [
  { dayIdx: 0, batches: 46 },
  { dayIdx: 1, batches: 52 },
  { dayIdx: 2, batches: 39 },
  { dayIdx: 3, batches: 58 },
  { dayIdx: 4, batches: 54 },
  { dayIdx: 5, batches: 36 },
  { dayIdx: 6, batches: 41 },
];

/** 仓储 / 质检环节件数 */
export const warehouseQcBarData = [
  { stageKey: "received", qty: 148 },
  { stageKey: "onShelf", qty: 92 },
  { stageKey: "pendingQc", qty: 46 },
  { stageKey: "released", qty: 134 },
  { stageKey: "rework", qty: 18 },
  { stageKey: "rejected", qty: 11 },
];
