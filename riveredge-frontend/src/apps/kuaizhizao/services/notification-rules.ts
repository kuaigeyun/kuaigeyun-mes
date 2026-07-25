import { apiRequest } from '../../../services/api'

/** 加载快制造消息提醒规则预设（幂等；会先补齐对应消息模板） */
export function loadKuaizhizaoNotificationRulePresets(): Promise<{
  created: number
  updated: number
  repaired_templates?: number
  templates_created?: number
  skipped_duplicate: number
  skipped_missing_template: number
  total_rules: number
}> {
  return apiRequest('/apps/kuaizhizao/config/notification-rules/load-presets', {
    method: 'POST',
  })
}
