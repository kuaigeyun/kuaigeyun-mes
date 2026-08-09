/**
 * 将表头+明细列表拍平为明细表格行（一行一条明细，对齐采购订单明细视图）。
 */

export type FlattenDocumentDetailRowsOptions<THeader, TItem> = {
  headers: THeader[];
  getHeaderId: (header: THeader) => number | string | undefined;
  getItems: (header: THeader) => TItem[] | undefined | null;
  buildRowKey: (header: THeader, item: TItem | null, index: number) => string;
  mapItemRow: (header: THeader, item: TItem, index: number) => Record<string, unknown>;
  mapEmptyHeaderRow?: (header: THeader) => Record<string, unknown>;
};

export function flattenDocumentDetailRows<THeader, TItem>(
  options: FlattenDocumentDetailRowsOptions<THeader, TItem>,
): Record<string, unknown>[] {
  const {
    headers,
    getHeaderId,
    getItems,
    buildRowKey,
    mapItemRow,
    mapEmptyHeaderRow,
  } = options;
  const flatRows: Record<string, unknown>[] = [];
  for (const header of headers) {
    const headerId = getHeaderId(header);
    const items = getItems(header) ?? [];
    if (items.length === 0) {
      if (mapEmptyHeaderRow) {
        flatRows.push({
          ...mapEmptyHeaderRow(header),
          _rowKey: buildRowKey(header, null, 0),
        });
      }
      continue;
    }
    items.forEach((item, index) => {
      flatRows.push({
        ...mapItemRow(header, item, index),
        _rowKey: buildRowKey(header, item, index),
        _headerId: headerId,
      });
    });
  }
  return flatRows;
}

export type DetailTableViewMode = 'order' | 'detail';

export function resolveDetailTableViewMode(
  viewType: 'table' | 'detailTable' | 'help',
): DetailTableViewMode {
  return viewType === 'table' ? 'order' : 'detail';
}
