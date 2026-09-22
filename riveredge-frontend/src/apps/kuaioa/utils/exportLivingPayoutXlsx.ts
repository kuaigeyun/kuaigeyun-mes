import ExcelJS from 'exceljs';

export type LivingPayoutExportRow = {
  bank_name?: string | null;
  employee_name?: string | null;
  bank_account?: string | null;
  base_living?: number | string | null;
  advance_amount?: number | string | null;
  payout_amount?: number | string | null;
  workshop_name?: string | null;
};

function money(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

/** 按银行分块导出生活费发放登记表（对齐 Excel「生活费发放」结构）。 */
export async function exportLivingPayoutXlsx(
  rows: LivingPayoutExportRow[],
  options: {
    yearMonth: string;
    title: string;
    unitLabel: string;
    headers: {
      bank: string;
      seq: string;
      name: string;
      account: string;
      fixed: string;
      advance: string;
      payout: string;
      sign: string;
      workshop: string;
    };
    totalLabel: string;
    fileName: string;
  },
): Promise<void> {
  if (!rows.length) {
    throw new Error('没有可导出的数据');
  }

  const groups = new Map<string, LivingPayoutExportRow[]>();
  for (const row of rows) {
    const bank = String(row.bank_name ?? '');
    const list = groups.get(bank) || [];
    list.push(row);
    groups.set(bank, list);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('生活费发放', {
    views: [{ showGridLines: true }],
  });

  const h = options.headers;
  let r = 1;
  for (const [bank, list] of groups) {
    ws.mergeCells(r, 1, r, 9);
    ws.getCell(r, 1).value = options.title;
    ws.getCell(r, 1).font = { bold: true, size: 14 };
    ws.getCell(r, 1).alignment = { horizontal: 'center' };
    r += 1;
    ws.getCell(r, 8).value = options.unitLabel;
    r += 1;

    const headerRow = [h.bank, h.seq, h.name, h.account, h.fixed, h.advance, h.payout, h.sign, h.workshop];
    headerRow.forEach((title, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = title;
      cell.font = { bold: true };
    });
    r += 1;

    const bodyStart = r;
    list.forEach((row, idx) => {
      const fixed = money(row.base_living);
      const advance = money(row.advance_amount);
      const payout = money(row.payout_amount) || fixed + advance;
      ws.getCell(r, 1).value = bank;
      ws.getCell(r, 2).value = idx + 1;
      ws.getCell(r, 3).value = String(row.employee_name || '');
      ws.getCell(r, 4).value = String(row.bank_account || '');
      ws.getCell(r, 5).value = fixed;
      ws.getCell(r, 6).value = advance;
      ws.getCell(r, 7).value = payout;
      ws.getCell(r, 8).value = '';
      ws.getCell(r, 9).value = String(row.workshop_name || '');
      r += 1;
    });
    const bodyEnd = r - 1;
    ws.getCell(r, 1).value = options.totalLabel;
    ws.getCell(r, 7).value = { formula: `SUM(G${bodyStart}:G${bodyEnd})` };
    r += 2;
  }

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 12;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 14;

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
