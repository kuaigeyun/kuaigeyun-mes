/**
 * 将导入用二维表数据转为 Univer cellData（第 1 行表头、第 2 行示例、其余为数据区）
 */
export type ImportSheetStyles = {
  headerStyleId: string;
  exampleStyleId: string;
  dataBorderStyleId: string;
  styles: Record<string, unknown>;
};

export function createImportSheetStyles(): ImportSheetStyles {
  const headerStyleId = 'headerStyle';
  const exampleStyleId = 'exampleStyle';
  const dataBorderStyleId = 'dataBorderStyle';
  const styles: Record<string, unknown> = {
    [headerStyleId]: {
      bg: { rgb: 'E3F2FD' },
      cl: { rgb: '000000' },
      fs: 12,
      bl: 1,
      bd: {
        t: { s: 1, cl: { rgb: 'BBDEFB' } },
        b: { s: 1, cl: { rgb: 'BBDEFB' } },
        l: { s: 1, cl: { rgb: 'BBDEFB' } },
        r: { s: 1, cl: { rgb: 'BBDEFB' } },
      },
    },
    [exampleStyleId]: {
      bg: { rgb: 'F5F5F5' },
      cl: { rgb: '000000' },
      fs: 12,
      bd: {
        t: { s: 1, cl: { rgb: 'E0E0E0' } },
        b: { s: 1, cl: { rgb: 'E0E0E0' } },
        l: { s: 1, cl: { rgb: 'E0E0E0' } },
        r: { s: 1, cl: { rgb: 'E0E0E0' } },
      },
    },
    [dataBorderStyleId]: {
      bd: {
        t: { s: 1, cl: { rgb: 'D0D0D0' } },
        b: { s: 1, cl: { rgb: 'D0D0D0' } },
        l: { s: 1, cl: { rgb: 'D0D0D0' } },
        r: { s: 1, cl: { rgb: 'D0D0D0' } },
      },
    },
  };
  return { headerStyleId, exampleStyleId, dataBorderStyleId, styles };
}

function cellValue(value: unknown): { v: string; m: string } {
  const text = value === null || value === undefined ? '' : String(value);
  return { v: text, m: text };
}

export function buildImportCellData(options: {
  headers?: string[];
  exampleRow?: string[];
  /** 若来自 xlsx，为完整行数据（含表头、示例行） */
  sheetRows?: unknown[][];
  minDataRows?: number;
}): {
  cellData: Record<string, Record<string, { v: unknown; m?: string; s?: string }>>;
  columnCount: number;
  rowCount: number;
  sheetStyles: ImportSheetStyles;
} {
  const sheetStyles = createImportSheetStyles();
  const { headerStyleId, exampleStyleId, dataBorderStyleId, styles } = sheetStyles;

  let rows: unknown[][] = [];
  if (options.sheetRows && options.sheetRows.length > 0) {
    rows = options.sheetRows.map(row =>
      Array.isArray(row) ? row.map(c => (c === null || c === undefined ? '' : c)) : [],
    );
  } else {
    const headers = options.headers ?? [];
    const exampleRow = options.exampleRow ?? [];
    const colCount = Math.max(headers.length, exampleRow.length, 1);
    const headerLine = headers.length
      ? headers
      : Array.from({ length: colCount }, () => '');
    rows.push(headerLine);
    if (exampleRow.length > 0) {
      const exampleLine = Array.from({ length: colCount }, (_, i) => exampleRow[i] ?? '');
      rows.push(exampleLine);
    }
  }

  const columnCount = Math.max(1, ...rows.map(r => r.length));
  const normalized = rows.map(row => {
    const line = Array.from({ length: columnCount }, (_, i) => row[i] ?? '');
    return line;
  });

  const minDataRows = options.minDataRows ?? 100;
  const rowCount = Math.max(minDataRows, normalized.length);

  const cellData: Record<string, Record<string, { v: unknown; m?: string; s?: string }>> = {};

  for (let r = 0; r < rowCount; r++) {
    const rowCells: Record<string, { v: unknown; m?: string; s?: string }> = {};
    for (let c = 0; c < columnCount; c++) {
      const raw = normalized[r]?.[c] ?? '';
      const { v, m } = cellValue(raw);
      let styleId = dataBorderStyleId;
      if (r === 0) styleId = headerStyleId;
      else if (r === 1 && normalized.length > 1) styleId = exampleStyleId;
      rowCells[c.toString()] = { v, m, s: styleId };
    }
    cellData[r.toString()] = rowCells;
  }

  return { cellData, columnCount, rowCount, sheetStyles: { ...sheetStyles, styles } };
}
