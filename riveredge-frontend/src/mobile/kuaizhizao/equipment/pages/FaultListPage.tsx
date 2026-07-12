import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Empty, List, Spin, Tag } from 'antd';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { equipmentFaultApi } from '../../../../apps/kuaizhizao/services/equipment';
import { normalizeEquipmentListResponse } from '../../../../apps/kuaizhizao/utils/equipmentListCore';
import { buildMobileEquipmentHubPath } from '../paths';

interface FaultRow {
  uuid: string;
  fault_no?: string;
  equipment_uuid?: string;
  fault_description?: string;
  fault_level?: string;
  status?: string;
  fault_date?: string;
}

const MobileFaultListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FaultRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipmentFaultApi.list({ skip: 0, limit: 50, order_by: '-fault_date' });
      const { data } = normalizeEquipmentListResponse(res);
      setItems(data as FaultRow[]);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.mobileEquipment.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusColor = (status?: string) => {
    if (status === '待处理') return 'error';
    if (status === '处理中') return 'processing';
    if (status === '已修复') return 'success';
    return 'default';
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.faultListTitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Empty description={t('common.noData')} />
      ) : (
        <List
          dataSource={items}
          renderItem={(row) => (
            <List.Item
              style={{
                background: '#fff',
                borderRadius: 12,
                marginBottom: 10,
                padding: '12px 14px',
                cursor: row.equipment_uuid ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (row.equipment_uuid) {
                  navigate(buildMobileEquipmentHubPath(row.equipment_uuid));
                }
              }}
            >
              <List.Item.Meta
                title={
                  <span style={{ fontWeight: 600 }}>
                    {row.fault_no || row.uuid.slice(0, 8)}
                    {row.status ? (
                      <Tag color={statusColor(row.status)} style={{ marginLeft: 8 }}>
                        {row.status}
                      </Tag>
                    ) : null}
                  </span>
                }
                description={
                  <>
                    <div>{row.fault_description || '—'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {row.fault_level} · {row.fault_date ? String(row.fault_date).slice(0, 10) : ''}
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </MobileEquipmentLayout>
  );
};

export default MobileFaultListPage;
