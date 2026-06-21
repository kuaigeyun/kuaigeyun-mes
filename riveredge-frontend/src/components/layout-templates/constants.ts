/**
 * 布局模板常量配置
 *
 * 统一管理页面布局的尺寸、间距、颜色等常量，遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import type { CSSProperties } from 'react';

/**
 * Modal 标准配置
 *
 * 新建/编辑类 FormModalTemplate 必须显式传 width，且仅使用以下常量：
 * - SMALL_WIDTH (600)：单栏表单（无 grid 或仅 span:24）
 * - STANDARD_WIDTH (800)：双栏表单（grid + colProps span:12 等）
 * - LARGE_WIDTH (1000)：复杂表单（多块 Row/Col、多步骤、大量字段）
 * - EXTRA_LARGE_WIDTH (1400)：宽表格预览、多列确认（如 MRP 结果预览）；小屏由 maxWidth 收窄
 */
export const MODAL_CONFIG = {
  /** 标准宽度（双栏） */
  STANDARD_WIDTH: 800,
  /** 大宽度（复杂表单） */
  LARGE_WIDTH: 1000,
  /** 超大宽度（宽表、多列表格确认） */
  EXTRA_LARGE_WIDTH: 1400,
  /** 小宽度（单栏） */
  SMALL_WIDTH: 600,
  /** 极小宽度（用于字段极少的表单） */
  TINY_WIDTH: 520,
  /** Modal body 限高：预留标题+底部+边距约 280px，避免整页出现滚动条 */
  BODY_MAX_HEIGHT: 'calc(100vh - 280px)',
} as const;

/**
 * Drawer 标准配置
 */
export const DRAWER_CONFIG = {
  /** 标准宽度 */
  STANDARD_WIDTH: 720,
  /** 大宽度（用于复杂详情） */
  LARGE_WIDTH: 1000,
  /** 小宽度（用于简单详情） */
  SMALL_WIDTH: 500,
  /** 50% 宽度（统一详情抽屉） */
  HALF_WIDTH: '50%',
  /**
   * 抽屉与视口边缘的外间距（悬浮卡片效果，与全链路等左侧浮层一致）
   */
  FLOAT_MARGIN: 16,
} as const;

/**
 * 与详情 Drawer（通常为 theme.zIndexPopupBase）、左侧全链路浮层（常见 base+1）、
 * 嵌套抽屉（常见 base+50）同屏时，业务 Modal 使用 theme.zIndexPopupBase + 本常量，
 * 以保证盖住上述层级。
 */
export const MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET = 100;

/** 已抬升的 Modal 之上的嵌套 Modal / Drawer（如表单内的批量选择器、敏捷核价抽屉） */
export const MODAL_NESTED_ABOVE_PARENT_OFFSET = 10;

/**
 * 全屏文件预览（PDF / STEP / DWG）：挂 body，须高于 BasicLayout 浮层(≈1200)、业务 Modal 抬升层。
 */
export const FILE_PREVIEW_OVERLAY_Z_INDEX = 2000;

/**
 * 表单布局配置
 */
export const FORM_LAYOUT = {
  /** 垂直布局（label 在上，input 在下） */
  VERTICAL: 'vertical',
  /** 水平布局（label 在左，input 在右） */
  HORIZONTAL: 'horizontal',
  /** 水平布局标签宽度（6列） */
  HORIZONTAL_LABEL_COL: 6,
  /** 水平布局输入框宽度（18列） */
  HORIZONTAL_WRAPPER_COL: 18,
  /** 网格布局列间距（16px） */
  GRID_GUTTER: 16,
  /** 表单项默认列宽（12列，即两栏布局） */
  DEFAULT_COL_SPAN: 12,
  /** 表单项全宽（24列） */
  FULL_COL_SPAN: 24,
  /** 表单项底部间距（与 Ant Design Form itemMarginBottom 一致） */
  ITEM_MARGIN_BOTTOM: 16,
  /** Modal 半宽表单项 class（CSS flex 固定 50%，不依赖 Ant Design Col grid） */
  MODAL_FIELD_HALF_CLASS: 'form-modal-field-half-width',
  /** Modal 全宽表单项 class */
  MODAL_FIELD_FULL_CLASS: 'form-modal-field-full-width',
  /** 绩效管理等业务 Modal 容器 class（启用半宽 flex 布局） */
  PERFORMANCE_FORM_MODAL_CLASS: 'performance-form-modal',
} as const;

/**
 * 统计卡片配置
 */
