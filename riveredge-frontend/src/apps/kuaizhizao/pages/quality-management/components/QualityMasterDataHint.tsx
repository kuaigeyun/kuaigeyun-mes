import React from 'react';
import { Alert } from 'antd';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { qualityApi } from '../../../services/quality-execution';

type QualityMasterDataHintProps = {
  scope: 'material' | 'operation';
};

export const QualityMasterDataHint: React.FC<QualityMasterDataHintProps> = ({ scope }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: cfg } = useRequest(() => qualityApi.effectiveConfig.get(), { refreshDeps: [] });

  if (!cfg) return null;

  let message: string | null = null;
  if (scope === 'material') {
    const iqc = cfg.stage_enabled?.iqc && cfg.module_enabled?.incoming;
    const fqc = cfg.stage_enabled?.fqc && cfg.module_enabled?.finished;
    const oqc = cfg.stage_enabled?.oqc;
    if (!iqc && !fqc && !oqc) {
      message = t('app.kuaizhizao.quality.masterDataHint.material');
    }
  } else {
    const ipqc = cfg.stage_enabled?.ipqc && cfg.module_enabled?.process;
    if (!ipqc) {
      message = t('app.kuaizhizao.quality.masterDataHint.operation');
    }
  }

  if (!message) return null;

  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message={message}
      action={
        <a onClick={() => navigate('/system/config-center?tab=parameters&module=quality')}>
          {t('app.kuaizhizao.quality.masterDataHint.gotoConfigCenter')}
        </a>
      }
    />
  );
};
