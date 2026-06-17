import type { TFunction } from 'i18next';
import type { BootstrapStep, InitItem } from '../services/tenantInit';

export const TENANT_INIT_ITEM_NAME_I18N: Record<string, string> = {
  application: 'pages.system.configCenter.tenantInit.item.application',
  data_dictionary: 'pages.system.configCenter.tenantInit.item.data_dictionary',
  language: 'pages.system.configCenter.tenantInit.item.language',
  system_parameter: 'pages.system.configCenter.tenantInit.item.system_parameter',
  code_rule: 'pages.system.configCenter.tenantInit.item.code_rule',
  approval_process_preset: 'pages.system.configCenter.tenantInit.item.approval_process_preset',
  message_template_preset: 'pages.system.configCenter.tenantInit.item.message_template_preset',
  print_template_preset: 'pages.system.configCenter.tenantInit.item.print_template_preset',
  department_preset: 'pages.system.configCenter.tenantInit.item.department_preset',
  position_preset: 'pages.system.configCenter.tenantInit.item.position_preset',
  role_preset: 'pages.system.configCenter.tenantInit.item.role_preset',
  warehouse_preset: 'pages.system.configCenter.tenantInit.item.warehouse_preset',
  operation_preset: 'pages.system.configCenter.tenantInit.item.operation_preset',
  variant_attribute_preset: 'pages.system.configCenter.tenantInit.item.variant_attribute_preset',
  menu_sync: 'pages.system.configCenter.tenantInit.item.menu_sync',
  kuaiai_faq_preset: 'pages.system.configCenter.tenantInit.item.kuaiai_faq_preset',
};

export const TENANT_INIT_ITEM_DESC_I18N: Record<string, string> = {
  application: 'pages.system.configCenter.tenantInit.itemDesc.application',
  data_dictionary: 'pages.system.configCenter.tenantInit.itemDesc.data_dictionary',
  language: 'pages.system.configCenter.tenantInit.itemDesc.language',
  system_parameter: 'pages.system.configCenter.tenantInit.itemDesc.system_parameter',
  code_rule: 'pages.system.configCenter.tenantInit.itemDesc.code_rule',
  approval_process_preset: 'pages.system.configCenter.tenantInit.itemDesc.approval_process_preset',
  message_template_preset: 'pages.system.configCenter.tenantInit.itemDesc.message_template_preset',
  print_template_preset: 'pages.system.configCenter.tenantInit.itemDesc.print_template_preset',
  department_preset: 'pages.system.configCenter.tenantInit.itemDesc.department_preset',
  position_preset: 'pages.system.configCenter.tenantInit.itemDesc.position_preset',
  role_preset: 'pages.system.configCenter.tenantInit.itemDesc.role_preset',
  warehouse_preset: 'pages.system.configCenter.tenantInit.itemDesc.warehouse_preset',
  operation_preset: 'pages.system.configCenter.tenantInit.itemDesc.operation_preset',
  variant_attribute_preset: 'pages.system.configCenter.tenantInit.itemDesc.variant_attribute_preset',
  menu_sync: 'pages.system.configCenter.tenantInit.itemDesc.menu_sync',
  kuaiai_faq_preset: 'pages.system.configCenter.tenantInit.itemDesc.kuaiai_faq_preset',
};

/** Bootstrap 弹窗「应用注册」步骤标题（与 item.application 文案不同） */
export const TENANT_BOOTSTRAP_STEP_NAME_I18N: Record<string, string> = {
  application: 'components.tenantBootstrap.step.application',
};

export function tenantInitItemLabel(t: TFunction, item: Pick<InitItem, 'key' | 'name'>): string {
  const key = TENANT_BOOTSTRAP_STEP_NAME_I18N[item.key] ?? TENANT_INIT_ITEM_NAME_I18N[item.key];
  return key ? t(key) : item.name;
}

export function tenantInitItemDescription(
  t: TFunction,
  item: Pick<InitItem, 'key' | 'description'>,
): string {
  const key = TENANT_INIT_ITEM_DESC_I18N[item.key];
  return key ? t(key) : item.description;
}

export function tenantBootstrapStepLabel(t: TFunction, step: BootstrapStep): string {
  return tenantInitItemLabel(t, step);
}

export function tenantBootstrapStepDescription(t: TFunction, step: BootstrapStep): string {
  return tenantInitItemDescription(t, step);
}