export const STAT_CARD_CONFIG = {
  /** 卡片间距（16px） */
  GUTTER: 16,
  /** 每行卡片数量（响应式） */
  COLUMNS: {
    xs: 1,
    sm: 2,
    md: 2,
    lg: 4,
    xl: 4,
    xxl: 4,
  },
  /** 卡片内边距 */
  PADDING: '16px',
} as const;

/**
 * 页面间距配置
 */
export const PAGE_SPACING = {
  /** 页面内边距 */
  PADDING: 16,
  /** 内容区上边距 */
  CONTENT_TOP: 16,
  /** 内容区下边距 */
  CONTENT_BOTTOM: 16,
  /** 区块间距 */
  BLOCK_GAP: 16,
} as const;

/**
 * 主内容区「自管留白」的推荐数值（px）：用于未走 UniTabs 水平 padding 的页面根、表单模板等。
 * ⚠️ 路由级 `PageSkeleton`（Spin 占位）不应再叠加本 inset：桌面端 `UniTabs` 已对子节点施加左右 16px（见 uni-tabs/index.tsx），
 * 占位外层若再 padding 16，肉眼会呈约 32px（双 16）并与真实页不一致。
 */
export const MAIN_CONTENT_VIEW_INSET_PX = {
  top: PAGE_SPACING.CONTENT_TOP,
  right: PAGE_SPACING.PADDING,
  bottom: PAGE_SPACING.CONTENT_BOTTOM,
  left: PAGE_SPACING.PADDING,
} as const;

/** 用于页面根容器等需自行承担四边留白的场景 */
export function mainContentViewInsetStyle(base?: CSSProperties): CSSProperties {
  const { top, right, bottom, left } = MAIN_CONTENT_VIEW_INSET_PX;
  return {
    boxSizing: 'border-box',
    paddingTop: top,
    paddingRight: right,
    paddingBottom: bottom,
    paddingLeft: left,
    ...base,
  };
}

/**
 * UniTabs 内普通页面根容器样式。
 * 四边 16px 均由 UniTabs 承担，页面勿再叠加 padding/margin：
 * - 顶部：`.uni-tabs-content { margin-top: 16px }`
 * - 左右：内层 wrapper `padding: 0 16px`
 * - 底部：内容区高度 calc 已扣减 16px，与顶栏/标签栏共同形成下边距
 */
export function uniTabsChildPageVerticalInsetStyle(base?: CSSProperties): CSSProperties {
  return {
    boxSizing: 'border-box',
    ...base,
  };
}

/** 单据详情页（UniTabs 内）页头行：标题 + 操作区 */
export const DOCUMENT_DETAIL_PAGE_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: PAGE_SPACING.BLOCK_GAP,
  marginBottom: PAGE_SPACING.BLOCK_GAP,
  flexWrap: 'wrap',
};

/** 独立新建/编辑页根容器：占满标签页高度，顶栏固定 + 内容滚动 */
export const DOCUMENT_FORM_PAGE_ROOT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
};

/** 独立新建/编辑页固定顶栏 */
export const DOCUMENT_FORM_PAGE_HEADER_STYLE: CSSProperties = {
  ...DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  flexShrink: 0,
  marginBottom: 0,
  paddingBottom: PAGE_SPACING.BLOCK_GAP,
  background: 'var(--ant-colorBgLayout)',
};

/** 独立新建/编辑页可滚动内容区（顶栏下间距见 global.less .document-form-page-body） */
export const DOCUMENT_FORM_PAGE_BODY_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

/** 单据详情页标题样式 */
export const DOCUMENT_DETAIL_PAGE_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  lineHeight: 1.4,
};

/**
 * 两栏布局配置
 */
export const TWO_COLUMN_LAYOUT = {
  /** 左侧面板默认宽度 */
  LEFT_PANEL_WIDTH: 300,
  /** 左侧面板最小宽度 */
  LEFT_PANEL_MIN_WIDTH: 200,
  /** 左侧面板最大宽度 */
  LEFT_PANEL_MAX_WIDTH: 400,
  /** 左/中栏顶部搜索区统一高度 */
  PANEL_HEADER_HEIGHT: 48,
  /** 两栏布局最小高度（确保初次渲染时容器有固定高度，避免表格一行一行加载） */
  MIN_HEIGHT: 500,
} as const;

/**
 * 画板页布局配置（审批流设计、BOM 设计等带画布的页面）
 */
