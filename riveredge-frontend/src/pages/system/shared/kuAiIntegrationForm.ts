import {
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MODEL,
  INTEGRATION_API_KEY_MASK,
} from '../../../utils/integrationSettings';

export const KU_AI_INTEGRATION_FORM_FIELDS = [
  'integrations.deepseek.enabled',
  'integrations.deepseek.model',
  'integrations.deepseek.base_url',
  'integrations.deepseek.api_key',
  'integrations.deepseek.tools_enabled',
  'integrations.deepseek.rag_enabled',
  'integrations.deepseek.rag_use_embedding',
  'integrations.deepseek.rag_backend',
  'integrations.deepseek.rag_top_k',
  'integrations.deepseek.custom_system_prompt',
  'integrations.deepseek.ocr_base_url',
  'integrations.deepseek.ocr_model',
  'integrations.deepseek.ocr_api_key',
] as const;

export function buildKuAiIntegrationFormValues(
  integrations?: Record<string, any> | null,
): Record<string, unknown> {
  const deepseek = integrations?.deepseek;
  return {
    'integrations.deepseek.enabled': deepseek?.enabled === true,
    'integrations.deepseek.api_key': '',
    'integrations.deepseek.model': deepseek?.model ?? DEEPSEEK_DEFAULT_MODEL,
    'integrations.deepseek.base_url': deepseek?.base_url ?? DEEPSEEK_DEFAULT_BASE_URL,
    'integrations.deepseek.tools_enabled': deepseek?.tools_enabled !== false,
    'integrations.deepseek.rag_enabled': deepseek?.rag_enabled !== false,
    'integrations.deepseek.rag_use_embedding': deepseek?.rag_use_embedding !== false,
    'integrations.deepseek.rag_backend': deepseek?.rag_backend ?? 'native',
    'integrations.deepseek.rag_top_k': deepseek?.rag_top_k ?? 5,
    'integrations.deepseek.custom_system_prompt': deepseek?.custom_system_prompt ?? '',
    'integrations.deepseek.ocr_base_url': deepseek?.ocr_base_url ?? '',
    'integrations.deepseek.ocr_model': deepseek?.ocr_model ?? '',
    'integrations.deepseek.ocr_api_key': '',
  };
}

export function buildKuAiIntegrationSettingsPayload(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const deepseekApiKey = String(values['integrations.deepseek.api_key'] ?? '').trim();
  const deepseekOcrApiKey = String(values['integrations.deepseek.ocr_api_key'] ?? '').trim();
  const deepseekPayload: Record<string, unknown> = {
    enabled: values['integrations.deepseek.enabled'] === true,
    model:
      String(values['integrations.deepseek.model'] ?? DEEPSEEK_DEFAULT_MODEL).trim() ||
      DEEPSEEK_DEFAULT_MODEL,
    base_url:
      String(values['integrations.deepseek.base_url'] ?? DEEPSEEK_DEFAULT_BASE_URL).trim() ||
      DEEPSEEK_DEFAULT_BASE_URL,
    tools_enabled: values['integrations.deepseek.tools_enabled'] !== false,
    rag_enabled: values['integrations.deepseek.rag_enabled'] !== false,
    rag_use_embedding: values['integrations.deepseek.rag_use_embedding'] !== false,
    rag_backend: String(values['integrations.deepseek.rag_backend'] ?? 'native').trim() || 'native',
    rag_top_k: Number(values['integrations.deepseek.rag_top_k']) || 5,
    custom_system_prompt: String(values['integrations.deepseek.custom_system_prompt'] ?? '').trim(),
    ocr_base_url: String(values['integrations.deepseek.ocr_base_url'] ?? '').trim(),
    ocr_model: String(values['integrations.deepseek.ocr_model'] ?? '').trim(),
  };
  if (deepseekApiKey && deepseekApiKey !== INTEGRATION_API_KEY_MASK) {
    deepseekPayload.api_key = deepseekApiKey;
  }
  if (deepseekOcrApiKey && deepseekOcrApiKey !== INTEGRATION_API_KEY_MASK) {
    deepseekPayload.ocr_api_key = deepseekOcrApiKey;
  }
  return { deepseek: deepseekPayload };
}
