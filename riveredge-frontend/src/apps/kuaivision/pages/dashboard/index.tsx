import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EyeOutlined,
  ClusterOutlined,
  CloseCircleOutlined,
  AuditOutlined,
  CameraOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { InputNumber, Switch, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
} from '../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../kuaizhizao/components/module-center';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import {
  getDashboardSummary,
  getVisionSettings,
  updateVisionSettings,
  type DashboardSummary,
} from '../../services/kuaivision';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [requirePublished, setRequirePublished] = useState(false);
  const [offlineTimeout, setOfflineTimeout] = useState(60);
  const [imageRetention, setImageRetention] = useState(90);
  const [eventRetention, setEventRetention] = useState(180);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, settings] = await Promise.all([getDashboardSummary(), getVisionSettings()]);
      setSummary(sum);
      setRequirePublished(Boolean(settings.require_published_recipe));
      setOfflineTimeout(Number(settings.offline_timeout_seconds || 60));
      setImageRetention(Number(settings.image_retention_days || 90));
      setEventRetention(Number(settings.event_retention_days || 180));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'events',
        title: t('app.kuaivision.kpi.eventsToday'),
        value: summary?.events_today ?? 0,
        subtitle:
          summary?.ok_rate_today != null
            ? t('app.kuaivision.kpi.okRate', {
                rate: Math.round(Number(summary.ok_rate_today) * 100),
              })
            : undefined,
        icon: <EyeOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaivision/inspections'),
      },
      {
        key: 'pending',
        title: t('app.kuaivision.kpi.pendingReviews'),
        value: summary?.pending_reviews ?? 0,
        icon: <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
        onClick: () => navigate('/apps/kuaivision/reviews'),
      },
      {
        key: 'ng',
        title: t('app.kuaivision.kpi.ngToday'),
        value: summary?.ng_today ?? 0,
        icon: <CloseCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaivision/inspections'),
      },
      {
        key: 'agents',
        title: t('app.kuaivision.kpi.agents'),
        value: `${summary?.agent_enabled ?? 0} / ${summary?.agent_count ?? 0}`,
        subtitle: summary?.last_agent_heartbeat_at
          ? t('app.kuaivision.kpi.lastHeartbeat', {
              time: formatDateTimeBySiteSetting(summary.last_agent_heartbeat_at),
            })
          : t('app.kuaivision.kpi.noHeartbeat'),
        icon: <ClusterOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaivision/agents'),
      },
    ],
    [navigate, summary, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'inspections',
        title: t('app.kuaivision.menu.inspections'),
        icon: <EyeOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaivision/inspections',
      },
      {
        key: 'reviews',
        title: t('app.kuaivision.menu.reviews'),
        icon: <AuditOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaivision/reviews',
      },
      {
        key: 'cameras',
        title: t('app.kuaivision.menu.cameras'),
        icon: <CameraOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaivision/cameras',
      },
      {
        key: 'recipes',
        title: t('app.kuaivision.menu.recipes'),
        icon: <ExperimentOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
        path: '/apps/kuaivision/recipes',
      },
      {
        key: 'samples',
        title: t('app.kuaivision.menu.samples'),
        icon: <ExperimentOutlined style={{ fontSize: 22, color: '#eb2f96' }} />,
        path: '/apps/kuaivision/samples',
      },
      {
        key: 'models',
        title: t('app.kuaivision.menu.models'),
        icon: <ExperimentOutlined style={{ fontSize: 22, color: '#2f54eb' }} />,
        path: '/apps/kuaivision/models',
      },
      {
        key: 'agents',
        title: t('app.kuaivision.menu.agents'),
        icon: <ClusterOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaivision/agents',
      },
    ],
    [t],
  );

  return (
    <ModuleCenterLayout
      loading={loading && !summary}
      showSidebar={false}
      kpiRow={<ModuleKpiRow items={kpis} colProps={{ xs: 24, sm: 12, lg: 6 }} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      fullWidthRow={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 6,
              background: '#f7f8fa',
            }}
          >
            <Typography.Text>{t('app.kuaivision.settings.requirePublished')}</Typography.Text>
            <Switch
              checked={requirePublished}
              loading={settingsSaving}
              onChange={async (checked) => {
                setSettingsSaving(true);
                try {
                  const res = await updateVisionSettings({ require_published_recipe: checked });
                  setRequirePublished(Boolean(res.require_published_recipe));
                } finally {
                  setSettingsSaving(false);
                }
              }}
            />
            <Typography.Text type="secondary">
              {t('app.kuaivision.settings.requirePublishedHint')}
            </Typography.Text>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 6,
              background: '#f7f8fa',
            }}
          >
            <Typography.Text>{t('app.kuaivision.settings.offlineTimeout')}</Typography.Text>
            <InputNumber
              min={10}
              max={3600}
              value={offlineTimeout}
              disabled={settingsSaving}
              onChange={async (value) => {
                const next = Number(value || 60);
                setOfflineTimeout(next);
                setSettingsSaving(true);
                try {
                  const res = await updateVisionSettings({ offline_timeout_seconds: next });
                  setOfflineTimeout(Number(res.offline_timeout_seconds || next));
                } finally {
                  setSettingsSaving(false);
                }
              }}
            />
            <Typography.Text type="secondary">
              {t('app.kuaivision.settings.offlineTimeoutHint')}
            </Typography.Text>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '12px 16px',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 6,
              background: '#f7f8fa',
            }}
          >
            <Typography.Text>{t('app.kuaivision.settings.imageRetention')}</Typography.Text>
            <InputNumber
              min={1}
              max={3650}
              value={imageRetention}
              disabled={settingsSaving}
              onChange={async (value) => {
                const next = Number(value || 90);
                setImageRetention(next);
                setSettingsSaving(true);
                try {
                  const res = await updateVisionSettings({ image_retention_days: next });
                  setImageRetention(Number(res.image_retention_days || next));
                } finally {
                  setSettingsSaving(false);
                }
              }}
            />
            <Typography.Text>{t('app.kuaivision.settings.eventRetention')}</Typography.Text>
            <InputNumber
              min={1}
              max={3650}
              value={eventRetention}
              disabled={settingsSaving}
              onChange={async (value) => {
                const next = Number(value || 180);
                setEventRetention(next);
                setSettingsSaving(true);
                try {
                  const res = await updateVisionSettings({ event_retention_days: next });
                  setEventRetention(Number(res.event_retention_days || next));
                } finally {
                  setSettingsSaving(false);
                }
              }}
            />
            <Typography.Text type="secondary">
              {t('app.kuaivision.settings.retentionHint')}
            </Typography.Text>
          </div>
        </div>
      }
    />
  );
};

export default DashboardPage;
