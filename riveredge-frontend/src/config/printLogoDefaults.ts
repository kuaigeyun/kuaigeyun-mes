/** 打印模板中公司 LOGO 的 Jinja 变量（与 print_service 注入字段一致） */
export const COMPANY_LOGO_TEMPLATE_URL = '{{ company_logo }}';

const COMPANY_LOGO_URL_PATTERN = /\{\{\s*(logo|company_logo)\s*\}\}/i;

/** 空 url 或 logo 变量均视为公司 LOGO 占位 */
export function isCompanyLogoTemplateUrl(url: string | undefined): boolean {
  const value = (url || '').trim();
  return !value || COMPANY_LOGO_URL_PATTERN.test(value);
}

export function createCompanyLogoImageBlockFields(
  overrides?: Partial<{
    width: number;
    height: number;
    keepRatio: boolean;
    style: { textAlign?: string };
  }>,
) {
  return {
    type: 'image' as const,
    url: COMPANY_LOGO_TEMPLATE_URL,
    width: 100,
    height: 60,
    keepRatio: true,
    style: { textAlign: 'center' as const },
    ...overrides,
  };
}

type DesignerBlockLike = {
  id?: string;
  type?: string;
  url?: string;
  cols?: Array<{ blocks?: DesignerBlockLike[] }>;
};

/** 打开旧模板时，将拖拽插入的空 url 公司 LOGO 块补全为变量绑定 */
export function normalizeDesignerLogoImageBlocks<T extends DesignerBlockLike>(blocks: T[]): T[] {
  const walk = (items: T[]): T[] =>
    items.map((blk) => {
      if (blk?.type === 'image') {
        const id = String(blk.id || '');
        if ((!String(blk.url || '').trim() || id.startsWith('logo-')) && isCompanyLogoTemplateUrl(blk.url)) {
          return { ...blk, url: COMPANY_LOGO_TEMPLATE_URL };
        }
      }
      if (blk?.type === 'columns' && Array.isArray(blk.cols)) {
        return {
          ...blk,
          cols: blk.cols.map((col) => ({
            ...col,
            blocks: walk((col.blocks || []) as T[]),
          })),
        };
      }
      return blk;
    });
  return walk(blocks);
}
