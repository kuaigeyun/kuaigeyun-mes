import React from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { Card, Button, Space, Typography, Progress, theme } from 'antd';
import { CloseOutlined, ArrowRightOutlined, ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../stores/themeStore';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { useGuideStore } from './store';

const { Title, Paragraph, Text } = Typography;

/**
 * 自定义引导气泡组件
 */
export const GuideTooltip: React.FC<TooltipRenderProps> = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  size,
  isLastStep,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);
  const { stopGuide } = useGuideStore();

  const handleDontShowAgain = () => {
    updatePreferences({ 'ui.show_onboarding_guide': false });
    stopGuide();
  };

  return (
    <Card
      {...tooltipProps}
      style={{
        maxWidth: 400,
        boxShadow: token.boxShadowSecondary,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
      styles={{ body: {padding: '20px' } }}
      actions={[
        <div key="footer" style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {index > 0 ? (
              <Button {...backProps} size="small" icon={<ArrowLeftOutlined />}>
                {t('common.back', '上一步')}
              </Button>
            ) : (
              <Button type="link" size="small" onClick={handleDontShowAgain} style={{ color: token.colorTextDescription, padding: 0 }}>
                不再显示
              </Button>
            )}
          </Space>
          <Space>
            {!isLastStep ? (
              <Button {...primaryProps} type="primary" size="small" icon={<ArrowRightOutlined />}>
                {t('common.next', '下一步')}
              </Button>
            ) : (
              <Button {...primaryProps} type="primary" size="small" icon={<CheckOutlined />}>
                {t('common.finish', '完成')}
              </Button>
            )}
          </Space>
        </div>,
      ]}
    >
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Button {...closeProps} type="text" size="small" icon={<CloseOutlined />} />
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0, paddingRight: 24 }}>
          {step.title}
        </Title>
        <div style={{ marginTop: 4 }}>
          <Progress 
            percent={Math.round(((index + 1) / size) * 100)} 
            size="small" 
            showInfo={false} 
            strokeColor={token.colorPrimary}
            trailColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            步骤 {index + 1} / {size}
          </Text>
        </div>
      </div>

      <Paragraph style={{ margin: 0, color: token.colorTextSecondary, fontSize: 14 }}>
        {step.content}
      </Paragraph>
    </Card>
  );
};

export default GuideTooltip;
