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
  /** 两栏布局最小高度（确保初次渲染时容器有固定高度，避免表格一行一行加载） */
  MIN_HEIGHT: 500,
} as const;

/**
 * 画板页布局配置（审批流设计、BOM 设计等带画布的页面）
 */
export const CANVAS_PAGE_LAYOUT = {
  /** 右侧面板默认宽度 */
  RIGHT_PANEL_WIDTH: 400,
  /** 画板最小高度 */
  CANVAS_MIN_HEIGHT: 600,
} as const;

/**
 * 画板网格样式（浅色主题，流程图/BOM/SOP 等设计器统一使用）
 */
export const CANVAS_GRID_STYLE: CSSProperties = {
  backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
  backgroundSize: '12px 12px',
};

/**
 * ReactFlow Background 组件的等价参数（供 FlowEditor/FlowView 使用）
 */
export const CANVAS_GRID_REACTFLOW = {
  variant: 'dots' as const,
  gap: 12,
  size: 1,
  color: '#e0e0e0',
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
 * 工业 HMI 设计规范常量（ISA-101 风格）
 * 用于生产终端、触屏工位：高对比、大触控、统一状态色
 */
export const HMI_DESIGN_TOKENS = {
  /** 状态色：正常/完成 */
  STATUS_OK: '#00C853',
  /** 状态色：警告/进行中 */
  STATUS_WARNING: '#FFB300',
  /** 状态色：异常/停止/错误 */
  STATUS_ALARM: '#D32F2F',
  /** 状态色：信息/中性/默认 */
  STATUS_INFO: '#1677ff',
  /** 最小触控区域（px） */
  TOUCH_MIN_SIZE: 48,
  /** 正文最小字号（px） */
  FONT_BODY_MIN: 20,
  /** 标题最小字号（px） */
  FONT_TITLE_MIN: 28,
  /** 卡片标题字号（工单列表/工单操作/文档/最近操作记录 统一） */
  FONT_CARD_HEADER: 20,
  /** 卡片标题图标尺寸（px） */
  CARD_HEADER_ICON_SIZE: 18,
  /** 数字/指标主字号（px），与正文统一字体 */
  FONT_FIGURE: 26,
  /** HMI 统一字体（整站继承） */
  FONT_FAMILY: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  /** 深色主题：主背景（蓝黑底） */
  BG_PRIMARY: '#000814',
  /** 深色主题：卡片/面板背景 */
  BG_CARD: 'rgba(255, 255, 255, 0.05)',
  /** 深色主题：悬浮/强调背景 */
  BG_ELEVATED: 'rgba(255, 255, 255, 0.08)',
  /** 顶栏内浮起元素背景（工位面包屑、全屏/刷新/切换工位），与顶栏深蓝区分 */
  HEADER_FLOATING_BG: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
  /** 深色主题：边框 */
  BORDER: 'rgba(255, 255, 255, 0.15)',
  /** 深色主题：正文 */
  TEXT_PRIMARY: '#ffffff',
  /** 深色主题：次要文字 */
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.65)',
  /** 深色主题：占位/弱化 */
  TEXT_TERTIARY: 'rgba(255, 255, 255, 0.45)',
  /** HMI 圆角容器：圆角半径（px） */
  CONTAINER_RADIUS: 8,
  /** HMI 圆角容器：边框 */
  CONTAINER_BORDER: '1px solid rgba(255, 255, 255, 0.08)',
  /** HMI 圆角容器：外阴影 */
  CONTAINER_SHADOW: '0 2px 12px rgba(0, 0, 0, 0.25)',
  /** 统一圆角（px） */
  PANEL_RADIUS: 8,
  /** 区块间距（px） */
  SECTION_GAP: 24,
  /** 三栏容器统一内边距（工单列表/工单操作/文档/最近操作记录） */
  PANEL_PADDING: 24,
  /** 工单列表卡片内边距（px） */
  LIST_CARD_PADDING: 12,
  /** 工单列表卡片间距（px） */
  LIST_CARD_GAP: 6,
  /** 工单列表卡片默认背景 */
  LIST_CARD_BG: 'rgba(255, 255, 255, 0.04)',
  /** 工单列表选中卡片背景（淡绿） */
  LIST_CARD_SELECTED_BG: 'rgba(0, 200, 83, 0.15)',
  /** 工单状态徽章配色：{ bg, color }，保证文字与背景有足够对比 */
  STATUS_BADGE: {
    draft: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' },
    released: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    pending: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    in_progress: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    processing: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    completed: { bg: 'rgba(0,200,83,0.35)', color: '#95de64' },
    cancelled: { bg: 'rgba(211,47,47,0.35)', color: '#ff7875' },
    default: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' },
  } as const,
  /** 按钮间距（px） */
  BUTTON_GAP: 20,
  /** 主按钮水平内边距（px） */
  BUTTON_PADDING_PRIMARY: 28,
  /** 次要按钮水平内边距（px） */
  BUTTON_PADDING_SECONDARY: 24,
  /** 主界面背景渐变（蓝黑/深蓝） */
  BG_GRADIENT_MAIN: 'linear-gradient(180deg, #0f2847 0%, #0a1f3c 40%, #061428 70%, #000814 100%)',
  /** 左栏侧栏背景渐变 */
  BG_GRADIENT_SIDEBAR: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
  /** 主内容面板外发光 */
  PANEL_GLOW: '0 0 40px rgba(22,119,255,0.06), 0 4px 24px rgba(0,0,0,0.2)',
  /** 毛玻璃背景色（配合 backdrop-filter: blur(12px)） */
  PANEL_FROSTED: 'rgba(0,8,20,0.75)',
  /** 指标卡/内容卡阴影 */
  CARD_SHADOW: '0 4px 16px rgba(0,0,0,0.2)',
  /** 主按钮阴影（蓝色系） */
  BTN_PRIMARY_SHADOW: '0 4px 14px rgba(22,119,255,0.35)',
  /** 完成/报工按钮阴影（绿色系） */
  BTN_SUCCESS_SHADOW: '0 4px 14px rgba(0,200,83,0.3)',
} as const;

/**
 * 生产终端 HMI 固定布局尺寸（ISA-101 风格）
 */
export const HMI_LAYOUT = {
  /** 顶部状态栏高度 */
  HEADER_HEIGHT: 64,
  /** 指标条高度 */
  METRICS_HEIGHT: 80,
  /** 左侧面板固定宽度 */
  LEFT_PANEL_WIDTH: 320,
  /** 右侧面板固定宽度 */
  RIGHT_PANEL_WIDTH: 360,
  /** 底部操作栏高度（可选） */
  FOOTER_HEIGHT: 72,
} as const;

/**
 * HMI 生产终端 Ant Design Token 覆盖
 * 供 ConfigProvider 使用，与全局主题语义一致
 */
export const HMI_ANTD_TOKEN_OVERRIDE = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorBgLayout: '#000814',
  colorBgContainer: 'rgba(255, 255, 255, 0.05)',
  colorBorder: 'rgba(255, 255, 255, 0.15)',
  colorText: '#ffffff',
  colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
  colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
  borderRadius: 8,
  fontSize: 14,
  fontSizeLG: 16,
  fontSizeXL: 20,
  fontSizeHeading1: 38,
  fontSizeHeading2: 30,
  fontSizeHeading3: 24,
} as const;

/**
 * 工位机触屏模式配置
 */
export const TOUCH_SCREEN_CONFIG = {
  /** 触控最小区域（px），符合工业 HMI 规范 */
  TOUCH_MIN_SIZE: 48,
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

