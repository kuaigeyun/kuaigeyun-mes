/**
 * 右下角悬浮按钮
 *
 * 展示系统迭代提示、版本信息及意见反馈入口。
 * 是否显示由平台设置 float_button_enabled 控制。
 * 时间按系统设置的时区统一格式化显示。
 */

import React, { useState, useMemo } from 'react';
import { FloatButton, Modal, Typography, Spin } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getPlatformSettingsPublic, getPlatformVersion, type PlatformVersion } from '../../services/platformSettings';
import { useConfigStore } from '../../stores/configStore';
import { formatTimeInTimezone } from '../../utils/formatTimeInTimezone';

const { Paragraph, Link } = Typography;

const GIT_REPO_URL = 'https://gitee.com/kuaigeyun/kuaigeyun';

export default function IterationFloatButton() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const displayTimezone =
    useConfigStore((s) => s.configs?.timezone) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Shanghai';

  const { data: settings } = useQuery({
    queryKey: ['platformSettingsPublic'],
    queryFn: getPlatformSettingsPublic,
    staleTime: 60 * 1000,
  });

  const enabled = settings?.float_button_enabled !== false;

  const { data: version, isLoading: versionLoading } = useQuery({
    queryKey: ['platformVersion'],
    queryFn: getPlatformVersion,
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  const handleOpen = () => setVisible(true);

  const buildTimeDisplay = useMemo(
    () => formatTimeInTimezone(version?.build_time, displayTimezone),
    [version?.build_time, displayTimezone]
  );
  const gitTimeDisplay = useMemo(
    () => formatTimeInTimezone(version?.git_latest_commit_time, displayTimezone),
    [version?.git_latest_commit_time, displayTimezone]
  );

  if (!enabled) return null;

  return (
    <>
      <FloatButton
        icon={<InfoCircleOutlined />}
        type="primary"
        tooltip={t('components.iterationFloatButton.tooltip')}
        onClick={handleOpen}
        style={{ right: 24, bottom: 24 }}
      />
      <Modal
        title={t('components.iterationFloatButton.modalTitle')}
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={440}
        destroyOnHidden
      >
        <Spin spinning={versionLoading}>
          <div style={{ marginBottom: 20 }}>
            <Paragraph style={{ marginBottom: 12, color: 'rgba(0,0,0,0.85)' }}>
              {t('components.iterationFloatButton.iterationNotice')}
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 4, fontSize: 13 }}>
              {t('components.iterationFloatButton.buildTime')}: {buildTimeDisplay}
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 4, fontSize: 13 }}>
              {t('components.iterationFloatButton.gitLatestTime')}: {gitTimeDisplay}
            </Paragraph>
            <Link
              style={{ fontSize: 13 }}
              onClick={() => window.open(version?.git_repo_url || GIT_REPO_URL, '_blank')}
            >
              {t('components.iterationFloatButton.viewRepo')}
            </Link>
          </div>

          <div style={{ borderTop: '1px solid var(--river-divider-color)', paddingTop: 16 }}>
            <Paragraph strong style={{ marginBottom: 12 }}>
              {t('components.iterationFloatButton.feedbackTitle')}
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
              {t('components.iterationFloatButton.feedbackDesc')}
            </Paragraph>
            <img
              src="/img/qr_code.png"
              alt="WeChat QR"
              width={160}
              height={160}
              style={{ display: 'block' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect fill='%23f5f5f5' width='160' height='160'/%3E%3Ctext x='50%25' y='50%25' fill='%23999' text-anchor='middle' dy='.3em' font-size='14'%3EQR%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
        </Spin>
      </Modal>
    </>
  );
}
