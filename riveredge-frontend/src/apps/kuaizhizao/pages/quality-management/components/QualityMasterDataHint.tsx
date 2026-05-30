import React from 'react';
import { Alert } from 'antd';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { qualityApi } from '../../../services/quality-execution';

type QualityStage = 'iqc' | 'fqc' | 'oqc' | 'ipqc';

type QualityMasterDataHintProps = {
  scope: 'material' | 'operation';
  /** 指定场景时仅提示该环节；未指定则按 scope 汇总 */
  stage?: QualityStage;
};

const STAGE_HINT_KEYS: Record<QualityStage, string> = {
  iqc: 'app.kuaizhizao.quality.masterDataHint.stageIqc',
  fqc: 'app.kuaizhizao.quality.masterDataHint.stageFqc',
  oqc: 'app.kuaizhizao.quality.masterDataHint.stageOqc',
  ipqc: 'app.kuaizhizao.quality.masterDataHint.stageIpqc',
};

export const QualityMasterDataHint: React.FC<QualityMasterDataHintProps> = ({ scope, stage }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: cfg } = useRequest(() => qualityApi.effectiveConfig.get(), { refreshDeps: [] });

  if (!cfg) return null;

  const stageEnabled = (key: QualityStage): boolean => {
    const map: Record<QualityStage, boolean> = {
      iqc: !!(cfg.stage_enabled?.iqc && cfg.module_enabled?.incoming),
      ipqc: !!(cfg.stage_enabled?.ipqc && cfg.module_enabled?.process),
      fqc: !!(cfg.stage_enabled?.fqc && cfg.module_enabled?.finished),
      oqc: !!cfg.stage_enabled?.oqc,
    };
    return map[key];
  };

  let message: string | null = null;
  if (stage) {
    if (!stageEnabled(stage)) {
      message = t(STAGE_HINT_KEYS[stage]);
    }
  } else if (scope === 'material') {
    const iqc = stageEnabled('iqc');
    const fqc = stageEnabled('fqc');
    const oqc = stageEnabled('oqc');
    if (!iqc && !fqc && !oqc) {
      message = t('app.kuaizhizao.quality.masterDataHint.material');
    }
  } else if (!stageEnabled('ipqc')) {
    message = t('app.kuaizhizao.quality.masterDataHint.operation');
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