export const CANVAS_PAGE_LAYOUT = {
  /** 左侧面板默认宽度（阶段/表单管理） */
  LEFT_PANEL_WIDTH: 280,
  /** 右侧面板默认宽度 */
  RIGHT_PANEL_WIDTH: 400,
  /** 画板最小高度 */
  CANVAS_MIN_HEIGHT: 600,
} as const;

/**
 * 全项目画板视觉基线（主流画板色 + 点状格栅 + 系统默认框线）
 */
export const CANVAS_VISUAL_BASE = {
  // 主流画板底色：明确与容器拉开层级（浅色更灰、深色更暗）
  BACKGROUND_COLOR:
    'color-mix(in srgb, var(--ant-color-bg-container, #ffffff) 70%, var(--ant-color-fill-secondary, #eef1f4) 30%)',
  // 点阵再提升一档对比，避免与容器/底色混在一起
  DOT_COLOR: 'color-mix(in srgb, var(--ant-color-text-tertiary, #94a3b8) 82%, transparent)',
  DOT_SIZE_PX: 1, // 统一点大小
  DOT_GAP_PX: 24, // 统一点间距
  BORDER_COLOR: 'var(--ant-color-border-secondary, #d9d9d9)', // 系统默认边框色（主题自适应）
  /** 跟随 BasicLayout 注入的 --ant-borderRadiusLG，与 Card / 按钮等容器圆角一致 */
  BORDER_RADIUS: 'var(--ant-borderRadiusLG, var(--ant-border-radius-lg, 8px))',
} as const;

export const CANVAS_GRID_STYLE: CSSProperties = {
  backgroundColor: CANVAS_VISUAL_BASE.BACKGROUND_COLOR,
  backgroundImage: `radial-gradient(circle, ${CANVAS_VISUAL_BASE.DOT_COLOR} ${CANVAS_VISUAL_BASE.DOT_SIZE_PX}px, transparent ${CANVAS_VISUAL_BASE.DOT_SIZE_PX}px)`,
  backgroundSize: `${CANVAS_VISUAL_BASE.DOT_GAP_PX}px ${CANVAS_VISUAL_BASE.DOT_GAP_PX}px`,
  border: `1px solid ${CANVAS_VISUAL_BASE.BORDER_COLOR}`,
  borderRadius: CANVAS_VISUAL_BASE.BORDER_RADIUS,
  boxSizing: 'border-box',
  overflow: 'hidden',
};

/** FlowGraph（G6 background 插件）点阵：与单据全链路追溯画板一致，较 CANVAS_GRID_STYLE 更密、圆点略细 */
export const CANVAS_FLOW_GRAPH_GRID_STYLE = {
  backgroundColor: CANVAS_VISUAL_BASE.BACKGROUND_COLOR,
  backgroundImage: `radial-gradient(circle, ${CANVAS_VISUAL_BASE.DOT_COLOR} 0.75px, transparent 0.75px)`,
  backgroundSize: '18px 18px',
} as const;

/**
 * ReactFlow Background 组件的等价参数（供 FlowEditor/FlowView 使用）
 */
export const CANVAS_GRID_REACTFLOW = {
  variant: 'dots' as const,
  gap: CANVAS_VISUAL_BASE.DOT_GAP_PX,
  size: CANVAS_VISUAL_BASE.DOT_SIZE_PX,
  color: CANVAS_VISUAL_BASE.DOT_COLOR,
  style: {
    backgroundColor: CANVAS_VISUAL_BASE.BACKGROUND_COLOR,
    border: `1px solid ${CANVAS_VISUAL_BASE.BORDER_COLOR}`,
    borderRadius: CANVAS_VISUAL_BASE.BORDER_RADIUS,
    boxSizing: 'border-box' as const,
    overflow: 'hidden' as const,
  },
} as const;

/**
 * 列表页（ListPageTemplate / MultiTabListPageTemplate）内 ProTable 表体 `scroll.y` 的视口扣减。
 * 用于 `calc(100vh - Npx)`：区分是否有指标卡行（与 ListPageTemplate 展示条件一致）、是否多 Tab 模板（额外套一层 Card.Tab）。
 * 是否注入 scroll.y 由 `components/uni-table/uniTableScrollPolicy.ts` 决策；此处仅负责限高表达式中的 N。
 * 数值为经验值，可按全局顶栏/页签高度微调 `BASE_OFFSET_PX`。
 */
