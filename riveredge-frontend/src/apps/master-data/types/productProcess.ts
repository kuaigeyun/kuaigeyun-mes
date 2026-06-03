/** 物料产品工艺（单表） */

export type ProductProcessLine = {
  operationUuid: string;
  operationId?: number;
  code?: string;
  name?: string;
  standardTime?: number;
  setupTime?: number;
  workshopIds?: number[];
  operatorIds?: number[];
  teamIds?: number[];
  equipmentIds?: number[];
  pieceRate?: number;
  reportingType?: string;
  isNodeOperation?: boolean;
  overReportMode?: string;
  overReportValue?: number;
};

export type MaterialProductProcess = {
  materialUuid: string;
  materialId: number;
  processRouteUuid?: string;
  processRouteId?: number;
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
};

export type MaterialProductProcessSave = {
  processRouteUuid?: string;
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
};
