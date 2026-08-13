/**
 * 展示从 Logo 提取的差异主色，供选用为站点主题色。
 */

import React, { useEffect, useState } from 'react';
import { App, Button, Empty, Modal, Space, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  extractDistinctLogoThemeColors,
  type ExtractedThemeColor,
} from '../../utils/extractLogoThemeColors';

export type LogoThemeColorModalProps = {
  open: boolean;
  logoUrl?: string;
  currentThemeHex?: string;
  onCancel: () => void;
  onApply: (hex: string) => void | Promise<void>;
};

function formatWeight(weight: number): string {
  const pct = Math.round(weight * 1000) / 10;
  return `${pct}%`;
}

export const LogoThemeColorModal: React.FC<LogoThemeColorModalProps> = ({
  open,
  logoUrl,
  currentThemeHex,
  onCancel,
  onApply,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [colors, setColors] = useState<ExtractedThemeColor[]>([]);
  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setColors([]);
    setSelected(undefined);
    void (async () => {
      try {
        if (!logoUrl) {
          throw new Error('LOGO_IMAGE_MISSING');
        }
        const extracted = await extractDistinctLogoThemeColors(logoUrl);
        if (cancelled) return;
        setColors(extracted);
        setSelected(extracted[0]?.hex);
      } catch (error: any) {
        if (cancelled) return;
        const code = error?.message;
        const key =
          code === 'LOGO_CANVAS_TAINTED'
            ? 'pages.system.siteSettings.logoThemeColorTainted'
            : code === 'LOGO_NO_THEME_COLOR' || code === 'LOGO_IMAGE_MISSING'
              ? 'pages.system.siteSettings.logoThemeColorEmpty'
              : 'pages.system.siteSettings.logoThemeColorFailed';
        messageApi.error(t(key));
        setColors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, logoUrl, messageApi, t]);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await onApply(selected);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      title={t('pages.system.siteSettings.logoThemeColorTitle')}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      mask={{ closable: !applying }}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={applying}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={applying} disabled={!selected || loading} onClick={() => void handleApply()}>
            {t('pages.system.siteSettings.logoThemeColorApply')}
          </Button>
        </Space>
      }
      width={560}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('pages.system.siteSettings.logoThemeColorHint')}
      </Typography.Paragraph>
      <Spin spinning={loading || applying}>
        {!loading && colors.length === 0 ? (
          <Empty description={t('pages.system.siteSettings.logoThemeColorEmpty')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {colors.map((c, index) => {
              const active = selected === c.hex;
              const isCurrent =
                typeof currentThemeHex === 'string' &&
                currentThemeHex.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={`${c.hex}-${index}`}
                  type="button"
                  onClick={() => setSelected(c.hex)}
                  disabled={applying}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: active
                      ? '2px solid var(--ant-color-primary, #1677ff)'
                      : '1px solid var(--river-border-color, #d9d9d9)',
                    background: 'var(--ant-color-bg-container, #fff)',
                    cursor: applying ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: c.hex,
                      border: '1px solid rgba(0,0,0,0.12)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong>
                      {t('pages.system.siteSettings.logoThemeColorRank', { rank: index + 1 })}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {c.hex.toUpperCase()}{' '}
                      {formatWeight(c.weight)}
                      {isCurrent ? ` ${t('pages.system.siteSettings.logoThemeColorCurrent')}` : ''}
                    </Typography.Text>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Spin>
    </Modal>
  );
};
