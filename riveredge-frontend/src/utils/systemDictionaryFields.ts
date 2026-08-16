/**
 * 业务字段 dataIndex → 系统字典 code。
 * 展示唯一源：systemDictionary.{code}.item.{value}.label
 * 禁止页面再写第二套 dict map / salesReturn.dict.* / 裸码。
 */
export const SYSTEM_DICTIONARY_FIELD_CODES = {
  return_reason: 'RETURN_REASON',
  return_type: 'RETURN_TYPE',
  shipping_method: 'SHIPPING_METHOD',
  payment_terms: 'PAYMENT_TERMS',
} as const;

export type SystemDictionaryFieldDataIndex = keyof typeof SYSTEM_DICTIONARY_FIELD_CODES;

export function resolveSystemDictionaryFieldCode(dataIndex: string): string | undefined {
  if (dataIndex in SYSTEM_DICTIONARY_FIELD_CODES) {
    return SYSTEM_DICTIONARY_FIELD_CODES[dataIndex as SystemDictionaryFieldDataIndex];
  }
  return undefined;
}
