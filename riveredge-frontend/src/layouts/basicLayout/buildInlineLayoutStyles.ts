/**
 * BasicLayout 内联样式构建（useMemo 缓存，避免无关 state 变更触发 CSS 重解析）。
 */
import type { GlobalToken } from 'antd/es/theme/interface';
import { useMemo } from 'react';
import {
  SPLIT_SIDEBAR_PRIMARY_WIDTH,
} from './sidebarMenuLayout';

export type BasicLayoutStyleContext = {
  token: GlobalToken;
  isDarkMode: boolean;
  isLightModeLightBg: boolean;
  isLightModeDarkSider: boolean;
  isEnglishLocale: boolean;
  siderTextColor: string;
  siderBgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  siderFooterToken: GlobalToken;
  startMenuBaseRadius: number;
  startMenuPanelRadius: number;
  startMenuTheme: Record<string, any>;
};

export function buildShellLayoutStyles(ctx: BasicLayoutStyleContext): string {
  const { token, isDarkMode } = ctx;
  return `
        html, body {
          background-color: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          transition: none !important;
        }
        #root {
          background-color: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          transition: none !important;
        }
        /* 主题切换：仅掐断布局壳常见层的过渡。避免使用全文档星号通配选择器及 ant-layout 下全后代通配，否则样式引擎需遍历巨量节点，易严重掉帧 */
        .ant-pro-layout,
        .ant-layout,
        .ant-layout-header,
        .ant-layout-content,
        .ant-layout-footer,
        .ant-pro-sider,
        .ant-pro-sider-menu,
        .ant-pro-global-header,
        .ant-pro-global-header-logo,
        .ant-menu,
        .ant-menu-submenu,
        .ant-menu-item {
          transition: background-color 0s !important;
          transition: color 0s !important;
          transition: border-color 0s !important;
        }
        /* ==================== 全屏模式样式 ==================== */
        /* 使用 class 控制，确保退出全屏时样式自动清除 */
        /* 全局容器全屏 - 使用最高优先级选择器 */
        html.riveredge-fullscreen-mode,
        body.riveredge-fullscreen-mode,
        html.riveredge-fullscreen-mode body,
        body.riveredge-fullscreen-mode html {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        html.riveredge-fullscreen-mode #root,
        body.riveredge-fullscreen-mode #root,
        html.riveredge-fullscreen-mode body #root,
        body.riveredge-fullscreen-mode html #root {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* 隐藏左侧菜单 - 配合 siderWidth={0} + menuRender={() => null} 使用，确保侧边栏完全隐藏 */
        /* 关键：即使 collapsed={true}，折叠的侧边栏仍然占据空间（通常 48-80px），需要完全隐藏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider,
        /* 覆盖折叠状态的侧边栏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider.ant-layout-sider-collapsed,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider.ant-layout-sider-collapsed,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider.ant-layout-sider-collapsed,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider.ant-layout-sider-collapsed {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          flex: 0 0 0 !important;
          flex-basis: 0 !important;
          flex-grow: 0 !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          left: -9999px !important;
        }
        /* 隐藏侧边栏内部内容 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider-menu,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider-menu,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider-children,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider-children,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-menu-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-menu-container {
          display: none !important;
          visibility: hidden !important;
        }
        /* 确保 flex 布局不为隐藏的侧边栏保留空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
          gap: 0 !important;
          column-gap: 0 !important;
          row-gap: 0 !important;
        }
        /* 确保内容区域占据所有可用空间 - 增强规则 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          left: 0 !important;
        }
        /* 隐藏顶部导航栏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-header {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            flex: 0 0 0 !important;
          }
        /* 确保 ProLayout 容器也占据全屏 */
        html.riveredge-fullscreen-mode .ant-pro-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout-container,
        body.riveredge-fullscreen-mode .ant-pro-layout-container,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
            height: 100vh !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            left: 0 !important;
            right: 0 !important;
          }
        /* 确保flex容器不为隐藏的sider保留空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider .ant-layout {
          gap: 0 !important;
          column-gap: 0 !important;
          row-gap: 0 !important;
        }
        /* 确保mix布局下的所有布局容器都不保留左侧空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout {
            margin-left: 0 !important;
            padding-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        /* 内容区域占据整个视口 - 从左边距0开始 - 增强规则覆盖所有情况 */
        /* 关键：覆盖 ProLayout 的默认 padding-inline: 40px */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content,
        /* 覆盖 collapsed 状态下的内容区域 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-layout-content {
          margin-left: 0 !important;
          margin-top: 0 !important;
          margin-right: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-inline: 0 !important;
          padding-inline-start: 0 !important;
          padding-inline-end: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          left: 0 !important;
          position: relative !important;
        }
        /* 确保 mix 布局下的所有内容容器都从左边距0开始 - 增强规则 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .ant-pro-page-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .ant-pro-page-container,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .ant-pro-page-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .ant-pro-page-container,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .uni-tabs-wrapper,
        /* 覆盖所有可能的布局容器 */
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          left: 0 !important;
        }
        /* 标签栏固定在顶部 */
        html.riveredge-fullscreen-mode .uni-tabs-header,
        body.riveredge-fullscreen-mode .uni-tabs-header {
          top: 0 !important;
          position: sticky !important;
          z-index: 10 !important;
          padding-top: 2px !important;
        }
        /* 标签栏和内容区域容器占据全屏 */
        html.riveredge-fullscreen-mode .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .uni-tabs-wrapper {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          width: 100% !important;
          max-width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
        html.riveredge-fullscreen-mode .uni-tabs-content,
        body.riveredge-fullscreen-mode .uni-tabs-content {
          flex: 1 !important;
          min-height: 0 !important;
          overflow: auto !important;
          height: auto !important;
          max-height: none !important;
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
        .ant-pro-global-header-logo h1,
        .ant-pro-global-header-logo a h1,
        .ant-pro-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout-header .ant-pro-global-header-logo a h1,
        .ant-layout-header .ant-pro-global-header-logo h1,
        .ant-layout-header .ant-pro-global-header-logo a h1 {
          color: var(--riveredge-logo-title-color) !important;
        }
      `;
}

