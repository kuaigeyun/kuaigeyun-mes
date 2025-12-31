/**
 * 布局模板常量配置
 *
 * 统一管理页面布局的尺寸、间距、颜色等常量，遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

/**
 * Modal 标准配置
 */
export const MODAL_CONFIG = {
  /** 标准宽度 */
  STANDARD_WIDTH: 800,
  /** 大宽度（用于复杂表单） */
  LARGE_WIDTH: 1000,
  /** 小宽度（用于简单表单） */
  SMALL_WIDTH: 600,
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
} as const;

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
  BLOCK_GAP: 24,
} as const;

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
} as const;

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

/**
 * 工位机触屏模式配置
 */
export const TOUCH_SCREEN_CONFIG = {
  /** 按钮最小高度 */
  BUTTON_MIN_HEIGHT: 60,
  /** 字体最小大小 */
  FONT_MIN_SIZE: 24,
  /** 标题字体大小 */
  TITLE_FONT_SIZE: 32,
  /** 元素最小间距 */
  ELEMENT_MIN_GAP: 20,
  /** 数字键盘按钮大小 */
  KEYBOARD_BUTTON_SIZE: 60,
} as const;

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

