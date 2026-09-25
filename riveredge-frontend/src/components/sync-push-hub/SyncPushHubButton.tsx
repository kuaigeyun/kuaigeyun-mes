/**
 * 工具栏「同步/推送」统一入口按钮 + Hub 弹窗。
 */
import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  SyncPushHubModal,
  type SyncPushHubModalProps,
  type SyncPushHubTabKey,
} from './SyncPushHubModal';

export interface SyncPushHubButtonProps
  extends Omit<SyncPushHubModalProps, 'open' | 'onClose'>,
    Omit<ButtonProps, 'onClick' | 'children' | 'icon'> {
  /** 覆盖默认按钮文案 */
  buttonText?: React.ReactNode;
  /** 仅图标（窄屏） */
  iconOnly?: boolean;
  /** 打开时默认 Tab */
  defaultTab?: SyncPushHubTabKey;
  /** 外层包装（如 SyncFreshnessBadge） */
  wrapButton?: (button: React.ReactElement) => React.ReactNode;
}

export const SyncPushHubButton: React.FC<SyncPushHubButtonProps> = ({
  syncEnabled = true,
  pushEnabled = true,
  syncTitle,
  pushTitle,
  title,
  width,
  zIndex,
  defaultTab,
  renderSyncPanel,
  renderPushPanel,
  syncPanel,
  pushPanel,
  buttonText,
  iconOnly = false,
  wrapButton,
  type = 'default',
  size,
  ...buttonRest
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const showSync = Boolean(syncEnabled) && Boolean(renderSyncPanel || syncPanel);
  const showPush = Boolean(pushEnabled) && Boolean(renderPushPanel || pushPanel);
  if (!showSync && !showPush) return null;

  const label = buttonText ?? t('components.syncPushHub.button');
  const btn = (
    <Button
      type={type}
      size={size}
      icon={<SyncOutlined />}
      aria-label={typeof label === 'string' ? label : t('components.syncPushHub.button')}
      onClick={() => setOpen(true)}
      {...buttonRest}
    >
      {iconOnly ? null : label}
    </Button>
  );

  const wrapped = wrapButton ? wrapButton(btn) : iconOnly ? <Tooltip title={label}>{btn}</Tooltip> : btn;

  return (
    <>
      {wrapped}
      {/* 未打开不挂载 Hub：避免列表页就执行 renderPushPanel → profiles/apis */}
      {open ? (
        <SyncPushHubModal
          open={open}
          onClose={() => setOpen(false)}
          syncEnabled={showSync}
          pushEnabled={showPush}
          syncTitle={syncTitle}
          pushTitle={pushTitle}
          title={title}
          width={width}
          zIndex={zIndex}
          defaultTab={defaultTab}
          renderSyncPanel={renderSyncPanel}
          renderPushPanel={renderPushPanel}
          syncPanel={syncPanel}
          pushPanel={pushPanel}
        />
      ) : null}
    </>
  );
};

export default SyncPushHubButton;
