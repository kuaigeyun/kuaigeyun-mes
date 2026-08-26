/** 物料产品工艺（单表） */

export type ManufacturingTimeUnit = 'h' | 'm' | 's';

export type ProductProcessLine = {
  operationUuid: string;
  operationId?: number;
  code?: string;
  name?: string;
  /** 界面显示值（单位见 standardTimeUnit）；API 存 N 件合计秒 */
  standardTime?: number;
  /** 标准工时件数基准，默认 1 */
  standardTimeQty?: number;
  /** UI 单位偏好，不参与运算 */
  standardTimeUnit?: ManufacturingTimeUnit;
  /** 界面显示值（单位见 setupTimeUnit）；API 存秒 */
  setupTime?: number;
  setupTimeUnit?: ManufacturingTimeUnit;
  workshopIds?: number[];
  operatorIds?: number[];
  teamIds?: number[];
  equipmentIds?: number[];
  pieceRate?: number;
  reportingType?: string;
  isNodeOperation?: boolean;
  overReportMode?: string;
  overReportValue?: number;
  isOutsourced?: boolean;
  outsourceLeadTimeDays?: number;
  outsourceSupplierId?: number;
  outsourceSupplierName?: string;
};

export type MaterialProductProcess = {
  materialUuid: string;
  materialId: number;
  processRouteUuid?: string;
  processRouteId?: number;
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
};

export type MaterialProductProcessSave = {
  processRouteUuid?: string;
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
  /** 另存为新工艺路线主数据并同步物料默认路线 */
  saveAsNewRoute?: boolean;
  newRouteCode?: string;
  newRouteName?: string;
};

export type ProcessRouteOperationTemplate = {
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
};
