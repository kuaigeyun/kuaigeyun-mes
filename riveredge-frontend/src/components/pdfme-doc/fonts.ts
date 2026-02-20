/**
 * pdfme 字体配置
 *
 * 默认 Roboto 不包含中文字形，中文会显示为方块（Tofu）。
 * 注册思源黑体(Noto Sans SC)为主字体，思源宋体(Noto Serif SC)为备选，支持中英文混排。
 *
 * @see https://pdfme.com/docs/custom-fonts
 */
import type { Font } from '@pdfme/common';

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** 思源黑体 - 主中文字体 */
const FONT_SANS_URL = `${BASE}fonts/NotoSansSC-Regular.ttf`;
/** 思源宋体 - 备选中文字体 */
const FONT_SERIF_URL = `${BASE}fonts/SourceHanSerifCN-Regular.otf`;

/**
 * 加载字体配置（高性能 URL 模式）
 */
export async function getPdfmeChineseFont(): Promise<Font> {
  const origin = window.location.origin;
  const sansUrl = `${origin}${FONT_SANS_URL}`;
  const serifUrl = `${origin}${FONT_SERIF_URL}`;

  try {
    const [sansOk, serifOk] = await Promise.all([
      fetch(sansUrl, { method: 'HEAD' }).then((r) => r.ok),
      fetch(serifUrl, { method: 'HEAD' }).then((r) => r.ok),
    ]);
    if (!sansOk || !serifOk) throw new Error('Font status error');
  } catch (e) {
    console.warn('[pdfme] Font URL test failed.');
  }

  return {
    NotoSansSC: { data: sansUrl, fallback: true, subset: false },
    NotoSerifSC: { data: serifUrl, subset: false },
    Roboto: { data: sansUrl, subset: false },
  };
}

/** 同步字体配置占位（仅 NotoSansSC 为 fallback，pdfme 要求 fallback 唯一） */
export const PDFME_CHINESE_FONT: Font = {
  NotoSansSC: { data: '', fallback: true, subset: false },
  NotoSerifSC: { data: '', subset: false },
  Roboto: { data: '', subset: false },
};
