/**
 * 布局模板组件导出
 *
 * 提供统一的页面布局模板，遵循 Ant Design 设计规范
 * 主要用于主内容区（PageContainer）的布局
 *
 * 包含以下布局模板：
 * - ListPageTemplate: 列表页面模板（支持统计卡片）
 * - MultiTabListPageTemplate: 多标签页列表页面模板
 * - FormModalTemplate: 表单 Modal 模板
 * - DetailDrawerTemplate: 详情 Drawer 模板
 * - TwoColumnLayout: 两栏布局模板（左侧树形结构，右侧内容区）
 * - DashboardTemplate: 工作台布局模板（快捷操作、待办事项、数据看板）
 * - WizardTemplate: 向导布局模板（步骤式向导）
 * - KanbanViewTemplate: 看板视图布局模板（工单看板、任务看板）
 * - TouchScreenTemplate: 工位机触屏模式布局模板（大按钮、大字体、全屏）
 * - CanvasPageTemplate: 画板页布局模板（操作条 + 画板 + 右侧面板，审批流设计、BOM 设计等）
 * - IframePageTemplate: Iframe 页面布局模板（嵌入外部页面，自动适应容器）
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

// 列表页面模板
export { ListPageTemplate } from './ListPageTemplate'
export type { ListPageTemplateProps, StatCard } from './ListPageTemplate'

// 多标签页列表页面模板
export { MultiTabListPageTemplate } from './MultiTabListPageTemplate'
export type { MultiTabListPageTemplateProps, TabItem } from './MultiTabListPageTemplate'

// 表单 Modal 模板
export { FormModalTemplate } from './FormModalTemplate'
export type { FormModalTemplateProps } from './FormModalTemplate'

// 详情 Drawer 模板
export { DetailDrawerTemplate } from './DetailDrawerTemplate'
export type { DetailDrawerTemplateProps } from './DetailDrawerTemplate'
export { DetailDrawerSection } from './DetailDrawerSection'
export type { DetailDrawerSectionProps } from './DetailDrawerSection'
export { DetailDrawerActions } from './DetailDrawerActions'
export type { DetailDrawerActionsProps, DetailDrawerActionItem } from './DetailDrawerActions'

// 两栏布局模板
export { TwoColumnLayout } from './TwoColumnLayout'
export type { TwoColumnLayoutProps, LeftPanelConfig, RightPanelConfig } from './TwoColumnLayout'

// 工作台布局模板
export { DashboardTemplate } from './DashboardTemplate'
export type {
  DashboardTemplateProps,
  QuickAction,
  TodoItem,
  DashboardStat,
  QuickEntry,
} from './DashboardTemplate'

// 向导布局模板
export { WizardTemplate } from './WizardTemplate'
export type { WizardTemplateProps, WizardStep } from './WizardTemplate'

// 看板视图布局模板
export { KanbanViewTemplate } from './KanbanViewTemplate'
export type { KanbanViewTemplateProps, KanbanColumn } from './KanbanViewTemplate'

// 工位机触屏模式布局模板
export { TouchScreenTemplate } from './TouchScreenTemplate'
export type { TouchScreenTemplateProps, TouchScreenButton } from './TouchScreenTemplate'

// 对比视图布局模板
export { CompareViewTemplate } from './CompareViewTemplate'
export type { CompareViewTemplateProps, CompareItem } from './CompareViewTemplate'

// 参数配置布局模板
export { ParameterConfigTemplate } from './ParameterConfigTemplate'
export type {
  ParameterConfigTemplateProps,
  ParameterGroup,
  ParameterItem,
} from './ParameterConfigTemplate'

// 计算结果显示布局模板
export { CalculationResultTemplate } from './CalculationResultTemplate'
export type {
  CalculationResultTemplateProps,
  CalculationExplanation,
} from './CalculationResultTemplate'

// 画板页布局模板
export { CanvasPageTemplate } from './CanvasPageTemplate'
export type { CanvasPageTemplateProps, CanvasPageRightPanelConfig } from './CanvasPageTemplate'

// 高级生产终端布局模板
export { default as PremiumTerminalTemplate } from './PremiumTerminalTemplate'
export type { PremiumTerminalTemplateProps } from './PremiumTerminalTemplate'

// Iframe 页面布局模板
export { IframePageTemplate } from './IframePageTemplate'
export type { IframePageTemplateProps } from './IframePageTemplate'

// 布局常量配置
export * from './constants'
