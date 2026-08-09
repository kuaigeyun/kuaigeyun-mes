/**
 * KU-AI 站点集成配置弹窗（点击 AI 连接器卡片后打开，非 application_connection 记录）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import KuAiIntegrationSettingsPanel from '../shared/KuAiIntegrationSettingsPanel';

export interface KuAiConnectorConfigModalProps {
  open: boolean;
  connectorName?: string;
  onClose: () => void;
}

const KuAiConnectorConfigModal: React.FC<KuAiConnectorConfigModalProps> = ({
  open,
  connectorName,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        connectorName
          ? t('pages.system.applicationConnections.kuAiConfigModalTitle', { name: connectorName })
          : t('pages.system.applicationConnections.kuAiMarketTitle')
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={MODAL_CONFIG.CONNECTOR_MARKET_WIDTH}
      destroyOnHidden
    >
      <KuAiIntegrationSettingsPanel embedded />
    </Modal>
  );
};

export default KuAiConnectorConfigModal;