export const LIST_PAGE_TABLE_SCROLL = {
  /**
   * 标准列表基础扣减（不含指标卡、不含多Tab）：
   * - ProLayout 顶栏 56
   * - UniTabs 标签栏 56
   * - 内容区固定留白与 UniTable 头部/分页占位（其余固定项）
   */
  HEADER_HEIGHT_PX: 56,
  TABS_HEIGHT_PX: 56,
  /** 常规垂直间距单位（与页面/模板 gutter 一致） */
  GAP_PX: 16,
  /** 标准列表页（无指标卡）固定垂直间距数量（单位：GAP_PX） */
  GAP_COUNT_BASE: 8,
  /** UniTable 固定占位聚合（搜索行/标题行/分页行等，px） */
  TABLE_CHROME_PX: 82,
  /** 顶栏 + 标签 + 间距(7*16) + 表格固定位 */
  BASE_OFFSET_PX: 56 + 56 + (9 * 16) + 82, // = 312
  /** 桌面端展示 ListPageTemplate 指标卡行时追加（一行 Card + marginBottom 16） */
  STAT_CARDS_ROW_EXTRA_PX: 120,
  /** MultiTabListPageTemplate 相对标准列表：Ant Design Card 的 Tab 栏及结构增量 */
  MULTI_TAB_CARD_EXTRA_PX: 78,
  /** UniReport 报表标题区（UniReportMetaHeader：标题 + 副标题 + margin，约 66px） */
  REPORT_META_HEADER_EXTRA_PX: 70,
  /** UniTable 无模板变量时使用的默认回退（312 + 136） */
  DEFAULT_FALLBACK_OFFSET_PX: 448,
} as const;

export type ListPageTableScrollLayout = 'list' | 'multiTab' | 'report';

export interface ListPageTableBodyScrollYOptions {
  layout?: ListPageTableScrollLayout;
  /** 是否与 ListPageTemplate 一致实际渲染了指标卡行（有 statCards 且非其移动端隐藏条件） */
  hasStatCardsRow: boolean;
}

/** 计算列表页表体滚动 offset（px） */
export function getListPageTableScrollOffsetPx(options: ListPageTableBodyScrollYOptions): number {
  const layout = options.layout ?? 'list';
  let sub = LIST_PAGE_TABLE_SCROLL.BASE_OFFSET_PX;
  if (options.hasStatCardsRow) {
    sub += LIST_PAGE_TABLE_SCROLL.STAT_CARDS_ROW_EXTRA_PX;
  }
  if (layout === 'multiTab') {
    sub += LIST_PAGE_TABLE_SCROLL.MULTI_TAB_CARD_EXTRA_PX;
  }
  if (layout === 'report') {
    sub += LIST_PAGE_TABLE_SCROLL.REPORT_META_HEADER_EXTRA_PX;
  }
  return sub;
}

/** 生成 antd Table `scroll.y` 可用的 CSS 长度表达式 */
export function getListPageTableBodyScrollYExpr(options: ListPageTableBodyScrollYOptions): string {
  return `calc(100vh - ${getListPageTableScrollOffsetPx(options)}px)`;
}

/**
 * 与 `ListPageTemplate` 中 `statCardsRow` 是否渲染保持一致：
 * `statCards?.length > 0 && !isMobile`，其中 `isMobile = !screens.md && screens.xs`。
 */
export function listPageShowsStatCardsRow(
  statCards: readonly unknown[] | undefined,
  screens: Partial<Record<'xs' | 'md', boolean>>,
): boolean {
  if (!statCards || statCards.length === 0) return false;
  const isMobile = !screens.md && !!screens.xs;
  return !isMobile;
}

/**
 * 系统页视口扣减常量（用于替换分散在页面里的 `calc(100vh - Npx)` 硬编码）。
 * 约束：页面只引用命名常量，不再在业务页手写裸数字。
 */
export const SYSTEM_VIEWPORT_OFFSETS = {
  BUSINESS_BOARD_PX: 100,
  PRINT_TEMPLATE_DESIGN_PX: 48,
  FILE_PREVIEW_MODAL_PX: 200,
  LANG_TRANSLATION_DRAWER_BODY_BASE_PX: 110,
  LANG_TRANSLATION_TABLE_BASE_PX: 220,
  CANVAS_PAGE_MIN_HEIGHT_PX: 132,
  BOM_DESIGNER_PX: 110,
  TECH_STACK_MODAL_PX: 180,
  UNIVER_IMPORT_FULLSCREEN_BODY_PX: 130,
  UNIVER_IMPORT_FULLSCREEN_CONTAINER_PX: 162,
} as const;

