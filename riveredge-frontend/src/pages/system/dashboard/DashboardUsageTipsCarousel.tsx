/**
 * 工作台右栏：系统使用小提示 + 版本信息（单卡，上蓝渐变下浅 3:2）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from 'antd';
import { BulbOutlined, CopyOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { DASHBOARD_SECTION_CARD_CLASS } from './dashboardCardSurface';

const TIP_COUNT = 12;
const ROTATE_MS = 10000;
const FADE_MS = 320;

export interface DashboardUsageTipsCarouselProps {
  t: TFunction;
  cardRadius?: number | string;
  gitCommit?: string;
  buildTimeDisplay?: string;
  onCopyCommit?: () => void;
}

export function DashboardUsageTipsCarousel({
  t,
  cardRadius,
  gitCommit = '',
  buildTimeDisplay = '—',
  onCopyCommit,
}: DashboardUsageTipsCarouselProps) {
  const tips = useMemo(() => {
    const list: string[] = [];
    for (let i = 1; i <= TIP_COUNT; i += 1) {
      const key = `pages.dashboard.tip${i}`;
      const text = t(key);
      if (text && text !== key) list.push(text);
    }
    return list;
  }, [t]);

  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const commitText = gitCommit.trim() || '—';

  useEffect(() => {
    if (tips.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % tips.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [tips.length]);

  return (
    <Card
      variant="borderless"
      className={`dashboard-usage-tips-card ${DASHBOARD_SECTION_CARD_CLASS}`}
      style={{
        borderRadius: cardRadius,
        flexShrink: 0,
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div className="dashboard-usage-tips__top">
        <div className="dashboard-usage-tips__decor" aria-hidden="true">
          <span className="dashboard-usage-tips__decor-circle dashboard-usage-tips__decor-circle--lg" />
          <span className="dashboard-usage-tips__decor-circle dashboard-usage-tips__decor-circle--sm" />
        </div>
        {tips.length > 0 ? (
          <div className="dashboard-usage-tips__inner">
            <BulbOutlined className="dashboard-usage-tips__icon" aria-hidden />
            <div className="dashboard-usage-tips__viewport" aria-live="polite">
              <span
                className={`dashboard-usage-tips__text${fading ? ' dashboard-usage-tips__text--fading' : ''}`}
              >
                {tips[index]}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="dashboard-usage-tips-footer">
        <div className="dashboard-usage-tips-footer__row">
          <span className="dashboard-usage-tips-footer__label">{t('pages.dashboard.versionLabel')}</span>
          <span className="dashboard-version-badge">{commitText}</span>
          <Button
            type="text"
            size="small"
            className="dashboard-usage-tips-footer__copy-btn"
            icon={<CopyOutlined />}
            disabled={!gitCommit.trim()}
            onClick={onCopyCommit}
            aria-label={t('pages.dashboard.copyCommitAria')}
          />
        </div>
        <div className="dashboard-usage-tips-footer__build">
          {t('pages.dashboard.buildTimeLabel')}: {buildTimeDisplay}
        </div>
      </div>
    </Card>
  );
}

export default DashboardUsageTipsCarousel;
