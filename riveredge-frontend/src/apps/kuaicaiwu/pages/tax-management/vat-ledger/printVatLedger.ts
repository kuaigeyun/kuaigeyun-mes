/** 打印应交增值税台账（独立预览区域，非整页 window.print） */
export function printVatLedgerNode(node: HTMLElement): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><title>应交增值税台账</title>
    <style>body{margin:0;padding:16px;font-family:SimSun,serif;}</style></head>
    <body>${node.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}