/**
 * 统一生成视口高度表达式；可选补偿 UniTabs 全屏时顶栏扣减（仅回补 header 56）。
 */
export function getViewportHeightExpr(
  offsetPx: number,
  options?: { compensateHeaderInFullscreen?: boolean },
): string {
  if (options?.compensateHeaderInFullscreen) {
    return `calc(100vh - ${offsetPx}px + (${LIST_PAGE_TABLE_SCROLL.HEADER_HEIGHT_PX}px - var(--header-height, ${LIST_PAGE_TABLE_SCROLL.HEADER_HEIGHT_PX}px)))`;
  }
  return `calc(100vh - ${offsetPx}px)`;
}

/**
 * 表格配置
 */
export const TABLE_CONFIG = {
  /** 默认分页大小 */
  DEFAULT_PAGE_SIZE: 20,
  /** 分页大小选项 */
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
  /** 操作列宽度 */
  ACTION_COLUMN_WIDTH: 150,
  /** 固定列宽度 */
  FIXED_COLUMN_WIDTH: 120,
} as const;

/**
 * 按钮配置
 */
export const BUTTON_CONFIG = {
  /** 按钮间距 */
  GAP: 8,
  /** 按钮组间距 */
  GROUP_GAP: 16,
} as const;

/**
 * 状态标签颜色映射
 */
export const STATUS_COLORS = {
  /** 成功状态 */
  SUCCESS: 'success',
  /** 处理中状态 */
  PROCESSING: 'processing',
  /** 错误状态 */
  ERROR: 'error',
  /** 警告状态 */
  WARNING: 'warning',
  /** 默认状态 */
  DEFAULT: 'default',
} as const;

/**
 * 操作类型
 */
export const ACTION_TYPES = {
  /** 新建 */
  CREATE: 'create',
  /** 编辑 */
  EDIT: 'edit',
  /** 删除 */
  DELETE: 'delete',
  /** 详情 */
  DETAIL: 'detail',
  /** 导入 */
  IMPORT: 'import',
  /** 导出 */
  EXPORT: 'export',
} as const;

/**
 * Ant Design 设计规范常量
 * 基于 Ant Design 设计语言，确保视觉统一
 */
export const ANT_DESIGN_TOKENS = {
  /** 基础间距单位（8px网格系统） */
  BASE_UNIT: 8,
  /** 间距值 */
  SPACING: {
    XS: 4,   // 4px
    SM: 8,   // 8px
    MD: 16,  // 16px
    LG: 24,  // 24px
    XL: 32,  // 32px
    XXL: 48, // 48px
  },
  /** 圆角 */
  BORDER_RADIUS: {
    SM: 4,   // 4px
    BASE: 6, // 6px
    LG: 8,   // 8px
  },
  /** 阴影 */
  BOX_SHADOW: {
    BASE: '0 2px 8px rgba(0, 0, 0, 0.15)',
    SECONDARY: '0 2px 4px rgba(0, 0, 0, 0.12)',
  },
  /** 字体大小 */
  FONT_SIZE: {
    XS: 12,
    SM: 13,
    BASE: 14,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
    XXXL: 30,
    HUGE: 38,
  },
  /** 行高 */
  LINE_HEIGHT: {
    TIGHT: 1.2,
    NORMAL: 1.5,
    RELAXED: 1.75,
  },
} as const;

/** 触屏终端设计 Token（与主站共用 antd，见 src/theme/hmi） */
export {
  HMI_DESIGN_TOKENS,
  HMI_LAYOUT,
  HMI_ANTD_TOKEN_OVERRIDE,
  TOUCH_SCREEN_CONFIG,
  HMI_TOUCH,
  HMI_STATION_LAYOUT,
  HMI_SAFE_INSET,
  createHmiTheme,
} from '../../theme/hmi';

/**
 * 工作台配置
 */
export const DASHBOARD_CONFIG = {
  /** 快捷操作卡片列数（响应式） */
  QUICK_ACTION_COLUMNS: {
    xs: 2,
    sm: 2,
    md: 4,
    lg: 4,
    xl: 4,
    xxl: 4,
  },
  /** 待办事项卡片列数（响应式） */
  TODO_COLUMNS: {
    xs: 1,
    sm: 1,
    md: 2,
    lg: 2,
    xl: 2,
    xxl: 2,
  },
  /** 数据看板卡片列数（响应式） */
  STAT_COLUMNS: {
    xs: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 3,
    xxl: 3,
  },
} as const;

