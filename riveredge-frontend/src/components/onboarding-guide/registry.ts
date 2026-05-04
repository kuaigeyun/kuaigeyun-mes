import type { Step } from 'react-joyride';

export interface GuideConfig {
  id: string;
  steps: Step[];
}

/**
 * 引导配置注册表
 */
export const GUIDE_REGISTRY: Record<string, GuideConfig> = {
  // 工作台/仪表盘引导
  dashboard: {
    id: 'dashboard',
    steps: [
      {
        target: '.ant-layout-sider',
        title: '侧边导航',
        content: '这里可以访问系统的所有功能模块，支持收起以获得更大视野。',
        placement: 'right',
      },
      {
        target: '.ant-pro-global-header',
        title: '全局工具栏',
        content: '在这里切换组织、搜索功能、查看消息或管理个人账号。',
        placement: 'bottom',
      },
      {
        target: '#workbench-quick-entry',
        title: '快捷入口',
        content: '您可以将常用功能收藏在这里，实现高效办公。',
        placement: 'bottom',
      },
    ],
  },
  // 打印模板管理引导
  printTemplates: {
    id: 'printTemplates',
    steps: [
      {
        target: '.ant-btn-primary',
        title: '创建模板',
        content: '点击这里开始设计您的第一个打印模板。',
        placement: 'bottom',
      },
      {
        target: '.ant-table-thead',
        title: '模板列表',
        content: '管理所有已有的打印模板，支持编辑和预览。',
        placement: 'bottom',
      },
    ],
  },
};

export default GUIDE_REGISTRY;
