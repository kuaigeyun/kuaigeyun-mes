import React, { useEffect, useState } from 'react';
import { App, Button, Descriptions, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormModalGridBlock } from '../../../components/layout-templates';
import { getWecomDeploymentGuide, type WeComDeploymentGuide } from '../../../services/applicationConnection';

type WeComDeploymentGuideBlockProps = {
  corpId?: string;
  agentId?: string;
};

export const WeComDeploymentGuideBlock: React.FC<WeComDeploymentGuideBlockProps> = ({
  corpId,
  agentId,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<WeComDeploymentGuide | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getWecomDeploymentGuide({
      corp_id: corpId?.trim() || undefined,
      agent_id: agentId?.trim() ? Number(agentId) : undefined,
    })
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .catch(() => {
        if (!cancelled) setGuide(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [corpId, agentId]);

  const copy = async (value: string, label: string) => {
    if (!value) {
      message.warning(t('pages.system.applicationConnections.wecomGuide.copyEmpty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      message.success(t('pages.system.applicationConnections.wecomGuide.copied', { label }));
    } catch {
      message.error(t('pages.system.applicationConnections.wecomGuide.copyFailed'));
    }
  };

  if (loading) {
    return (
      <FormModalGridBlock>
        <Spin size="small" />
      </FormModalGridBlock>
    );
  }

  if (!guide) {
    return null;
  }

  const rows: { label: string; value: string }[] = [
    {
      label: t('pages.system.applicationConnections.wecomGuide.trustedDomain'),
      value: guide.trusted_domain,
    },
    {
      label: t('pages.system.applicationConnections.wecomGuide.oauthCallback'),
      value: guide.oauth_callback_url,
    },
    {
      label: t('pages.system.applicationConnections.wecomGuide.workbenchHome'),
      value: guide.workbench_home_url,
    },
  ];
  if (guide.login_with_agent_url) {
    rows.push({
      label: t('pages.system.applicationConnections.wecomGuide.loginWithAgent'),
      value: guide.login_with_agent_url,
    });
  }

  return (
    <FormModalGridBlock>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {t('pages.system.applicationConnections.wecomGuide.intro')}
      </Typography.Paragraph>
      <Descriptions column={1} size="small" bordered>
        {rows.map((row) => (
          <Descriptions.Item key={row.label} label={row.label}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Typography.Text code style={{ wordBreak: 'break-all', flex: 1 }}>
                {row.value || '—'}
              </Typography.Text>
              {row.value ? (
                <Button size="small" onClick={() => void copy(row.value, row.label)}>
                  {t('common.copy')}
                </Button>
              ) : null}
            </div>
          </Descriptions.Item>
        ))}
      </Descriptions>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        {t('pages.system.applicationConnections.wecomGuide.nextSteps')}
      </Typography.Paragraph>
    </FormModalGridBlock>
  );
};
