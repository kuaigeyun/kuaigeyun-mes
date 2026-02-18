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
/** 
 * 极速版字体 URL
 * 使用 .woff 格式以换取极致的交互响应速度
 */
const FONT_URL = '/fonts/noto-serif-sc-22-400-normal.woff';

let fontPromise: Promise<Font> | null = null;

/** 异步加载字体，供 pdfme 使用（单例缓存） */
export async function getPdfmeChineseFont(): Promise<Font> {
  if (fontPromise) return fontPromise;
  
  fontPromise = (async () => {
    // 优先尝试从本地域名加载，确保路径可靠性
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}${FONT_URL}` 
      : FONT_URL;
      
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // 后备：尝试从 src 内部目录相对路径（处理某些构建环境差异）
        const fallbackUrl = '/src/components/pdfme-doc/fonts/noto-serif-sc-22-400-normal.woff';
        const res2 = await fetch(fallbackUrl);
        if (!res2.ok) throw new Error('字体文件均无法加载');
        return await createFontConfig(res2);
      }
      return await createFontConfig(res);
    } catch (e) {
      console.error('[pdfme] Font loading error:', e);
      throw e;
    }
  })();
  
  return fontPromise;
}

async function createFontConfig(res: Response): Promise<Font> {
  const ab = await res.arrayBuffer();
  const data = new Uint8Array(ab);
  return {
    NotoSansSC: { data, fallback: true, subset: false },
  };
}

/**
 * 同步字体配置 (保留类型定义)
 */
export const PDFME_CHINESE_FONT: Font = {
  NotoSansSC: { data: new Uint8Array(), fallback: true, subset: false },
};
