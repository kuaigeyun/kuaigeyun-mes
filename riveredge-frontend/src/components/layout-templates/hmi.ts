/**
 * HMI / 工作台 / 画板等非单据列表布局模板。
 * 与 layout-templates/index（列表/抽屉/表单）分离，避免工位终端等重模块进入单据列表 chunk。
 */

export { DashboardTemplate } from './DashboardTemplate';
export type {
  DashboardTemplateProps,
  QuickAction,
  TodoItem,
  DashboardStat,
  QuickEntry,
} from './DashboardTemplate';

export { WizardTemplate } from './WizardTemplate';
export type { WizardTemplateProps, WizardStep } from './WizardTemplate';

export { KanbanViewTemplate } from './KanbanViewTemplate';
export type { KanbanViewTemplateProps, KanbanColumn } from './KanbanViewTemplate';

export { TouchScreenTemplate } from './TouchScreenTemplate';
export type { TouchScreenTemplateProps, TouchScreenButton } from './TouchScreenTemplate';

export { CompareViewTemplate } from './CompareViewTemplate';
export type { CompareViewTemplateProps, CompareItem } from './CompareViewTemplate';

export { ParameterConfigTemplate } from './ParameterConfigTemplate';
export type {
  ParameterConfigTemplateProps,
  ParameterGroup,
  ParameterItem,
} from './ParameterConfigTemplate';

export { CalculationResultTemplate } from './CalculationResultTemplate';
export type {
  CalculationResultTemplateProps,
  CalculationExplanation,
} from './CalculationResultTemplate';

export { CanvasPageTemplate } from './CanvasPageTemplate';
export type {
  CanvasPageTemplateProps,
  CanvasPageSidePanelConfig,
  CanvasPageRightPanelConfig,
} from './CanvasPageTemplate';

export { default as PremiumTerminalTemplate } from './PremiumTerminalTemplate';
export type { PremiumTerminalTemplateProps } from './PremiumTerminalTemplate';

export { IframePageTemplate } from './IframePageTemplate';
export type { IframePageTemplateProps } from './IframePageTemplate';
