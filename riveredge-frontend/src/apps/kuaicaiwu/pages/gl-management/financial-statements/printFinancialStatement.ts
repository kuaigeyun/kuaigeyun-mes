/** 将法定报表预览节点送入独立 iframe 打印，避免带出查询栏。 */

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Songti SC', 'SimSun', 'Noto Serif SC', serif; color: #111; }
  .fs-print-sheet { font-family: inherit; color: #111; background: #fff; }
  .fs-print-title { margin: 0 0 12px; text-align: center; font-size: 22px; font-weight: 700; letter-spacing: 0.2em; }
  .fs-print-meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; font-size: 12px; }
  .fs-print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .fs-print-table th, .fs-print-table td { border: 1px solid #111; padding: 5px 8px; vertical-align: middle; }
  .fs-print-table th { text-align: center; font-weight: 700; }
  .fs-print-table .col-line { text-align: center; width: 8%; }
  .fs-print-table .col-amt { text-align: right; width: 14%; }
  .fs-print-table .is-header td, .fs-print-table td.is-header,
  .fs-print-table .is-total td, .fs-print-table td.is-total { font-weight: 700; }
  .fs-print-sign { display: flex; justify-content: space-between; margin-top: 28px; font-size: 12px; }
  .fs-print-time { margin-top: 10px; text-align: right; font-size: 11px; }
`;

export function printFinancialStatementNode(node: HTMLElement | null, title: string): void {
  if (!node) return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${PRINT_STYLES}</style></head><body>${node.innerHTML}</body></html>`,
  );
  doc.close();
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  const cleanup = () => iframe.remove();
  win.addEventListener('afterprint', cleanup);
  win.focus();
  win.print();
}
