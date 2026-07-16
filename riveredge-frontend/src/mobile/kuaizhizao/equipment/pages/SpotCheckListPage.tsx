import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Empty, List, Spin, Tag } from 'antd';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { spotChecksApi } from '../../../../apps/kuaizhizao/services/equipmentOps';
import { normalizeEquipmentListResponse } from '../../../../apps/kuaizhizao/utils/equipmentListCore';
import { buildMobileEquipmentHubPath } from '../paths';

interface SpotCheckRow {
  uuid: string;
  document_no: string;
  equipment_uuid?: string;
  equipment_name?: string;
  equipment_code?: string;
  check_date?: string;
  status?: string;
  has_abnormality?: boolean;
}

const MobileSpotCheckListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SpotCheckRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spotChecksApi.list({ skip: 0, limit: 50, order_by: '-check_date' });
      const { data } = normalizeEquipmentListResponse(res);
      setItems(data as SpotCheckRow[]);
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

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.spotCheckListTitle')}>
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
                    {row.document_no}
                    {row.has_abnormality ? (
                      <Tag color="error" style={{ marginLeft: 8 }}>
                        {t('app.kuaizhizao.mobileEquipment.abnormal')}
                      </Tag>
                    ) : null}
                  </span>
                }
                description={
                  <>
                    <div>{row.equipment_name || row.equipment_code || '—'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {row.check_date} - {row.status}
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

export default MobileSpotCheckListPage;
