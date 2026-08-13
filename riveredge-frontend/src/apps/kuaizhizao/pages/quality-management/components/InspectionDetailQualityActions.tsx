import React from 'react';
import { Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';

export type InspectionQualityActionType = 'incoming' | 'process' | 'finished' | 'oqc';

const SOURCE_TYPE_MAP: Record<InspectionQualityActionType, string> = {
  incoming: 'incoming_inspection',
  process: 'process_inspection',
  finished: 'finished_goods_inspection',
  oqc: 'oqc_inspection',
};

export type InspectionQualityActionRecord = {
  id?: number;
  inspection_code?: string;
  quality_status?: string;
  unqualified_quantity?: number;
  status?: string;
} | null;

function isInspectionUnqualified(inspection: InspectionQualityActionRecord): boolean {
  if (!inspection?.id) return false;
  const unqualifiedQty = Number(inspection.unqualified_quantity) || 0;
  return (
    inspection.quality_status === '不合格' ||
    inspection.status === '不合格' ||
    (inspection.status === '已检验' && unqualifiedQty > 0)
  );
}

/**
 * 检验详情：不合格时顶部警示（无操作按钮；处置入口在 extra）。
 */
export function InspectionUnqualifiedBanner({
  inspection,
}: {
  inspection: InspectionQualityActionRecord;
}) {
  const { t } = useTranslation();
  if (!isInspectionUnqualified(inspection)) return null;
  return (
    <Alert
      type="warning"
      showIcon
      title={t('app.kuaizhizao.quality.detailActions.unqualifiedAlert')}
    />
  );
}

export function buildInspectionQualityExtraButtons({
  inspection,
  inspectionType,
  t,
  navigate,
  onRegisterDefect,
  canRegisterDefect = true,
  onCloseDrawer,
}: {
  inspection: InspectionQualityActionRecord;
  inspectionType: InspectionQualityActionType;
  t: TFunction;
  navigate: ReturnType<typeof useNavigate>;
  onRegisterDefect?: () => void;
  canRegisterDefect?: boolean;
  onCloseDrawer?: () => void;
}): React.ReactNode[] {
  if (!isInspectionUnqualified(inspection) || !inspection?.id) return [];
  const sourceType = SOURCE_TYPE_MAP[inspectionType];
  const exceptionPath = `/apps/kuaizhizao/production-execution/quality-exceptions?inspection_record_id=${inspection.id}&inspection_source_type=${sourceType}`;
  const buttons: React.ReactNode[] = [];
  if (inspectionType !== 'oqc' && canRegisterDefect && onRegisterDefect) {
    buttons.push(
      <Button
        key="register-defect"
        danger
        {...rowActionKind('create')}
        {...rowActionLabelKeep()}
        onClick={onRegisterDefect}
      >
        {t('app.kuaizhizao.quality.detailActions.registerDefect')}
      </Button>,
    );
  }
  buttons.push(
    <Button
      key="view-exception"
      onClick={() => {
        onCloseDrawer?.();
        navigate(exceptionPath);
      }}
    >
      {t('app.kuaizhizao.quality.detailActions.viewException')}
    </Button>,
  );
  return buttons;
}

/**
 * @deprecated 详情工作台改走 banner + extra；保留默认导出以免旧引用断裂。
 */
const InspectionDetailQualityActions: React.FC<{
  inspection: InspectionQualityActionRecord;
  inspectionType: InspectionQualityActionType;
  onRegisterDefect?: () => void;
  canRegisterDefect?: boolean;
}> = ({ inspection }) => <InspectionUnqualifiedBanner inspection={inspection} />;

export default InspectionDetailQualityActions;