export function buildThemeLayoutStyles(ctx: BasicLayoutStyleContext): string {
  const {
    token,
    isDarkMode,
    isLightModeLightBg,
    isLightModeDarkSider,
    isEnglishLocale,
    siderTextColor,
    siderBgColor,
    headerBgColor,
    headerTextColor,
    siderFooterToken,
    startMenuBaseRadius,
    startMenuPanelRadius,
    startMenuTheme,
  } = ctx;
  const siderDividerColor =
    isDarkMode || siderTextColor === '#ffffff'
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(0, 0, 0, 0.12)';
  /** 顶栏右侧圆形/胶囊按钮底：深色顶栏略提亮，避免与海军蓝底糊成一片 */
  const headerActionChipBg = isLightModeLightBg
    ? 'rgba(0, 0, 0, 0.10)'
    : 'rgba(255, 255, 255, 0.20)';
  const headerActionChipBgHover = isLightModeLightBg
    ? 'rgba(0, 0, 0, 0.16)'
    : 'rgba(255, 255, 255, 0.28)';
  return `
        /* 动态注入主题色到 CSS 变量 */
        :root {
          --riveredge-menu-primary-color: ${token.colorPrimary};
          --ant-colorPrimary: ${token.colorPrimary};
          --ant-colorBgLayout: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')};
          --ant-colorBorder: ${token.colorBorder};
          --ant-colorBorderSecondary: ${token.colorBorderSecondary ?? token.colorBorder};
          --ant-borderRadius: ${token.borderRadius}px;
          --ant-borderRadiusLG: ${token.borderRadiusLG ?? token.borderRadius + 2}px;
        }
        /* 侧栏分割线：与底栏/搜索框等同层级，随侧栏明暗适配 */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-layout-sider {
          --riveredge-sider-divider-color: ${siderDividerColor};
        }
        /* ==================== PageContainer 相关 ==================== */
        .ant-pro-page-container .ant-page-header .ant-page-header-breadcrumb,
        .ant-pro-page-container .ant-breadcrumb {
          display: none !important;
        }
        /*
         * UniTabs 已承担唯一一层 16px 留白（page-outer 左右 / content margin-top）。
         * PageContainer 默认 children-container=40、warp-page-header 再叠 padding，
         * 详情页标签区会看起来像 3×16；此处清零，页头与下方内容只保留一档 16px 间距。
         */
        .ant-pro-page-container .ant-pro-page-container-children-content,
        .ant-pro-page-container .ant-pro-page-container-children-container {
          padding: 0 !important;
          padding-inline: 0 !important;
          padding-block: 0 !important;
        }
        .ant-pro-page-container .ant-pro-page-container-warp-page-header {
          padding-block: 0 !important;
          padding-inline: 0 !important;
          margin-bottom: 16px;
        }
        /* 全局页面边距：已由 UniTabs / ListPageTemplate 统一管理，不再需要全局样式 */
        /* 注意：未使用上述容器的页面需要自行管理 padding */
        .uni-tabs-content .ant-pro-table {
          padding: 0 !important;
        }
        /* 侧边栏收起时，确保内容区域左边距正确 - 只在侧边栏收起时生效 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，内容区域和页面容器的左边距 - 只在侧边栏收起时生效 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 侧边栏收起状态下的内容区域 - 使用更通用的选择器 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 覆盖所有可能的布局容器 - 只在侧边栏收起时生效 */
        .ant-pro-layout-container .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-pro-sider-collapsed ~ .ant-layout-content,
        .ant-pro-layout-container .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-layout-content,
        .ant-pro-layout-container .ant-layout-sider-collapsed ~ .ant-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，确保所有内容容器都没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider[class*="collapsed"] ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider[class*="collapsed"] ~ .ant-pro-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 确保 UniTabs 组件在侧边栏收起时也没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .uni-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .uni-tabs-wrapper {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 文件管理页面无边距（覆盖全局规则） */
        .uni-tabs-content .file-management-page .ant-pro-table {
          padding: 0 !important;
        }
        .pro-table-button-container {
          margin-bottom: 16px;
          padding: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        /* 列表搜索条「重置」：hover / 键盘聚焦时强调为 warning，避免与主色蓝混淆 */
        .uni-search-reset-btn.ant-btn:hover,
        .uni-search-reset-btn.ant-btn:focus-visible {
          color: var(--ant-color-warning, #faad14) !important;
          border-color: var(--ant-color-warning, #faad14) !important;
        }
        .uni-search-reset-btn.ant-btn:hover .anticon,
        .uni-search-reset-btn.ant-btn:focus-visible .anticon {
          color: var(--ant-color-warning, #faad14) !important;
        }
        /* 全局滚动条样式 - 只对主要内容区域隐藏滚动条，保持菜单滚动条可见 */
        /* ==================== 菜单分组标题样式 ==================== */
        /* 参考：https://ant-design.antgroup.com/components/menu-cn
         * groupTitleColor: rgba(0,0,0,0.45), groupTitleFontSize: 14, groupTitleLineHeight: 1.5714285714285714
         * 使用主题颜色变量，支持深色模式，并根据菜单栏背景色自动适配
         */
        /* 侧边栏内的系统分组标题 - 根据菜单栏背景色自动适配（排除应用分组） */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:not(.menu-group-title-app) {
          font-size: var(--ant-fontSize) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          line-height: 1.5714285714285714 !important;
        }
        /* 应用级分组：ProLayout 若渲染为 SubMenu；左缩进与一级菜单项图标列对齐（16px padding + 6px margin） */
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu-submenu-title {
          font-size: 12px !important;
          color: var(--ant-colorPrimary) !important;
          font-weight: 700 !important;
          padding: 2px 16px 2px 16px !important;
          margin-block: 0 !important;
          margin-inline: 6px !important;
          line-height: 1.2 !important;
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          cursor: default !important;
          pointer-events: none !important;
          background: transparent !important;
        }
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu-submenu-title .ant-menu-submenu-arrow {
          display: none !important;
        }
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu-submenu-title .ant-menu-title-content {
          overflow: visible !important;
          max-width: 100% !important;
        }
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu {
          display: none !important;
        }
        /* 应用级菜单分组标题：左缩进对齐一级菜单图标列（itemPaddingInline 16 + margin-inline 6） */
        .ant-pro-sider-menu .ant-menu-item-group[class*="app-group-"] .ant-menu-item-group-title,
        .ant-pro-sider-menu .ant-menu-item-group[class*="menu-group-title-app"] .ant-menu-item-group-title,
        .ant-pro-sider-menu .ant-menu-item-group-title.menu-group-title-app,
        .ant-pro-sider-menu .ant-menu-item-group:has([data-menu-id*="app-group-placeholder"]) > .ant-menu-item-group-title,
        .ant-pro-sider-menu .ant-menu-item-group:has(.app-group-placeholder-item) > .ant-menu-item-group-title,
        .ant-pro-sider-menu .ant-menu-item-group:has([data-app-menu-group]) > .ant-menu-item-group-title {
          font-size: 12px !important;
          color: var(--ant-colorPrimary) !important;
          font-weight: 700 !important;
          padding: 2px 16px 2px 16px !important;
          margin-block: 0 !important;
          margin-inline: 6px !important;
          line-height: 1.2 !important;
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
        }
        /* 应用分组标题文字：内联节点带 !important，盖过父级灰色 siderTextColor */
        .ant-pro-sider-menu .ant-menu-item-group-title .menu-group-title-app-label,
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app .menu-group-title-app-label {
          display: inline-flex !important;
          align-items: center !important;
          pointer-events: none;
          font-size: 12px !important;
          color: var(--ant-colorPrimary) !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
        }
        .ant-pro-sider-menu .ant-menu-item-group-title .menu-item-badge-pro,
        .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app .menu-item-badge-pro {
          pointer-events: none;
        }
        /* 隐藏占位子菜单项 */
        .ant-pro-sider-menu .ant-menu-item[class*="app-group-placeholder-"],
        .ant-pro-sider-menu .ant-menu-item.app-group-placeholder-item,
        .ant-pro-sider-menu .ant-menu-item[key*="app-group-placeholder-"] {
          display: none !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:not(.menu-group-title-app):hover,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:not(.menu-group-title-app):active,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:not(.menu-group-title-app):focus {
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
        }
        /* ==================== 一级菜单项 - 完全遵循 Ant Design 原生样式 ==================== */
        /* 不做任何修改，完全使用 Ant Design 的原生样式和垂直居中 */
        /* 侧栏菜单图标是 Lucide <svg>（包裹在 .ant-pro-base-menu-inline-item-icon 内，size=16），
           颜色经 currentColor 继承自菜单项文字色。原先这里针对 .ant-menu-item-icon/.anticon 的
           图标尺寸、20x20 伪元素背景、选中白色等规则均为 antd v4/v5 残留，对 ProLayout 7.x 结构
           完全不命中（零匹配），已清理。 */
        /* ==================== 菜单项样式 - 使用 Ant Design 原生 ==================== */
        /* 让 Ant Design 使用其默认的菜单项高度和行高 */

        /* 子菜单标题样式（ant-menu-submenu-title）- 使用 Ant Design 原生样式 */
        /* 使用主题颜色变量，支持深色模式 */
        /* 注意：只针对侧边栏内的子菜单标题，不影响弹出菜单 */
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title {
          /* 子菜单标题的独立样式，与普通菜单项区分开；几何参数跨主题固定，避免切换时右侧抖动 */
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          padding-inline-end: 10px !important; /* 固定箭头区预留空间，避免主题切换导致右侧1-2px位移 */
          color: ${siderTextColor} !important;
          font-size: var(--ant-fontSize) !important;
          font-weight: normal !important;
        }
        /* 一级子菜单箭头位置微调：修复视觉偏左 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed)
          > .ant-menu-submenu
          > .ant-menu-submenu-title
          .ant-menu-submenu-arrow {
          inset-inline-end: 4px !important;
        }
        
        /* 优化菜单标题内容：AntD 6.4 下避免 max-width 计算导致的右侧挤出 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content {
          max-width: calc(100% - 28px) !important; /* 为右侧箭头预留空间，避免重叠 */
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }
        
        /* 一级菜单项的文字内容也需要优化（同上，仅展开态） */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }

        /* ⚠️ 收起态唯一必要的框架兼容修复（仅作用于收起栏的「一级项」），其余一切保持 ProLayout 原生。
           antd v6（node_modules/antd/es/menu/style/vertical.js）对收起态写死：
             .ant-menu-inline-collapsed > .ant-menu-item > .ant-menu-title-content { width:0; opacity:0; overflow:hidden }
           v6 假设图标是 title-content 的兄弟节点（antd 自带的 .ant-menu-item-icon），收起时把整块
           title-content 隐藏、单独保留图标；但 ProLayout 7.x 把图标放进 title-content 内部
           （.ant-pro-base-menu-inline-item-icon），导致图标被一起隐藏。这里恢复其可见并居中（仅图标，无文字）。
           ⚠️ 必须用「子选择器」精确限定到收起栏顶层项，不能用后代选择器——否则会波及悬浮弹出的二级菜单
           （ProLayout 把弹出层挂在 body，层级与作用域均不同），破坏其 antd 原生样式。 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title > .ant-menu-title-content {
          width: 100% !important;
          opacity: 1 !important;
          overflow: visible !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          flex: none !important;
        }
        /* 收起态一级项：清掉 antd v6 的 padding-inline 居中（其前提是图标在 title-content 外），改用 flex 居中。 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title {
          padding-inline: 0 !important;
          justify-content: center !important;
        }
        /* 收起态：激活菜单使用主题色背景，图标白色 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          background-color: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected .anticon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected svg,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .anticon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title svg,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected .ant-pro-base-menu-inline-item-icon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-pro-base-menu-inline-item-icon {
          color: #fff !important;
        }
        
        /* 子菜单标题悬浮状态 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title:hover {
          background-color: var(--ant-colorFillTertiary) !important;
          color: ${siderTextColor} !important;
        }
        /* 子菜单标题激活状态 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          color: var(--riveredge-menu-primary-color) !important;
        }
        /* 使用自定义样式选择器针对插件分组标题 */
        .menu-group-title-plugin {
          font-size: var(--ant-fontSizeSM) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
        }
        /* 系统菜单分组标题样式 */
        .menu-group-title-system {
          font-size: var(--ant-fontSizeSM) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          margin-top: 8px !important;
        }
        /* 应用级菜单分组标题样式 - 使用实际的选择器 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] {
          padding: 0 16px 0 16px !important; /* 左缩进对齐一级菜单图标列 */
          margin-block: 0 !important;
          margin-inline: 6px !important;
          line-height: 1.2 !important;
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          background-color: transparent !important;
        }
        /* 禁用分组标题的所有交互状态 - 完全去掉 hover 效果 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:hover,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:focus,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:active,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app.ant-menu-item-selected,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:focus,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:active,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover::before,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover::after {
          background-color: transparent !important;
          color: var(--ant-colorTextSecondary) !important;
          box-shadow: none !important;
          border: none !important;
        }
        /* 确保分组标题的容器和内容高度最小 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] {
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          line-height: 1.2 !important;
        }
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app .ant-menu-title-content,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] .ant-menu-title-content {
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          line-height: 1.2 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
        }
        /* 分组标题内部div样式 - 减小上下 padding */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app .menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] .menu-group-title-app {
          padding: 0 !important; /* 减小上下 padding */
          margin: 0 !important;
          line-height: 1.2 !important;
        }
        /* 左侧菜单小徽标：报表 / 大屏 / 业务未完成数量 */
        .menu-item-badge {
          flex-shrink: 0;
          font-size: 10px;
          line-height: 1.2;
          padding: 0 4px;
          border-radius: 2px;
          font-weight: 500;
        }
        .menu-item-badge-report {
          background: var(--ant-colorPrimaryBg);
          color: var(--ant-colorPrimary);
        }
        .menu-item-badge-dashboard {
          background: var(--ant-colorInfoBg);
          color: var(--ant-colorInfo);
        }
        .menu-item-badge-pro {
          margin-left: 6px;
          letter-spacing: 0.04em;
          font-size: 10px;
          line-height: 1.2;
          padding: 0 4px;
          border-radius: 2px;
          font-weight: 600;
          background: color-mix(in srgb, #d48806 16%, var(--ant-colorBgContainer, #fff));
          color: #d48806;
          border: 1px solid color-mix(in srgb, #d48806 35%, transparent);
        }
        /* 应用分组标题（含 PRO）：避免被菜单项溢出裁切 */
        .ant-menu-item.menu-group-title-app .ant-menu-title-content,
        .ant-menu-item[class*='menu-group-title-app'] .ant-menu-title-content {
          overflow: visible !important;
        }
        .menu-item-badge-count.ant-badge .ant-badge-count {
          font-size: 10px;
          line-height: 14px;
          min-width: 14px;
          height: 14px;
          padding: 0 2px;
        }
        .menu-item-badge-count {
          flex-shrink: 0;
          margin-right: 4px;
        }
        .menu-item-badge-count-wrap {
          display: inline-flex;
          flex-shrink: 0;
          line-height: 0;
        }
        /* 菜单项含数字徽标时：增加右侧留白，避免徽标右边被遮挡 */
        .ant-pro-sider-menu .ant-menu-item:has(.menu-item-badge-count) {
          padding-right: 22px !important;
          overflow: visible !important;
        }
        .ant-pro-sider-menu .ant-menu-item:has(.menu-item-badge-count) .ant-menu-title-content {
          overflow: visible !important;
        }
        /* 使用 ProLayout 原生收起按钮，保持原生行为 */
        /* 不再隐藏原生收起按钮，让 ProLayout 自己处理收起展开逻辑 */
        /* 隐藏 ant-pro-layout-container 里的 footer */
        .ant-pro-layout-container .ant-pro-layout-footer {
          display: none !important;
        }
        /* ==================== 菜单收起状态 - 遵循 Ant Design 原生行为 ==================== */
        /* 原则：让 Ant Design 自己处理菜单收起/展开，不做过多干预 */
        .ant-pro-layout-container footer {
          display: none !important;
        }
        /* 菜单底部收起按钮样式 - 根据菜单栏背景色自动适配 */
        .menu-collapse-button {
          color: ${siderTextColor} !important;
        }
        .menu-collapse-button:hover {
          background-color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.08)' : 'var(--ant-colorFillTertiary)'} !important;
          border-radius: 4px !important;
          color: ${siderTextColor} !important;
        }
        .menu-collapse-button:active {
          background-color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'var(--ant-colorFillSecondary)'} !important;
          color: ${siderTextColor} !important;
        }
        /* ==================== 菜单底部 ==================== */
        /* 使用主题边框颜色，支持深色模式，并根据菜单栏背景色自动适配 */
        .ant-pro-sider-footer {
          margin-bottom: 10px !important;
          padding-bottom: 0 !important;
        }
        /* 侧边栏底部收起按钮区域样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer,
        /* 覆盖 collapsedButtonRender 返回的 div */
        .ant-pro-layout .ant-pro-sider-footer > div,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div,
        .ant-pro-layout .riveredge-sider-footer-bar {
          border-top: 1px solid var(--riveredge-sider-divider-color) !important;
        }
        /* 侧边栏底部收起按钮样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn {
          color: ${siderTextColor} !important;
        }
        /* 盖过上一段：设置钮文字/图标用主题主色 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn,
        .riveredge-footer-collapse-btn {
          width: 100% !important;
          border-radius: ${startMenuBaseRadius}px !important;
        }
        /* 系统设置入口：深色侧栏中性底 + 主题色字；浅色侧栏主色浅底 */
        .riveredge-footer-settings-btn {
          background: ${startMenuTheme.settingsBtnBg} !important;
          border-color: ${startMenuTheme.settingsBtnBorder} !important;
          box-shadow: none !important;
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn .anticon,
        .riveredge-footer-settings-btn svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn:hover {
          background: ${startMenuTheme.settingsBtnBgHover} !important;
          border-color: ${startMenuTheme.settingsBtnBorder} !important;
        }
        .riveredge-footer-settings-btn:active {
          background: ${startMenuTheme.settingsBtnBgActive} !important;
        }
        /* 折叠钮统一中性底 token */
        .riveredge-footer-collapse-btn {
          background: ${siderFooterToken.colorFillSecondary} !important;
          border-color: ${siderFooterToken.colorSplit} !important;
          box-shadow: none !important;
        }
        .riveredge-footer-collapse-btn:hover {
          background: ${siderFooterToken.colorFillTertiary} !important;
        }
        .riveredge-footer-collapse-btn:active {
          background: ${siderFooterToken.colorFillQuaternary} !important;
        }
        @keyframes riveredgeSystemPanelIn {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes riveredgeSystemPanelOut {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.97);
          }
        }
        .riveredge-system-settings-panel {
          position: fixed;
          left: 8px;
          bottom: 52px;
          width: min(var(--riveredge-system-panel-width, 940px), calc(100vw - 24px));
          max-height: min(86vh, 860px);
          border-radius: ${startMenuPanelRadius}px;
          border: 1px solid ${startMenuTheme.panelBorder};
          background: ${startMenuTheme.panelBg};
          ${startMenuTheme.panelBlur ? `backdrop-filter: blur(${startMenuTheme.panelBlurAmount}) saturate(${startMenuTheme.panelBlurSaturate}); -webkit-backdrop-filter: blur(${startMenuTheme.panelBlurAmount}) saturate(${startMenuTheme.panelBlurSaturate});` : ''}
          box-shadow: ${startMenuTheme.panelShadow};
          z-index: 1200;
          overflow: hidden;
          transform-origin: left bottom;
          animation: riveredgeSystemPanelIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        .riveredge-system-settings-panel.riveredge-system-settings-panel--exiting {
          animation: riveredgeSystemPanelOut 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .riveredge-system-settings-panel {
            animation: none;
          }
        }
        .riveredge-system-settings-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px 12px;
          border-bottom: 1px solid ${startMenuTheme.panelHeaderBorder};
        }
        .riveredge-system-settings-panel-title {
          font-size: 16px;
          font-weight: 700;
          color: ${startMenuTheme.panelTitleColor};
        }
        .riveredge-system-settings-panel-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
          min-width: 0;
          --riveredge-system-panel-chip-height: calc(12px * 1.4 + 8px + 2px);
        }
        .riveredge-system-settings-panel-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12px;
          min-height: var(--riveredge-system-panel-chip-height);
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.4;
          color: ${startMenuTheme.panelTitleColor};
          background: ${startMenuTheme.panelGroupBg};
          border: 1px solid ${startMenuTheme.panelGroupBorder};
          box-shadow: ${startMenuTheme.panelGroupInsetShadow};
          box-sizing: border-box;
        }
        .riveredge-system-settings-panel-meta-item {
          white-space: nowrap;
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close {
          width: var(--riveredge-system-panel-chip-height);
          min-width: var(--riveredge-system-panel-chip-height);
          height: var(--riveredge-system-panel-chip-height);
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid ${startMenuTheme.panelGroupBorder};
          background-color: ${startMenuTheme.panelGroupBg};
          box-shadow: ${startMenuTheme.panelGroupInsetShadow};
          box-sizing: border-box;
          cursor: pointer;
          line-height: 1;
          font-size: 12px;
          appearance: none;
          -webkit-appearance: none;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close .anticon,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close svg {
          color: ${startMenuTheme.panelCloseColor};
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:hover,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:focus-visible,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:active {
          color: ${startMenuTheme.panelCloseHoverColor} !important;
          background-color: ${startMenuTheme.panelCloseHoverBg} !important;
          border-color: ${startMenuTheme.panelCloseHoverBorder} !important;
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:hover .anticon,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:focus-visible .anticon,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:active .anticon,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:hover svg,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:focus-visible svg,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:active svg {
          color: ${startMenuTheme.panelCloseHoverColor} !important;
        }
        .riveredge-system-settings-panel-body {
          padding: 14px;
          overflow-y: auto;
          max-height: min(78vh, 760px);
          display: grid;
          grid-template-columns: repeat(var(--riveredge-system-panel-columns, 24), minmax(0, 1fr));
          align-content: start;
          gap: 12px;
          background: transparent;
        }
        .riveredge-system-settings-group-wrap {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .riveredge-system-settings-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-radius: ${startMenuPanelRadius}px;
          padding: 12px;
          background: ${startMenuTheme.panelGroupBg};
          border: 1px solid ${startMenuTheme.panelGroupBorder};
          box-shadow: ${startMenuTheme.panelGroupInsetShadow};
        }
        .riveredge-system-settings-group-title {
          font-size: 13px;
          font-weight: 700;
          color: ${startMenuTheme.panelTitleColor};
          padding: 0 2px;
          line-height: 1.3;
          letter-spacing: 0.01em;
        }
        .riveredge-system-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .riveredge-system-settings-item {
          width: 100%;
          border: 1px solid ${startMenuTheme.panelItemBorder};
          background: ${startMenuTheme.panelItemBg};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          color: ${startMenuTheme.panelItemColor};
          padding: 10px 8px;
          border-radius: ${startMenuBaseRadius}px;
          min-height: 76px;
          height: auto;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .riveredge-system-settings-item:hover {
          background: ${startMenuTheme.panelItemHoverBg};
          border-color: ${startMenuTheme.panelItemHoverBorder};
          transform: translateY(-1px);
          box-shadow: none;
        }
        .riveredge-system-settings-item:focus-visible {
          outline: 2px solid var(--ant-colorPrimary);
          outline-offset: 1px;
        }
        .riveredge-system-settings-item-icon {
          width: 44px;
          height: 44px;
          border-radius: ${startMenuPanelRadius}px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          line-height: 1;
          transition: transform 0.18s ease;
        }
        .riveredge-system-settings-item-icon .anticon,
        .riveredge-system-settings-item-icon svg {
          font-size: 42px;
          width: 42px;
          height: 42px;
          color: currentColor;
        }
        .riveredge-system-settings-item:hover .riveredge-system-settings-item-icon {
          transform: translateY(-1px);
        }
        .riveredge-system-settings-item-label {
          font-size: 13px;
          line-height: 1.25;
          font-weight: 500;
          text-align: center;
          width: 100%;
          min-height: calc(1.25em * 2);
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: normal;
          overflow-wrap: break-word;
          word-break: normal;
        }
        @media (max-width: 900px) {
          .riveredge-system-settings-panel {
            left: 8px;
            right: 8px;
            width: auto;
          }
          .riveredge-system-settings-panel-body {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
          .riveredge-system-settings-group-wrap {
            grid-column: span 6 !important;
          }
        }
        @supports not ((backdrop-filter: blur(2px))) {
          .riveredge-system-settings-panel {
            background: ${startMenuTheme.panelBgFallback};
          }
        }
        /* 侧边栏底部收起按钮图标样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn svg {
          color: ${siderTextColor} !important;
        }
        /* 侧边栏底部收起按钮 hover 状态 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover {
          color: ${siderTextColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover svg {
          color: ${siderTextColor} !important;
        }
        /* 侧边栏底部收起按钮 active 状态 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active {
          color: ${siderTextColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active svg {
          color: ${siderTextColor} !important;
        }
        /* 设置钮图标：跟主题主色（盖过上面「全体侧栏底栏图标 = siderTextColor」） */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        /* ==================== 左侧菜单栏滚动条样式 ==================== */
        /* 完全隐藏左侧菜单栏滚动条，不占用任何宽度（滚动容器为 ProLayout 包裹层） */
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .ant-pro-sider-menu)::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar)::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .ant-pro-sider-menu)::-webkit-scrollbar-track {
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar)::-webkit-scrollbar-track {
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .ant-pro-sider-menu)::-webkit-scrollbar-thumb {
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar)::-webkit-scrollbar-thumb {
          display: none !important;
        }
        /* Firefox 左侧菜单栏滚动条样式 */
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .ant-pro-sider-menu),
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar) {
          scrollbar-width: none !important;
        }
        /* 统一顶部、标签栏和菜单栏的背景色 - 使用 token 值并同步到 CSS 变量；Modal 内容区/footer 使用 colorBgElevated */
        :root {
          --ant-colorBgContainer: ${token.colorBgContainer};
          --ant-colorBgElevated: ${token.colorBgElevated};
        }
        /* 顶栏背景色（支持透明度） */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          background: ${headerBgColor} !important;
          border-bottom: 1px solid ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)'} !important;
        }
        /* ==================== 顶栏文字颜色自动适配（根据背景色亮度反色处理） ==================== */
        /* 顶栏文字颜色 - 根据背景色亮度自动适配 */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          color: ${headerTextColor} !important;
        }
        /* 顶栏按钮文字颜色和图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-btn {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 顶栏按钮 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover,
        .ant-pro-layout .ant-layout-header .ant-btn:hover {
          background-color: ${headerActionChipBgHover} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn:hover .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-header .ant-btn:hover svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 顶栏按钮 active 状态 - 浅色模式浅色背景无active效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active,
        .ant-pro-layout .ant-layout-header .ant-btn:active {
          background-color: ${headerActionChipBgHover} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn:active .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active svg,
        .ant-pro-layout .ant-layout-header .ant-btn:active svg {
          color: ${isDarkMode ? 'var(--ant-colorText)' : 'rgba(0, 0, 0, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 内容区背景颜色与 PageContainer 一致 - 使用 token 值 */
        .ant-pro-layout-bg-list {
          background: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
        }
        /* 确保 ProLayout 内容区域背景色与激活标签一致；强制 padding 为 0，避免首次加载 40/32 与 UniTabs 16px 叠层 */
        .ant-pro-layout-content,
        .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout-content .ant-pro-page-container-children-content,
        .ant-pro-layout-content .ant-pro-page-container-children-container {
          background: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          padding: 0 !important;
          padding-inline: 0 !important;
        }
        /* 左侧菜单区背景色 - 仅主侧栏（ant-pro-sider），不影响页面内嵌 Sider（如配置中心参数分类） */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-pro-sider-menu,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider-menu {
          background: ${siderBgColor} !important;
        }
        
        /* 根据菜单栏背景色自动适配文字颜色 */
        /* 深色背景使用浅色文字，浅色背景使用深色文字 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item:not(.ant-menu-item-selected),
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu:not(.menu-group-title-app) > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:not(.menu-group-title-app) {
          color: ${siderTextColor} !important;
        }
        /* 盖过上方 siderTextColor：应用分组标题保持主色（与 git HEAD 应用分组样式一致） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title.menu-group-title-app,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group.menu-group-title-app > .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group:has([data-app-menu-group]) > .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title .menu-group-title-app-label,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app .menu-group-title-app-label {
          color: var(--ant-colorPrimary) !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }
        /* 统一菜单文字排版（跨主题固定），避免切换明暗模式时文字抖动 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > span {
          font-weight: 400 !important;
          letter-spacing: 0 !important;
        }
        
        /* （菜单图标颜色由 currentColor 继承自上面的菜单项文字色，无需单独的 .anticon 规则，已清理） */
        
        /* 侧栏 flex：ProLayout 中间滚动区承载 overflow，底栏固定，避免最后一项被遮挡 */
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children {
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .ant-pro-sider-menu),
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar) {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          padding-bottom: var(--riveredge-sider-footer-height, 0px) !important;
          box-sizing: border-box !important;
        }
        html[data-sidebar-menu-layout="split"] .ant-pro-sider .ant-layout-sider-children > div:has(> .riveredge-split-sidebar) {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          padding-bottom: 0 !important;
          overflow: hidden !important;
        }
        .ant-pro-layout .ant-pro-sider-menu {
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          display: block !important;
        }
        .ant-pro-layout .ant-pro-sider-footer,
        .ant-pro-layout .riveredge-sider-footer-bar {
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 2 !important;
          background: ${siderBgColor} !important;
          /* 底栏容器不参与点击命中，仅按钮可点，避免透明区域挡住最后一项菜单 */
          pointer-events: none !important;
        }
        .ant-pro-layout .riveredge-sider-footer-bar .ant-btn,
        .ant-pro-layout .riveredge-sider-footer-bar button,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-pro-sider-footer button {
          pointer-events: auto !important;
        }
        /* 嵌套菜单排版（平铺侧栏专用；双列见 split 段 CSS 变量） */
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-item,
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-submenu-title {
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          padding-inline-start: 40px !important;
        }
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-sub > .ant-menu-item,
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-sub > .ant-menu-submenu > .ant-menu-submenu-title {
          padding-inline-start: 32px !important;
        }
        /* 激活菜单统一主题色背景（明暗模式、平铺/双列一致） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected {
          background-color: var(--riveredge-menu-primary-color) !important;
          border-right: none !important;
          box-shadow: none !important;
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content span,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected .ant-menu-title-content a,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected .ant-menu-title-content span {
          color: #fff !important;
          font-weight: normal !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected::after {
          display: none !important;
        }
        ${isDarkMode ? `
        /* 深色模式（平铺侧栏）：激活行宽度；双列侧栏见 split 段，不在此改几何 */
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-item.ant-menu-item-selected,
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title,
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-item.ant-menu-item-selected,
        html[data-sidebar-menu-layout="flat"] .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        /* 深色模式：激活态文本排版固定，避免模式切换时字宽抖动 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content > span {
          font-weight: 400 !important;
          letter-spacing: 0 !important;
        }
        ` : ''}
        ${isLightModeDarkSider ? `
        /* 浅色模式 + 深色侧栏：菜单文字白色（排除应用分组标题，避免盖掉主色） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item:not([class*='menu-group-title-app']):not([data-menu-id*='app-group-']),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.menu-group-title-app) > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title:not(.menu-group-title-app),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item:not([class*='menu-group-title-app']) .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.menu-group-title-app) > .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item:not([class*='menu-group-title-app']) .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item:not([class*='menu-group-title-app']) .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.menu-group-title-app) > .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.menu-group-title-app) > .ant-menu-submenu-title .ant-menu-title-content > span {
          color: #fff !important;
        }
        /* 深色侧栏下仍强制应用分组标题为主色（含 label 内联节点） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title.menu-group-title-app,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group.menu-group-title-app > .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group:has([data-app-menu-group]) > .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title .menu-group-title-app-label,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.menu-group-title-app .menu-group-title-app-label,
        .ant-menu-item[data-menu-id*='app-group-'],
        .ant-menu-item[class*='menu-group-title-app'],
        .ant-menu-item[data-menu-id*='app-group-'] .ant-menu-title-content,
        .ant-menu-item[class*='menu-group-title-app'] .ant-menu-title-content,
        .ant-menu-item[data-menu-id*='app-group-'] .menu-group-title-app-label,
        .ant-menu-item[class*='menu-group-title-app'] .menu-group-title-app-label {
          color: var(--ant-colorPrimary) !important;
        }
        ` : ''}
        ${(isDarkMode || isLightModeDarkSider) ? `
        /* 收起态二级弹层（submenu popup）：浅色+深色侧栏场景使用白底 80% 透明，提高可读性 */
        .ant-menu-submenu-popup > .ant-menu {
          background: ${isLightModeDarkSider ? 'rgba(255, 255, 255, 0.8)' : 'rgba(11, 23, 42, 0.9)'} !important;
          border: 1px solid ${isLightModeDarkSider ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)'} !important;
          box-shadow:
            ${isLightModeDarkSider ? '0 14px 32px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.55)' : '0 14px 32px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)'} !important;
          backdrop-filter: ${isLightModeDarkSider ? 'blur(14px) saturate(145%)' : 'blur(16px) saturate(155%)'} !important;
          -webkit-backdrop-filter: ${isLightModeDarkSider ? 'blur(14px) saturate(145%)' : 'blur(16px) saturate(155%)'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-title,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content > a,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content > span {
          color: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.88)' : 'rgba(255, 255, 255, 0.92)'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item:hover,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-title:hover {
          background: ${isLightModeDarkSider ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.12)'} !important;
          color: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.92)' : '#fff'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item-selected,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-selected > .ant-menu-submenu-title {
          background: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-arrow::before,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-arrow::after {
          background: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.75)'} !important;
        }
        ` : ''}
        
        /* 二级及以下菜单恢复 antd/pro-layout 原生样式：不再覆写颜色、选中态、缩进与过渡。 */
        /* ==================== 侧栏菜单动效：更短、更利落（仅作用于侧栏，不影响主题切换全局 0s 规则） ==================== */
        .ant-pro-layout .ant-pro-sider .ant-motion-collapse,
        .ant-pro-layout .ant-pro-sider .ant-motion-collapse-legacy-active {
          transition:
            height 0.15s cubic-bezier(0.33, 1, 0.68, 1),
            opacity 0.1s ease !important;
        }
        .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-submenu > .ant-menu-submenu-title {
          transition:
            background-color 0.12s cubic-bezier(0.33, 1, 0.68, 1),
            color 0.12s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow::before,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow::after {
          transition: transform 0.12s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        .ant-pro-layout .ant-pro-sider.ant-layout-sider {
          transition:
            width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            min-width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            max-width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            flex 0.18s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ant-pro-layout .ant-pro-sider .ant-motion-collapse,
          .ant-pro-layout .ant-pro-sider .ant-motion-collapse-legacy-active,
          .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-item,
          .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-submenu > .ant-menu-submenu-title,
          .ant-pro-layout .ant-pro-sider.ant-layout-sider {
            transition: none !important;
          }
        }
        /* 顶栏右侧操作按钮样式优化 - 遵循 Ant Design 规范 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header {
          flex-shrink: 0 !important;
          min-width: max-content !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-space,
        .ant-pro-layout .ant-layout-header .ant-space {
          gap: 8px !important;
          align-items: center !important;
        }
        /* AI 助手 Lottie 按钮与搜索框等垂直对齐 */
        .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.ai-assistant-lottie-btn-wrapper),
        .ant-pro-layout .ant-layout-header .ant-space-item:has(.ai-assistant-lottie-btn-wrapper),
        .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.header-search-wrapper),
        .ant-pro-layout .ant-layout-header .ant-space-item:has(.header-search-wrapper) {
          display: flex !important;
          align-items: center !important;
        }
        /* 搜索框与顶栏其他元素垂直居中，修正 Input 内部 baseline 导致的视觉偏低 */
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper,
        .ant-pro-layout .ant-layout-header .header-search-wrapper {
          display: inline-flex !important;
          align-items: center !important;
          align-self: center !important;
        }
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper .ant-input-affix-wrapper,
        .ant-pro-layout .ant-layout-header .header-search-wrapper .ant-input-affix-wrapper {
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 统一按钮样式 - 保留圆形背景，浅色背景时图标颜色统一为黑色 */
        /* 注意：这些样式会被之前的通用顶栏按钮样式覆盖，但保留这里作为备用和补充 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-btn {
          width: 32px !important;
          height: 32px !important;
          flex-shrink: 0 !important; // ⚠️ 防止挤压变形
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${headerActionChipBg} !important;
          border: none !important;
          transition: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        /* Badge 内按钮样式 - 与顶栏 .ant-btn 保持相同 flex 居中（antd 6.4+ 下缺此项会偏上） */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn {
          width: 32px !important;
          height: 32px !important;
          flex-shrink: 0 !important; // ⚠️ 防止挤压变形
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${headerActionChipBg} !important;
          transition: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* Badge 内按钮 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn {
          background-color: ${headerActionChipBgHover} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
          border-radius: 50% !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover svg,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 确保 Badge 本身无任何 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover,
        .ant-pro-layout .ant-layout-header .ant-badge:hover {
          background-color: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        /* 用户头像按钮样式 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar {
          border: none;
          box-shadow: none;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar:has(img),
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar:has(img) {
          background: transparent !important;
        }
        /* 顶栏文字头像：背景/字色跟随主题（避免透明底 + antd 默认灰底白字） */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar:not(:has(img)),
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-avatar:not(:has(img)) {
          background-color: var(--ant-colorPrimary) !important;
          color: var(--ant-colorTextLightSolid, #ffffff) !important;
        }
        /* 租户选择器样式 - 胶囊型，与搜索框一致 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper {
          padding: 0;
          transition: none !important;
        }
        /* 顶栏胶囊型按钮统一样式（租户选择器 - 与组织选择器完全一致），文字跟随系统 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper > span,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper > span {
          display: flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          gap: 6px !important;
          padding: 4px 12px !important;
          border-radius: 16px !important;
          background-color: ${headerActionChipBg} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
          height: 32px !important;
          line-height: 24px !important;
        }
        /* AI 助手 Lottie：浅色顶栏无底；深色顶栏用实心浅色圆托住小人，避免紫黑件融进海军蓝 */
        .ai-assistant-lottie-btn-wrapper {
          display: inline-flex;
          align-items: center;
          align-self: center;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn {
          display: block !important;
          position: relative !important;
          isolation: isolate;
          padding: 0 !important;
          margin: 0 !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          line-height: 0 !important;
          opacity: 1 !important;
          filter: none !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn svg,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn svg {
          opacity: 1 !important;
          filter: none !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn:hover,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn:hover {
          background: none !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn--dark-header::before,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn--dark-header::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 32px;
          height: 32px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: #f2f4f7;
          z-index: 0;
          pointer-events: none;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn--dark-header:hover::before,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn--dark-header:hover::before {
          background: #ffffff;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn--dark-header > *,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn--dark-header > * {
          position: relative;
          z-index: 1;
        }
        /* 上线向导：图标与文案间距 4px，!important 避免被 Space/主题覆盖 */
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-onboarding-space.ant-space,
        .ant-pro-layout .ant-layout-header .riveredge-header-onboarding-space.ant-space {
          gap: 4px !important;
          column-gap: 4px !important;
        }
        /* 租户选择器内的选择框样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: ${headerActionChipBg} !important;
          background: ${headerActionChipBg} !important;
          height: 32px !important;
        }
        /* 租户选择器文字颜色与字号 - 根据显示模式统一，深色背景时强制浅色，文字跟随系统 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input {
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-content-value,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-content-value,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-content,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-content {
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
        }
        /* 深色顶栏下组织选择器强制浅色文字（通过 data-header-light-text 标记，覆盖 Ant Design 默认） */
        /* Ant Design 6 使用 --select-color 控制文字颜色，需覆盖该变量 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .ant-pro-global-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .tenant-selector-select-light-text .ant-select {
          --select-color: rgba(255, 255, 255, 0.85) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-item,
        /* Ant Design 6 新结构：content-value、content、placeholder */
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-content-value,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-content,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-placeholder,
        .tenant-selector-select-light-text .ant-select .ant-select-content-value,
        .tenant-selector-select-light-text .ant-select .ant-select-content,
        .tenant-selector-select-light-text .ant-select .ant-select-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] > span,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] > span,
        /* 覆盖 Select 内部文字元素；或通过组件内 className 标记 */
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector *,
        .tenant-selector-select-light-text .ant-select .ant-select-selector,
        .tenant-selector-select-light-text .ant-select .ant-select-selector * {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix .anticon,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix .anticon,
        .tenant-selector-select-light-text .ant-select .ant-select-suffix,
        .tenant-selector-select-light-text .ant-select .ant-select-suffix .anticon {
          color: rgba(255, 255, 255, 0.65) !important;
        }
        /* 租户选择器箭头图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)'} !important;
        }
        /* 租户选择器所有状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: ${headerActionChipBgHover} !important;
        }
        /* 租户选择器 hover 和 focused 状态下的文字颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selection-item {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 租户选择器内部输入框样式 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          background: transparent !important;
        }
        /* 租户选择器文字左右边距 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          padding-left: 6px !important;
          padding-right: 18px !important;
        }
        /* 租户选择器切换图标样式 - 确保在右侧 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          right: 8px !important;
        }
        /* 禁用租户选择器 wrapper 的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper:hover,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper:hover {
          background-color: transparent !important;
        }
        /* 搜索框样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : headerActionChipBg} !important;
        }
        /* 搜索框文字颜色和占位符颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .ant-input {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .ant-input::placeholder {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.45)'} !important;
        }
        /* 搜索框图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)'} !important;
        }
        /* 手机模式下隐藏搜索框 */
        @media (max-width: 768px) {
          .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.ant-input-affix-wrapper),
          .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
            display: none !important;
          }
        }
        /* 搜索框 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper:hover {
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : headerActionChipBgHover} !important;
        }
        /* 搜索框聚焦时外侧框线强调，使用户意识到处于搜索状态 */
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper .ant-input-affix-wrapper-focused {
          border: none !important;
          box-shadow: 0 0 0 2px ${isLightModeLightBg ? token.colorPrimaryBorder : 'rgba(255, 255, 255, 0.5)'} !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : headerActionChipBgHover} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input {
          background-color: transparent !important;
          border: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 顶栏消息、手机预览等下拉框：统一无箭头、对齐 */
        .header-actions-dropdown.ant-dropdown {
          padding: 0 !important;
        }
        .header-actions-dropdown .ant-dropdown-arrow {
          display: none !important;
        }
        /* 顶栏消息未读角标：挂在 Button 伪元素上，DOM 与语言/主题按钮一致（Tooltip → Button） */
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-notification-btn--has-count,
        .ant-pro-layout .ant-layout-header .riveredge-header-notification-btn--has-count {
          position: relative !important;
          overflow: visible !important;
        }
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-notification-btn--has-count::after,
        .ant-pro-layout .ant-layout-header .riveredge-header-notification-btn--has-count::after {
          content: attr(data-unread-count);
          position: absolute;
          top: 0;
          inset-inline-end: 0;
          transform: translate(50%, -50%);
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: var(--ant-color-error);
          color: var(--ant-color-text-light-solid, #fff);
          font-size: 12px;
          line-height: 16px;
          text-align: center;
          font-weight: 500;
          box-shadow: 0 0 0 1px var(--ant-color-bg-container);
          pointer-events: none;
          z-index: 1;
        }
        .ant-pro-global-header{
          margin-inline: 0 !important;
        }
        .ant-layout-sider-children{
          padding-inline: 0 !important;
        }
        /* 侧栏搜索条：平铺/双列唯一几何真源（总高 40px = 上下各 5px + 输入 30px） */
        :root {
          --riveredge-sidebar-search-strip-height: 40px;
          --riveredge-sidebar-search-padding-inline: 16px;
          --riveredge-sidebar-search-input-height: 30px;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper {
          width: 100% !important;
          box-sizing: border-box !important;
          height: var(--riveredge-sidebar-search-strip-height) !important;
          min-height: var(--riveredge-sidebar-search-strip-height) !important;
          max-height: var(--riveredge-sidebar-search-strip-height) !important;
          padding: 0 var(--riveredge-sidebar-search-padding-inline) !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          flex-shrink: 0 !important;
          border-bottom: 1px solid var(--riveredge-sider-divider-color) !important;
        }
        html[data-sidebar-menu-layout="flat"] .ant-pro-sider .ant-pro-sider-extra {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper > div {
          width: 100% !important;
          min-width: 0 !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input {
          width: 100% !important;
          max-width: 100% !important;
          height: var(--riveredge-sidebar-search-input-height) !important;
          min-height: var(--riveredge-sidebar-search-input-height) !important;
          box-sizing: border-box;
          background: transparent !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper {
          display: flex !important;
          align-items: center !important;
          padding-inline: 4px !important;
          padding-block: 0 !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-prefix,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-suffix {
          display: flex !important;
          align-items: center !important;
          align-self: center !important;
          margin-block: 0 !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input {
          padding-left: 4px !important;
          padding-block: 0 !important;
          line-height: var(--riveredge-sidebar-search-input-height) !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-prefix .anticon,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-prefix .anticon svg {
          display: block !important;
          line-height: 1 !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper:hover {
          background: transparent !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper-focused,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper:focus-within {
          box-shadow: none !important;
          outline: none !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-prefix .anticon {
          color: ${isDarkMode ? 'rgba(255,255,255,0.65)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)')} !important;
          font-size: 14px !important;
        }
        /* 侧栏搜索框占位字符颜色：适配“明亮模式 + 深色背景” */
        .riveredge-sidebar-search-wrapper input::placeholder,
        .riveredge-sidebar-search-wrapper .ant-input::placeholder {
          color: ${isDarkMode ? 'rgba(255, 255, 255, 0.45)' : (siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.58)' : 'rgba(0, 0, 0, 0.25)')} !important;
        }
        /* 侧栏搜索框快捷键（拟物按键）：框线/底影与搜索条底边一致，不用浅色主题的 --river-border-color */
        .riveredge-sidebar-search-wrapper .topbar-search-shortcut-key {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 18px !important;
          min-width: 18px !important;
          line-height: 1 !important;
          margin-block: 0 !important;
          color: ${isDarkMode ? 'rgba(255,255,255,0.28)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.28)' : (token?.colorBorder ?? '#d9d9d9'))} !important;
          background: ${isDarkMode ? 'rgba(255,255,255,0.10)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.10)' : (token?.colorFillQuaternary ?? '#f5f5f5'))} !important;
          border: 1px solid ${
            siderTextColor === '#ffffff'
              ? 'rgba(255, 255, 255, 0.15)'
              : isDarkMode
                ? 'rgba(255, 255, 255, 0.12)'
                : (token?.colorBorder ?? 'rgba(0, 0, 0, 0.15)')
          } !important;
          box-shadow: 0 1px 0 ${
            siderTextColor === '#ffffff'
              ? 'rgba(255, 255, 255, 0.12)'
              : isDarkMode
                ? 'rgba(255, 255, 255, 0.10)'
                : (token?.colorBorder ?? '#d9d9d9')
          } !important;
          font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace !important;
          font-size: 12px !important;
        }
        /* LOGO 样式 - 设置 min-width 和垂直对齐 */
        .ant-pro-global-header-logo {
          min-width: 181px !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
          /* 手机端移除 min-width 限制 */
          @media (max-width: 1024px) {
            min-width: 0 !important;
          }
        }
        /* LOGO 图片垂直对齐 */
        .ant-pro-global-header-logo img {
          display: inline-block !important;
          vertical-align: middle !important;
          max-height: 32px !important;
          height: auto !important;
          width: auto !important;
        }
        /* LOGO 标题文字垂直对齐和颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-title,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-title,
        .ant-pro-layout-header .ant-pro-global-header-title,
        .ant-layout-header .ant-pro-global-header-title,
        .ant-pro-global-header-title {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          line-height: 1.5 !important;
          height: auto !important;
          font-size: 16px !important;
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
        }
        /* LOGO 容器内的链接和文字垂直对齐和颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo span,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo span,
        .ant-pro-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout-header .ant-pro-global-header-logo span,
        .ant-layout-header .ant-pro-global-header-logo a,
        .ant-layout-header .ant-pro-global-header-logo span,
        .ant-pro-global-header-logo a,
        .ant-pro-global-header-logo span {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          line-height: 1.5 !important;
          flex-shrink: 0 !important; // ⚠️ 防止 LOGO 组被挤压
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
        }
        .ant-pro-global-header-logo img {
          flex-shrink: 0 !important; // ⚠️ 防止图片变成椭圆
          object-fit: contain !important;
        }
        /* LOGO 后标题文字（H1元素）颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout-header .ant-pro-global-header-logo a h1,
        .ant-layout-header .ant-pro-global-header-logo h1,
        .ant-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-global-header-logo h1,
        .ant-pro-global-header-logo a h1 {
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
          ${isEnglishLocale ? 'letter-spacing: -0.02em !important;' : ''}
        }
        .ant-pro-global-header-logo h1{
        line-height: 31px !important;
        }
        /* ==================== 顶栏布局调整 ==================== */
        /* 顶栏主容器：左侧 LOGO组 + 分割线 + 面包屑，右侧 操作按钮组 */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 0 16px !important;
        }
        /* 顶栏左侧区域：LOGO组 + 分割线 + 面包屑 */
        .ant-pro-layout .ant-pro-layout-header > div:first-child,
        .ant-pro-layout .ant-layout-header > div:first-child {
          display: flex !important;
          align-items: center !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
        }
        /* headerContentRender 容器样式 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-content,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-content {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
          height: 100% !important;
        }
        /* headerContentRender 容器内的分割线垂直居中 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-content .ant-divider,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-content .ant-divider {
          align-self: center !important;
          margin: 0 !important;
          height: 32px !important;
          border-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.25)'} !important;
        }
        /* 顶栏快捷入口触发按钮 hover */
        .riveredge-header-quick-entry-trigger:hover {
          background: ${isLightModeLightBg ? token.colorFillTertiary : headerActionChipBgHover} !important;
        }
        /* ==================== 面包屑样式 ==================== */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
          font-size: 1em !important;
          line-height: 1.5 !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
          position: relative !important;
          white-space: nowrap !important;
          overflow: visible !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          max-width: none !important;
        }
        /* 面包屑内部容器防止换行；宽度不足时横向滚动 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb ul {
          display: flex !important;
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          max-width: 100% !important;
        }
        /* 面包屑项不收缩，避免只剩最后一级可见 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          overflow: visible !important;
          padding: 0 4px !important;
          line-height: 1.5 !important;
          vertical-align: middle !important;
        }
        /* 第一项左侧 padding，确保 hover 背景完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child {
          padding-left: 8px !important;
          margin-left: -8px !important;
        }
        /* 最后一个面包屑项不收缩，优先显示完整，确保对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child {
          flex-shrink: 0 !important;
          line-height: 1.5 !important;
          vertical-align: middle !important;
        }
        /* 最后一项内部的文本和链接，确保与其他项对齐（即使加粗） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child a {
          line-height: 1.5 !important;
          vertical-align: middle !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑分隔符防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-separator {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑内部文本防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb span,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb a {
          white-space: nowrap !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑链接内部的 gap - 图标和文字之间的间距 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-link span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item span {
          gap: 4px !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑项内部的链接和文字对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-link {
          display: inline-flex !important;
          align-items: center !important;
          padding: 4px 8px !important;
          margin: -4px -8px !important;
          border-radius: 4px !important;
        }
        /* 第一项链接的左侧 padding，确保 hover 背景完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child .ant-breadcrumb-link {
          margin-left: -8px !important;
          padding-left: 8px !important;
        }
        /* 面包屑下拉箭头对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .anticon {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
        }
        /* 面包屑文字颜色：浅色顶栏用深字；深色顶栏一律纯白（含分隔符/箭头） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item span {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : '#ffffff'} !important;
        }
        /* 末级：浅色顶栏用主题色；深色顶栏与其它级同为纯白 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .riveredge-breadcrumb-active,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .riveredge-breadcrumb-active {
          color: ${isLightModeLightBg ? token.colorPrimary : '#ffffff'} !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : '#ffffff'} !important;
        }
        /* 完全禁用面包屑项本身的 hover 背景（包括 Ant Design 默认样式） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:hover {
          background-color: transparent !important;
          background: transparent !important;
        }
        /* 面包屑链接 hover 样式 - 根据显示模式统一，浅色模式浅色背景无hover */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item a:hover,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .ant-breadcrumb-link:hover {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : '#ffffff'} !important;
          background-color: ${isLightModeLightBg ? 'transparent' : 'rgba(255, 255, 255, 0.1)'} !important;
          border-radius: 4px !important;
        }
        /* 确保当链接 hover 时，父级面包屑项本身不显示背景（但允许链接显示背景） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:hover {
          background-color: transparent !important;
        }
        /* 第一项链接 hover 时确保左侧背景完整显示 - 浅色模式浅色背景无hover */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child a:hover,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child .ant-breadcrumb-link:hover {
          margin-left: -8px !important;
          padding-left: 8px !important;
          background-color: ${isLightModeLightBg ? 'transparent' : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 面包屑分隔符颜色 - 深色顶栏纯白 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-separator {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : '#ffffff'} !important;
        }
        /* 面包屑图标（含下拉箭头）- 深色顶栏纯白 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : '#ffffff'} !important;
        }
        /* 面包屑下拉菜单样式优化 - 确保完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown {
          z-index: 1050 !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown-menu {
          max-height: 400px;
          overflow-y: auto;
        }
        /* 确保 header 和面包屑容器不裁剪下拉菜单 */
        .ant-pro-layout-container .ant-layout-header {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-pro-layout-header {
          overflow: visible !important;
        }
        /* 面包屑下拉菜单样式优化 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown {
          z-index: 1050 !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown-menu {
          max-height: 400px;
          overflow-y: auto;
        }
        /* 确保面包屑容器不裁剪下拉菜单 */
        .ant-pro-layout-container .ant-layout-header {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ul {
          overflow: visible !important;
        }
        /* 平板和手机模式下顶栏圆形按键/头像保持正圆，防止被 flex 拉伸变形 */
        @media (max-width: 991.98px) {
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions {
            align-items: center !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-space-item,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-space-item {
            align-self: center !important;
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-btn,
          .ant-pro-layout .ant-layout-header .ant-btn {
            min-height: 32px !important;
            max-height: 32px !important;
            flex-shrink: 0 !important;
            align-self: center !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn,
          .ant-pro-layout .ant-layout-header .ant-badge .ant-btn {
            min-width: 32px !important;
            max-width: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar,
          .ant-pro-layout .ant-layout-header .ant-btn .ant-avatar,
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-avatar {
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-dropdown-trigger,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-dropdown-trigger {
            align-self: center !important;
            height: auto !important;
          }
        }
        /* 平板和手机模式下隐藏面包屑 - 放在最后，确保最高优先级 */
        @media (max-width: 1024px) {
          .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
          .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb,
          body .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
          body .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }

        /* ==================== 双列侧栏菜单（颜色/交互与平铺 ant-pro-sider-menu 一致） ==================== */
        html[data-sidebar-menu-layout="split"] .ant-pro-sider .ant-pro-sider-menu {
          padding-inline: 0 !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar {
          display: flex;
          flex-direction: column;
          flex: 1 1 0;
          min-height: 0;
          height: 100%;
          background: ${siderBgColor} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-search {
          flex-shrink: 0;
          width: 100%;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-body {
          flex: 1 1 0;
          min-height: 0;
          display: grid;
          grid-template-columns: ${SPLIT_SIDEBAR_PRIMARY_WIDTH}px minmax(0, 1fr);
          overflow: hidden;
          background: ${siderBgColor} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-body.is-collapsed {
          grid-template-columns: minmax(0, 1fr);
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary {
          grid-column: 1;
          min-height: 0;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px 2px;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: none !important;
          border-inline-end: 1px solid var(--riveredge-sider-divider-color);
          background: ${siderBgColor} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary::-webkit-scrollbar-track,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary::-webkit-scrollbar-thumb {
          display: none !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-body.is-collapsed .riveredge-split-sidebar-primary {
          border-inline-end: none;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          width: 100%;
          min-height: 58px;
          padding: 2px 1px 4px;
          border: none;
          border-radius: ${token.borderRadius}px;
          background: transparent;
          color: ${siderTextColor};
          cursor: pointer;
          transition: background-color 0s, color 0s;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item:hover {
          background-color: transparent !important;
          color: ${siderTextColor} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item.is-active {
          background-color: transparent !important;
          color: ${siderTextColor} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: ${token.borderRadiusSM ?? token.borderRadius}px;
          background: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.05)' : 'var(--ant-colorFillQuaternary, var(--ant-colorFillTertiary))'} !important;
          color: ${siderTextColor} !important;
          transition: background-color 0s, color 0s;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item:hover .riveredge-split-sidebar-primary-icon {
          background: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.09)' : 'var(--ant-colorFillTertiary)'} !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item.is-active .riveredge-split-sidebar-primary-icon {
          background: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-icon .anticon,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-icon svg {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          width: 18px;
          height: 18px;
          line-height: 1;
          color: currentColor !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-label {
          font-size: 12px;
          line-height: 1.2;
          text-align: center;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: currentColor;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-primary-item.is-active .riveredge-split-sidebar-primary-label {
          color: var(--riveredge-menu-primary-color) !important;
          font-weight: 500;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary {
          grid-column: 2;
          min-width: 0;
          min-height: 0;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          scrollbar-width: none !important;
          background: ${siderBgColor} !important;
          --riveredge-split-menu-row-margin: 3px;
          --riveredge-split-menu-row-width: calc(100% - 6px);
          --riveredge-split-menu-pad-l1: 8px;
          --riveredge-split-menu-pad-l2: 22px;
          --riveredge-split-menu-pad-l3: 28px;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary::-webkit-scrollbar-track,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary::-webkit-scrollbar-thumb {
          display: none !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-menu.ant-pro-sider-menu {
          flex: 0 0 auto;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          border-inline-end: none !important;
          background: ${siderBgColor} !important;
          padding-top: 4px !important;
          padding-bottom: 8px !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu.ant-menu-inline .ant-menu-sub.ant-menu-inline {
          padding-inline-start: 0 !important;
        }
        /* 双列右栏行几何唯一真源：各层级 margin/width 一致，选中态只改颜色 */
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline > .ant-menu-item,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline > .ant-menu-submenu > .ant-menu-submenu-title {
          margin-inline: var(--riveredge-split-menu-row-margin) !important;
          width: var(--riveredge-split-menu-row-width) !important;
          max-width: var(--riveredge-split-menu-row-width) !important;
          box-sizing: border-box !important;
          border-radius: ${token.borderRadius}px !important;
          padding-inline-end: 6px !important;
          padding-inline-start: var(--riveredge-split-menu-pad-l1) !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline .ant-menu-sub > .ant-menu-item,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline .ant-menu-sub > .ant-menu-submenu > .ant-menu-submenu-title {
          margin-inline: var(--riveredge-split-menu-row-margin) !important;
          width: var(--riveredge-split-menu-row-width) !important;
          max-width: var(--riveredge-split-menu-row-width) !important;
          box-sizing: border-box !important;
          padding-inline-end: 6px !important;
          padding-inline-start: var(--riveredge-split-menu-pad-l2) !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline .ant-menu-sub .ant-menu-sub > .ant-menu-item,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .riveredge-split-sidebar-menu.ant-menu-inline .ant-menu-sub .ant-menu-sub > .ant-menu-submenu > .ant-menu-submenu-title {
          margin-inline: var(--riveredge-split-menu-row-margin) !important;
          width: var(--riveredge-split-menu-row-width) !important;
          max-width: var(--riveredge-split-menu-row-width) !important;
          box-sizing: border-box !important;
          padding-inline-end: 6px !important;
          padding-inline-start: var(--riveredge-split-menu-pad-l3) !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-title-content {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-item-group-title {
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-size: var(--ant-fontSizeSM) !important;
          font-weight: 500 !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu.ant-menu-dark .ant-menu-item.ant-menu-item-selected {
          background-color: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content a,
        html[data-sidebar-menu-layout="split"] .riveredge-split-sidebar-secondary .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content span {
          color: #fff !important;
        }
      `;
}

