/**
 * pdfme 字体配置
 *
 * 默认 Roboto 不包含中文字形，中文会显示为方块（Tofu）。
 * 注册 Noto Sans SC 及其别名，支持中英文混排。
 *
 * @see https://pdfme.com/docs/custom-fonts
 */
import type { Font } from '@pdfme/common';

/** 
 * 字体 URL (从 static 目录提供)
 * 已替换为完整的 Noto Sans SC (10MB+)，解决之前 72KB subset 导致的缺字方块问题。
 */
const FONT_URL = '/fonts/NotoSansSC-Regular.ttf';

/** 
 * 加载字体配置（高性能 URL 模式）
 * 警告：不再向 pdfme 传递 11MB 的 Uint8Array，
 * 而是直接传递 URL 路径，以彻底消除 UI 操作时的克隆延迟。
 */
export async function getPdfmeChineseFont(): Promise<Font> {
  const url = `${window.location.origin}${FONT_URL}`;
  
  // 验证字体文件是否确实可访问
  try {
    const check = await fetch(url, { method: 'HEAD' });
    if (!check.ok) throw new Error('Font status error');
  } catch (e) {
    console.warn('[pdfme] Font URL test failed, jumping to standby.');
  }

  // 直接返回包含 URL 的对象，极大地减轻 JS 引擎负担
  const font: Font = {
    NotoSansSC: { data: url, fallback: true, subset: false },
    // 确保默认字体也指向这个快速路径
    Roboto: { data: url, subset: false },
  };
  
  return font;
}

/** 同步字体配置占位 */
export const PDFME_CHINESE_FONT: Font = {
  NotoSansSC: { data: '', fallback: true, subset: false },
  Roboto: { data: '', subset: false },
};
