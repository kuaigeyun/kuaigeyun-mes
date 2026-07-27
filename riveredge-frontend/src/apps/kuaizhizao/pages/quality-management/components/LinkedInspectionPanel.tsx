import React from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { qualityApi } from '../../../services/quality-execution';
import { qualityImprovementApi } from '../../../services/quality-improvement';
import { renderQualityDocStatusTag, renderQualityQualityStatusTag } from './qualityMeta';

const { Text } = Typography;

interface LinkedIqcPanelProps {
  purchaseReceiptId?: number;
  customerMaterialRegistrationId?: number;
  active?: boolean;
  onNavigate: (path: string) => void;
}

export const LinkedIqcPanel: React.FC<LinkedIqcPanelProps> = ({
  purchaseReceiptId,
  customerMaterialRegistrationId,
  active,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const sourceId = purchaseReceiptId ?? customerMaterialRegistrationId;
  const { data, loading } = useRequest(
    () =>
      qualityApi.incomingInspection.list({
        limit: 50,
        ...(purchaseReceiptId ? { purchase_receipt_id: purchaseReceiptId } : {}),
        ...(customerMaterialRegistrationId
          ? { customer_material_registration_id: customerMaterialRegistrationId }
          : {}),
      }),
    { ready: !!sourceId && active !== false, refreshDeps: [purchaseReceiptId, customerMaterialRegistrationId, active] },
  );

  const rows = (data as any)?.items || [];

  const gotoIqcList = () => {
    if (purchaseReceiptId != null) {
      onNavigate(
        `/apps/kuaizhizao/quality-management/incoming-inspection?purchase_receipt_id=${purchaseReceiptId}`,
      );
      return;
    }
    if (customerMaterialRegistrationId != null) {
      onNavigate(
        `/apps/kuaizhizao/quality-management/incoming-inspection?customer_material_registration_id=${customerMaterialRegistrationId}`,
      );
      return;
    }
    onNavigate('/apps/kuaizhizao/quality-management/incoming-inspection');
  };

  if (!sourceId) return null;
  if (loading) return <Text type="secondary">{t('app.kuaizhizao.quality.linked.loadingIqc')}</Text>;
  if (rows.length === 0) {
    return (
      <Space>
        <Text type="secondary">{t('app.kuaizhizao.quality.linked.noLinkedIqc')}</Text>
        <Button type="link" size="small" onClick={gotoIqcList}>
          {t('app.kuaizhizao.quality.linked.gotoIqc')}
        </Button>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {rows.map((row: { id: number; inspection_code: string; status: string; quality_status?: string }) => (
        <Space key={row.id}>
          <Button
            type="link"
            size="small"
            onClick={() =>
              onNavigate(`/apps/kuaizhizao/quality-management/incoming-inspection?incoming_inspection_id=${row.id}`)
            }
          >
            {row.inspection_code}
          </Button>
          {renderQualityDocStatusTag(t, row.status)}
          {row.quality_status ? renderQualityQualityStatusTag(t, row.quality_status) : null}
        </Space>
      ))}
    </Space>
  );
};

interface LinkedOqcPanelProps {
  shipmentNoticeId?: number;
  salesDeliveryId?: number;
  active?: boolean;
  onNavigate: (path: string) => void;
}

export const LinkedOqcPanel: React.FC<LinkedOqcPanelProps> = ({
  shipmentNoticeId,
  salesDeliveryId,
  active,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const sourceId = shipmentNoticeId ?? salesDeliveryId;
  const { data, loading } = useRequest(
    () =>
      qualityImprovementApi.oqc.list({
        limit: 50,
        ...(shipmentNoticeId ? { shipment_notice_id: shipmentNoticeId } : {}),
        ...(salesDeliveryId ? { sales_delivery_id: salesDeliveryId } : {}),
      }),
    { ready: !!sourceId && active !== false, refreshDeps: [shipmentNoticeId, salesDeliveryId, active] },
  );

  const rows = (data as any)?.items || [];

  if (!sourceId) return null;
  if (loading) return <Text type="secondary">{t('app.kuaizhizao.quality.linked.loadingOqc')}</Text>;
  if (rows.length === 0) {
    return (
      <Space>
        <Text type="secondary">{t('app.kuaizhizao.quality.linked.noLinkedOqc')}</Text>
        <Button
          type="link"
          size="small"
          onClick={() =>
            onNavigate(
              salesDeliveryId != null
                ? `/apps/kuaizhizao/quality-management/oqc-inspection?sales_delivery_id=${salesDeliveryId}`
                : shipmentNoticeId != null
                  ? `/apps/kuaizhizao/quality-management/oqc-inspection?shipment_notice_id=${shipmentNoticeId}`
                  : '/apps/kuaizhizao/quality-management/oqc-inspection',
            )
          }
        >
          {t('app.kuaizhizao.quality.linked.gotoOqc')}
        </Button>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {rows.map(
        (row: {
          id: number;
          inspection_code: string;
          status: string;
          quality_status?: string;
          release_decision?: string;
        }) => (
          <Space key={row.id}>
            <Button
              type="link"
              size="small"
              onClick={() =>
                onNavigate(`/apps/kuaizhizao/quality-management/oqc-inspection?oqc_inspection_id=${row.id}`)
              }
            >
              {row.inspection_code}
            </Button>
            {renderQualityDocStatusTag(t, row.status)}
            {row.release_decision === 'released' ? <Tag color="success">{t('app.kuaizhizao.quality.linked.released')}</Tag> : null}
            {row.quality_status ? renderQualityQualityStatusTag(t, row.quality_status) : null}
          </Space>
        ),
      )}
    </Space>
  );
};

interface LinkedFqcPanelProps {
  workOrderId?: number;
  active?: boolean;
  onNavigate: (path: string) => void;
}

export const LinkedFqcPanel: React.FC<LinkedFqcPanelProps> = ({ workOrderId, active, onNavigate }) => {
  const { t } = useTranslation();
  const { data, loading } = useRequest(
    () => qualityApi.finishedGoodsInspection.list({ limit: 50, work_order_id: workOrderId }),
    { ready: !!workOrderId && active !== false, refreshDeps: [workOrderId, active] },
  );

  const rows = (data as any)?.items || [];

  if (!workOrderId) return null;
  if (loading) return <Text type="secondary">{t('app.kuaizhizao.quality.linked.loadingFqc')}</Text>;
  if (rows.length === 0) {
    return (
      <Space>
        <Text type="secondary">{t('app.kuaizhizao.quality.linked.noLinkedFqc')}</Text>
        <Button
          type="link"
          size="small"
          onClick={() =>
            onNavigate(
              `/apps/kuaizhizao/quality-management/finished-goods-inspection?work_order_id=${workOrderId}`,
            )
          }
        >
          {t('app.kuaizhizao.quality.linked.gotoFqc')}
        </Button>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {rows.map((row: { id: number; inspection_code: string; status: string; quality_status?: string }) => (
        <Space key={row.id}>
          <Button
            type="link"
            size="small"
            onClick={() =>
              onNavigate(
                `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${row.id}`,
              )
            }
          >
            {row.inspection_code}
          </Button>
          {renderQualityDocStatusTag(t, row.status)}
          {row.quality_status ? renderQualityQualityStatusTag(t, row.quality_status) : null}
        </Space>
      ))}
    </Space>
  );
};
