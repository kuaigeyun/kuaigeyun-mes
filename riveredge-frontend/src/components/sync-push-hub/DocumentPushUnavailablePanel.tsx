/**
 * 外推未就绪提示：无可用 profile / 缺连接时展示，CTA 链到应用连接。
 * 不展示 connector 目录品类，也不伪造可推成功态。
 */
import React from 'react';
import { Alert, Button } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface DocumentPushUnavailablePanelProps {
  /** 覆盖默认未就绪文案 */
  message?: React.ReactNode;
  style?: React.CSSProperties;
}

export const DocumentPushUnavailablePanel: React.FC<DocumentPushUnavailablePanelProps> = ({
  message,
  style,
}) => {
  const { t } = useTranslation();
  return (
    <Alert
      type="warning"
      showIcon
      style={style}
      message={message ?? t('components.syncPushHub.pushNotReady')}
      action={
        <Link to="/system/application-connections">
          <Button size="small" type="link">
            {t('components.syncPushHub.goConfigureConnection')}
          </Button>
        </Link>
      }
    />
  );
};

export default DocumentPushUnavailablePanel;
