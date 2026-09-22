import ExcelJS from 'exceljs';

export type WelfareExportLine = {
  employee_name?: string | null;
  amount?: number | string | null;
};

/** 双栏「序号/姓名/金额/领取签字」福利发放登记表，对齐 Excel 模板。 */
export async function exportWelfareRegisterXlsx(
  lines: WelfareExportLine[],
  options: {
    title: string;
    departmentLabel: string;
    headers: { seq: string; name: string; amount: string; sign: string };
    fileName: string;
  },
): Promise<void> {
  if (!lines.length) throw new Error('没有可导出的数据');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('福利发放');
  ws.mergeCells(1, 1, 1, 8);
  ws.getCell(1, 1).value = options.title;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, 8);
  ws.getCell(2, 1).value = options.departmentLabel;

  const h = options.headers;
  const header = [h.seq, h.name, h.amount, h.sign, h.seq, h.name, h.amount, h.sign];
  header.forEach((title, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = title;
    cell.font = { bold: true };
  });

  const half = Math.ceil(lines.length / 2);
  const left = lines.slice(0, half);
  const right = lines.slice(half);
  const rowCount = Math.max(left.length, right.length);
  for (let i = 0; i < rowCount; i += 1) {
    const r = 5 + i;
    const L = left[i];
    const R = right[i];
    if (L) {
      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = String(L.employee_name || '');
      ws.getCell(r, 3).value = Number(L.amount || 0);
      ws.getCell(r, 4).value = '';
    }
    if (R) {
      ws.getCell(r, 5).value = half + i + 1;
      ws.getCell(r, 6).value = String(R.employee_name || '');
      ws.getCell(r, 7).value = Number(R.amount || 0);
      ws.getCell(r, 8).value = '';
    }
  }

  const totalRow = 5 + rowCount;
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  ws.getCell(totalRow, 1).value = '合计：';
  ws.getCell(totalRow, 3).value = total;

  [8, 12, 10, 12, 8, 12, 10, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
