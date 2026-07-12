import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Empty, List, Spin, Tag } from 'antd';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { maintenanceReminderApi } from '../../../../apps/kuaizhizao/services/equipment';
import { normalizeEquipmentListResponse } from '../../../../apps/kuaizhizao/utils/equipmentListCore';
import { buildMobileEquipmentHubPath } from '../paths';

interface ReminderRow {
  uuid: string;
  equipment_uuid?: string;
  equipment_name?: string;
  equipment_code?: string;
  reminder_type?: string;
  reminder_message?: string;
  planned_maintenance_date?: string;
  reminder_date?: string;
  is_handled?: boolean;
}

const MobileMaintenanceReminderListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReminderRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceReminderApi.list({ skip: 0, limit: 50, order_by: '-reminder_date' });
      const { data } = normalizeEquipmentListResponse(res);
      setItems(data as ReminderRow[]);
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

  const handleMarkHandled = async (uuid: string) => {
    try {
      await maintenanceReminderApi.markAsHandled({ reminder_uuid: uuid });
      messageApi.success(t('app.kuaizhizao.mobileEquipment.reminderHandled'));
      void load();
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.operationFailed'));
    }
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.maintenanceListTitle')}>
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
              }}
              actions={
                !row.is_handled
                  ? [
                      <Button key="done" type="link" size="small" onClick={() => void handleMarkHandled(row.uuid)}>
                        {t('app.kuaizhizao.mobileEquipment.markHandled')}
                      </Button>,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                title={
                  <span
                    style={{ fontWeight: 600, cursor: row.equipment_uuid ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (row.equipment_uuid) {
                        navigate(buildMobileEquipmentHubPath(row.equipment_uuid));
                      }
                    }}
                  >
                    {row.equipment_name || row.equipment_code || row.uuid.slice(0, 8)}
                    {row.reminder_type === 'overdue' ? (
                      <Tag color="error" style={{ marginLeft: 8 }}>
                        {t('app.kuaizhizao.mobileEquipment.overdueMaintenance')}
                      </Tag>
                    ) : null}
                    {row.is_handled ? (
                      <Tag color="success" style={{ marginLeft: 8 }}>
                        {t('app.kuaizhizao.mobileEquipment.handled')}
                      </Tag>
                    ) : null}
                  </span>
                }
                description={
                  <>
                    <div>{row.reminder_message || '—'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {row.planned_maintenance_date || row.reminder_date
                        ? String(row.planned_maintenance_date || row.reminder_date).slice(0, 10)
                        : ''}
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

export default MobileMaintenanceReminderListPage;
