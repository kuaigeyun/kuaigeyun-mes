/**
 * 站点集成设置常量（与后端 integration_settings.py 对齐）
 */
export const INTEGRATION_API_KEY_MASK = '********';

export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';

export const DEEPSEEK_V4_MODEL_OPTIONS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
] as const;

/** OCR 视觉端点示例（DeepSeek 官方 API 不支持 image_url，需单独配置） */
export const DEEPSEEK_OCR_EXAMPLE_BASE_URL = 'https://api.siliconflow.cn/v1';
export const DEEPSEEK_OCR_EXAMPLE_MODEL = 'deepseek-ai/DeepSeek-OCR';
