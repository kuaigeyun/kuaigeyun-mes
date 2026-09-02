/**
 * 右下角悬浮按钮
 *
 * 展示系统迭代提示、版本信息、构建来源及意见反馈入口。
 * 是否显示由平台设置 float_button_enabled 控制（仅显式为 true 时展示；加载中或接口失败默认隐藏）。
 */

import React, { useState, useMemo } from 'react';
import { Alert, FloatButton, Modal, Tag, Typography, Spin } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getPlatformSettingsPublic,
  getPlatformVersion,
  getBuildProvenance,
  getTelemetryDisclosureUrl,
  type BuildProvenanceStatus,
} from '../../services/platformSettings';
import { useConfigStore } from '../../stores/configStore';
import { formatTimeInTimezone } from '../../utils/formatTimeInTimezone';

const { Paragraph, Link } = Typography;

const GIT_REPO_URL = 'https://gitee.com/kuaigeyun/kuaigeyun';
const OFFICIAL_SITE = 'https://kuaigeyun.com';

const UNVERIFIED_STATUSES: BuildProvenanceStatus[] = [
  'unverified_commit',
  'unverified_build',
];

function provenanceTagColor(status: BuildProvenanceStatus): string {
  if (status === 'official_self_hosted') return 'success';
  if (status === 'official_unknown_commit') return 'processing';
  if (UNVERIFIED_STATUSES.includes(status)) return 'warning';
  return 'default';
}

export default function IterationFloatButton() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const displayTimezone = useConfigStore((s) => {
    const tz = s.configs?.timezone;
    return tz != null ? String(tz).trim() : '';
  });

  const { data: settings } = useQuery({
    queryKey: ['platformSettingsPublic'],
    queryFn: getPlatformSettingsPublic,
    staleTime: 60 * 1000,
  });

  const enabled = settings?.float_button_enabled === true;

  const { data: version, isLoading: versionLoading } = useQuery({
    queryKey: ['platformVersion'],
    queryFn: getPlatformVersion,
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  const { data: provenance, isLoading: provenanceLoading } = useQuery({
    queryKey: ['buildProvenance'],
    queryFn: getBuildProvenance,
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  const handleOpen = () => setVisible(true);

  const buildTimeDisplay = useMemo(
    () =>
      displayTimezone
        ? formatTimeInTimezone(version?.build_time || provenance?.build_time, displayTimezone)
        : '-',
    [version?.build_time, provenance?.build_time, displayTimezone]
  );
  const gitTimeDisplay = useMemo(
    () =>
      displayTimezone
        ? formatTimeInTimezone(version?.git_latest_commit_time, displayTimezone)
        : '-',
    [version?.git_latest_commit_time, displayTimezone]
  );

  const status = provenance?.status ?? 'unknown';
  const showUnverifiedAlert = UNVERIFIED_STATUSES.includes(status as BuildProvenanceStatus);
  const loading = versionLoading || provenanceLoading;

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
        <Spin spinning={loading}>
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
            {(provenance?.git_commit || version?.git_commit) && (
              <Paragraph type="secondary" style={{ marginBottom: 4, fontSize: 13 }}>
                {t('components.iterationFloatButton.gitCommit')}:{' '}
                {provenance?.git_commit || version?.git_commit}
              </Paragraph>
            )}
            <Link
              style={{ fontSize: 13 }}
              onClick={() => window.open(version?.git_repo_url || GIT_REPO_URL, '_blank')}
            >
              {t('components.iterationFloatButton.viewRepo')}
            </Link>
          </div>

          {provenance && (
            <div style={{ marginBottom: 20 }}>
              <Paragraph strong style={{ marginBottom: 8, fontSize: 13 }}>
                {t('components.iterationFloatButton.provenanceTitle')}
              </Paragraph>
              <Tag color={provenanceTagColor(status as BuildProvenanceStatus)}>
                {t(`components.iterationFloatButton.provenanceStatus.${status}`)}
              </Tag>
              {provenance.build_git_remote && (
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 4, fontSize: 12 }}>
                  {provenance.build_git_remote_is_official
                    ? t('components.iterationFloatButton.officialRemote')
                    : provenance.build_git_remote}
                </Paragraph>
              )}
              {showUnverifiedAlert && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 8 }}
                  title={t('components.iterationFloatButton.unverifiedAlert')}
                  description={
                    <Link onClick={() => window.open(provenance.official_site || OFFICIAL_SITE, '_blank')}>
                      {t('components.iterationFloatButton.viewOfficialSite')}
                    </Link>
                  }
                />
              )}
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 11 }}>
                <Link href={getTelemetryDisclosureUrl(provenance.telemetry_disclosure_path)} target="_blank">
                  {t('components.iterationFloatButton.telemetryDisclosure')}
                </Link>
              </Paragraph>
            </div>
          )}

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
