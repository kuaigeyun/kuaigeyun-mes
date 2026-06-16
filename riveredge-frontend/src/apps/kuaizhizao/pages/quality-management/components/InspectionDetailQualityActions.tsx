import React from 'react';
import { Alert, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildInspectionDetailPath } from './inspectionTemplateUtils';

export type InspectionQualityActionType = 'incoming' | 'process' | 'finished' | 'oqc';

const SOURCE_TYPE_MAP: Record<InspectionQualityActionType, string> = {
  incoming: 'incoming_inspection',
  process: 'process_inspection',
  finished: 'finished_goods_inspection',
  oqc: 'oqc_inspection',
};

interface InspectionDetailQualityActionsProps {
  inspection: {
    id?: number;
    inspection_code?: string;
    quality_status?: string;
    unqualified_quantity?: number;
    status?: string;
  } | null;
  inspectionType: InspectionQualityActionType;
  onRegisterDefect?: () => void;
  canRegisterDefect?: boolean;
}

/**
 * 检验详情抽屉：不合格时引导登记 NC / 查看质量异常。
 */
const InspectionDetailQualityActions: React.FC<InspectionDetailQualityActionsProps> = ({
  inspection,
  inspectionType,
  onRegisterDefect,
  canRegisterDefect = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!inspection?.id) return null;

  const unqualifiedQty = Number(inspection.unqualified_quantity) || 0;
  const isUnqualified =
    inspection.quality_status === '不合格' ||
    inspection.status === '不合格' ||
    (inspection.status === '已检验' && unqualifiedQty > 0);

  if (!isUnqualified) return null;

  const sourceType = SOURCE_TYPE_MAP[inspectionType];
  const exceptionPath = `/apps/kuaizhizao/production-execution/quality-exceptions?inspection_record_id=${inspection.id}&inspection_source_type=${sourceType}`;

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={t('app.kuaizhizao.quality.detailActions.unqualifiedAlert')}
      description={
        <Space wrap>
          {inspectionType !== 'oqc' && canRegisterDefect && onRegisterDefect ? (
            <Button type="primary" danger size="small" onClick={onRegisterDefect}>
              {t('app.kuaizhizao.quality.detailActions.registerDefect')}
            </Button>
          ) : null}
          <Button size="small" onClick={() => navigate(exceptionPath)}>
            {t('app.kuaizhizao.quality.detailActions.viewException')}
          </Button>
          {inspectionType === 'oqc' ? (
            <Button
              size="small"
              onClick={() =>
                navigate(buildInspectionDetailPath('oqc_inspection', inspection.id) || '/apps/kuaizhizao/quality-management/oqc-inspection')
              }
            >
              {t('app.kuaizhizao.quality.detailActions.continueOqc')}
            </Button>
          ) : null}
        </Space>
      }
    />
  );
};

export default InspectionDetailQualityActions;
