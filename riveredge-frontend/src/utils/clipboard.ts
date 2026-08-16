/**
 * 剪贴板写入唯一路径：优先 Clipboard API，不可用时走 execCommand 回退。
 * 禁止页面直接 navigator.clipboard.writeText（HTTP / 部分 WebView 下 clipboard 为 undefined）。
 */

export async function copyTextToClipboard(text: string): Promise<void> {
  const value = String(text ?? '');
  if (!value) {
    throw new Error('empty_clipboard_text');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('clipboard_unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  if (!ok) {
    throw new Error('clipboard_copy_failed');
  }
}
