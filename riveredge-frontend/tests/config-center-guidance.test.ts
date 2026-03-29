import { describe, expect, it } from 'vitest';

import zhCN from '../src/locales/zh-CN';
import enUS from '../src/locales/en-US';
import { getParamGuidanceI18nKey } from '../src/pages/system/config-center/index';

describe('config center guidance mapping', () => {
  it('returns i18n key for new SME params', () => {
    expect(getParamGuidanceI18nKey('work_order.material_shortage_block_level')).toBe(
      'pages.system.configCenter.param.work_order_material_shortage_block_level_guide'
    );
    expect(getParamGuidanceI18nKey('purchase.tolerance_percentage')).toBe(
      'pages.system.configCenter.param.purchase_tolerance_percentage_guide'
    );
  });

  it('mapped keys exist in zh-CN and en-US locale packs', () => {
    const keys = [
      getParamGuidanceI18nKey('work_order.material_shortage_block_level'),
      getParamGuidanceI18nKey('purchase.tolerance_percentage'),
    ].filter(Boolean) as string[];

    for (const key of keys) {
      expect(zhCN[key]).toBeTruthy();
      expect(enUS[key]).toBeTruthy();
    }
  });
});
