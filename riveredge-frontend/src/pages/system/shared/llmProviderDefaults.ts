/**
 * 内置 LLM 提供商默认值（与后端 integration_settings.LLM_PROVIDER_SPECS 对齐）
 */

export const LLM_PROVIDER_IDS = [
  'deepseek',
  'openai',
  'qwen',
  'zhipu',
  'moonshot',
  'siliconflow',
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

export const LLM_PROVIDER_DEFAULTS: Record<
  LlmProviderId,
  { name: string; baseUrl: string; model: string }
> = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  moonshot: {
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-auto',
  },
  siliconflow: {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
};

export function isLlmProviderId(value: string): value is LlmProviderId {
  return (LLM_PROVIDER_IDS as readonly string[]).includes(value);
}
