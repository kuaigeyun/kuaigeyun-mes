import React from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { useRequest } from 'ahooks';
import { qualityApi } from '../../../services/quality-execution';
import { qualityImprovementApi } from '../../../services/quality-improvement';

const { Text } = Typography;

interface LinkedIqcPanelProps {
  purchaseReceiptId?: number;
  active?: boolean;
  onNavigate: (path: string) => void;
}

export const LinkedIqcPanel: React.FC<LinkedIqcPanelProps> = ({ purchaseReceiptId, active, onNavigate }) => {
  const { data, loading } = useRequest(
    () => qualityApi.incomingInspection.list({ limit: 50, purchase_receipt_id: purchaseReceiptId }),
    { ready: !!purchaseReceiptId && active !== false, refreshDeps: [purchaseReceiptId, active] },
  );

  const rows = (data as any)?.items || [];

  if (!purchaseReceiptId) return null;
  if (loading) return <Text type="secondary">加载来料检验…</Text>;
  if (rows.length === 0) {
    return (
      <Space>
        <Text type="secondary">暂无关联来料检验</Text>
        <Button type="link" size="small" onClick={() => onNavigate('/apps/kuaizhizao/quality-management/incoming-inspection')}>
          去来料检验
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
          <Tag>{row.status}</Tag>
          {row.quality_status ? <Tag color={row.quality_status === '合格' ? 'success' : 'error'}>{row.quality_status}</Tag> : null}
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
  if (loading) return <Text type="secondary">加载出货检验…</Text>;
  if (rows.length === 0) {
    return (
      <Space>
        <Text type="secondary">暂无关联出货检验 (OQC)</Text>
        <Button type="link" size="small" onClick={() => onNavigate('/apps/kuaizhizao/quality-management/oqc-inspection')}>
          去出货检验
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
            <Tag>{row.status}</Tag>
            {row.release_decision === 'released' ? <Tag color="success">已放行</Tag> : null}
            {row.quality_status ? <Tag color={row.quality_status === '合格' ? 'success' : 'error'}>{row.quality_status}</Tag> : null}
          </Space>
        ),
      )}
    </Space>
  );
};