export function useBasicLayoutInlineStyles(ctx: BasicLayoutStyleContext) {
  const {
    token,
    isDarkMode,
    isLightModeLightBg,
    isLightModeDarkSider,
    isEnglishLocale,
    siderTextColor,
    siderBgColor,
    headerBgColor,
    headerTextColor,
    siderFooterToken,
    startMenuBaseRadius,
    startMenuPanelRadius,
    startMenuTheme,
  } = ctx;

  return useMemo(
    () => ({
      shellStyles: buildShellLayoutStyles(ctx),
      themeStyles: buildThemeLayoutStyles(ctx),
    }),
    [
      token.colorPrimary,
      token.colorBgLayout,
      token.colorBorder,
      token.colorBorderSecondary,
      token.borderRadius,
      token.borderRadiusLG,
      token.colorBgContainer,
      token.colorBgElevated,
      token.colorFillTertiary,
      token.colorPrimaryBorder,
      token.fontSize,
      isDarkMode,
      isLightModeLightBg,
      isLightModeDarkSider,
      isEnglishLocale,
      siderTextColor,
      siderBgColor,
      headerBgColor,
      headerTextColor,
      siderFooterToken.colorFillSecondary,
      siderFooterToken.colorFillTertiary,
      siderFooterToken.colorFillQuaternary,
      siderFooterToken.colorSplit,
      startMenuBaseRadius,
      startMenuPanelRadius,
      startMenuTheme,
    ],
  );
}
