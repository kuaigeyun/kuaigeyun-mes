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
 *
 * HMI / 工作台 / 画板等见 `./hmi`（勿从本 barrel 再导出，避免单据列表首屏打进终端模板）。
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
export { useMultiTabPageContainerHeight } from './useMultiTabPageContainerHeight'

// 表单 Modal 模板
export { FormModalTemplate, FormModalGridBlock } from './FormModalTemplate'
export type { FormModalTemplateProps } from './FormModalTemplate'

// 独立新建/编辑页布局
export { DocumentFormPageLayout } from './DocumentFormPageLayout'
export type { DocumentFormPageLayoutProps } from './DocumentFormPageLayout'
export { DocumentFormPageHeaderActions } from './DocumentFormPageHeaderActions'
export type { DocumentFormPageHeaderActionsProps } from './DocumentFormPageHeaderActions'

// 详情 Drawer 模板
export { DetailDrawerTemplate } from './DetailDrawerTemplate'
export type { DetailDrawerTemplateProps } from './DetailDrawerTemplate'
export { detailDrawerDescriptionItems } from './detailDrawerDescriptionItems'
export { DetailDrawerSection } from './DetailDrawerSection'
export type { DetailDrawerSectionProps } from './DetailDrawerSection'
export { DetailDrawerLinesScroll } from './DetailDrawerLinesScroll'
export type { DetailDrawerLinesScrollProps } from './DetailDrawerLinesScroll'
export {
  DetailDrawerInlineFullChain,
  DETAIL_DRAWER_INLINE_FULL_CHAIN_HEIGHT,
} from './DetailDrawerInlineFullChain'
export type {
  DetailDrawerInlineFullChainProps,
  TraceBriefDocument,
} from './DetailDrawerInlineFullChain'
export { DetailDrawerActions } from './DetailDrawerActions'
export type { DetailDrawerActionsProps, DetailDrawerActionItem } from './DetailDrawerActions'

// 两栏布局模板
export { TwoColumnLayout } from './TwoColumnLayout'
export type { TwoColumnLayoutProps, LeftPanelConfig, RightPanelConfig } from './TwoColumnLayout'

// 布局常量配置
export * from './constants'
export { getDrawerFloatingWrapperStyle } from './drawerFloatingChrome'
export type { DrawerFloatingChromeToken } from './drawerFloatingChrome'
export { flushDrawerOpen } from './flushDrawerOpen'
export { WAREHOUSE_DETAIL_TABLE_STYLES } from './warehouse-detail-table-styles'
