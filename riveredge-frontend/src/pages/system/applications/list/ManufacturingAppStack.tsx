/**
 * 快制造 / 进销存 / 快车间 组合卡（应用中心）
 * 左侧垂直 Tab 切换，总宽高与单张应用卡片一致
 */

import React, { useMemo, useState } from 'react';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAppDisplayName } from '../../../../utils/menuTranslation';

/** Tab 顺序（上 → 下，与侧栏应用名一致） */
export const MANUFACTURING_STACK_CODES = ['kuaizhizao', 'kuaierp', 'kuaimes'] as const;

export type ApplicationCardRenderOptions = {
  inManufacturingStack?: boolean;
};

export interface ManufacturingAppStackProps<T extends { uuid: string; code: string }> {
  apps: T[];
  renderCard: (app: T, index: number, options?: ApplicationCardRenderOptions) => React.ReactNode;
}

export function ManufacturingAppStack<T extends { uuid: string; code: string }>({
  apps,
  renderCard,
}: ManufacturingAppStackProps<T>) {
  const { t, i18n } = useTranslation();
  const { token } = theme.useToken();

  const ordered = useMemo(
    () => MANUFACTURING_STACK_CODES.map((code) => apps.find((a) => a.code === code)).filter((a): a is T => Boolean(a)),
    [apps],
  );

  const [activeCode, setActiveCode] = useState<string>(() => {
    const preferred = ordered.find((a) => a.code === 'kuaizhizao');
    return preferred?.code ?? ordered[0]?.code ?? 'kuaizhizao';
  });

  if (ordered.length === 0) return null;

  const activeIndex = Math.max(
    0,
    ordered.findIndex((a) => a.code === activeCode),
  );
  const activeApp = ordered[activeIndex] ?? ordered[0];

  return (
    <div className="manufacturing-app-stack">
      <div
        className="manufacturing-app-stack__tabs"
        role="tablist"
        aria-label={t('pages.system.applications.manufacturingStackTabList', { defaultValue: '制造应用切换' })}
      >
        {ordered.map((app) => {
          const isActive = app.code === activeApp.code;
          const lang = String(i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase();
          const baseLabel = getAppDisplayName(app.code, t, app.code);
          const abbr =
            app.code === 'kuaizhizao'
              ? 'UNI'
              : app.code === 'kuaierp'
                ? 'ERP'
                : app.code === 'kuaimes'
                  ? 'MES'
                  : null;
          const label = !lang.startsWith('zh') && abbr ? abbr : baseLabel;
          return (
            <button
              key={app.uuid}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={baseLabel}
              title={baseLabel}
              className={`manufacturing-app-stack__tab${isActive ? ' manufacturing-app-stack__tab--active' : ''}`}
              onClick={() => setActiveCode(app.code)}
              style={
                isActive
                  ? {
                      background: token.colorPrimary,
                      color: token.colorTextLightSolid,
                    }
                  : {
                      background: token.colorFillSecondary,
                      color: token.colorTextSecondary,
                    }
              }
            >
              <span className="manufacturing-app-stack__tab-label">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="manufacturing-app-stack__card-slot">
        {renderCard(activeApp, activeIndex, { inManufacturingStack: true })}
      </div>
    </div>
  );
}
