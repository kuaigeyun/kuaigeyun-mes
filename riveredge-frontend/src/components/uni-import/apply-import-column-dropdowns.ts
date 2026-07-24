/**
 * 为导入表中带选项的列设置 Univer Data Validation 下拉（含示例行与数据区，不含表头）。
 */

type ImportSheetLike = {
  getRange?: (
    row: number,
    column: number,
    numRows: number,
    numColumns: number,
  ) => { setDataValidation?: (rule: unknown) => void } | null;
};

type ImportUniverApiLike = {
  getActiveWorkbook?: () => {
    getActiveSheet?: () => ImportSheetLike | null;
    getSheetBySheetId?: (sheetId: string) => ImportSheetLike | null;
  } | null;
  newDataValidation?: () => {
    requireValueInList: (
      values: string[],
      multiple?: boolean,
      showDropdown?: boolean,
    ) => {
      setOptions: (options: {
        allowBlank?: boolean;
        /** 关闭后粘贴 true/1 等别名不会被标红拦截；确认导入仍由业务 parse 接受 */
        showErrorMessage?: boolean;
      }) => { build: () => unknown };
    };
  };
};

function resolveImportSheet(
  univerAPI: ImportUniverApiLike,
  sheet?: ImportSheetLike | null,
): ImportSheetLike | null {
  if (sheet?.getRange) return sheet;
  const workbook = univerAPI.getActiveWorkbook?.();
  if (!workbook) return null;
  return workbook.getSheetBySheetId?.('sheet-1') ?? workbook.getActiveSheet?.() ?? null;
}

export function applyImportColumnDropdowns(
  univerAPI: ImportUniverApiLike,
  columnOptions: Array<string[] | undefined | null> | undefined,
  rowCount: number,
  sheet?: ImportSheetLike | null,
): void {
  try {
    if (!columnOptions?.length || rowCount < 2) return;
    if (typeof univerAPI.newDataValidation !== 'function') return;

    const targetSheet = resolveImportSheet(univerAPI, sheet);
    if (!targetSheet?.getRange) return;

    // 从示例行（row=1）到表尾；Facade getRange(row, col, numRows, numColumns)
    const numRows = rowCount - 1;
    if (numRows < 1) return;

    columnOptions.forEach((opts, colIndex) => {
      if (!opts?.length) return;
      const values = opts.map((v) => String(v ?? '').trim()).filter(Boolean);
      if (!values.length) return;

      try {
        const rule = univerAPI
          .newDataValidation!()
          .requireValueInList(values, false, true)
          .setOptions({ allowBlank: true, showErrorMessage: false })
          .build();
        targetSheet.getRange!(1, colIndex, numRows, 1)?.setDataValidation?.(rule);
      } catch (error) {
        console.warn('apply import column dropdown failed:', colIndex, error);
      }
    });
  } catch (error) {
    console.warn('apply import column dropdowns failed:', error);
  }
}
