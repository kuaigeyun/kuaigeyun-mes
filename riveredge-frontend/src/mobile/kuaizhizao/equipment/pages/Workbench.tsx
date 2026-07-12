import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Badge, Empty, Spin, Typography } from 'antd';
import { RightOutlined, ScanOutlined } from '@ant-design/icons';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import {
  KUAIZHIZAO_MOBILE_EQUIPMENT_APP_TITLE_KEY,
  KUAIZHIZAO_MOBILE_EQUIPMENT_FAULTS_PATH,
  KUAIZHIZAO_MOBILE_EQUIPMENT_MAINTENANCE_PATH,
  KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH,
} from '../paths';
import { mobileEquipmentApi, type MobileWorkbenchEntry, type MobileWorkbenchSection } from '../services/mobileEquipmentApi';
import { resolveMobileEquipmentRoute } from '../resolveMobileRoute';
import { renderWorkbenchEntryIcon } from '../workbenchIcons';

const MobileEquipmentWorkbenchPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [sections, setSections] = useState<MobileWorkbenchSection[]>([]);
  const [pendingFaults, setPendingFaults] = useState(0);
  const [overdueReminders, setOverdueReminders] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [workbench, bootstrap] = await Promise.all([
        mobileEquipmentApi.getWorkbench('equipment'),
        mobileEquipmentApi.getBootstrap(),
      ]);
      setSections(Array.isArray(workbench) ? workbench : []);
      setPendingFaults(bootstrap?.pending_fault_count ?? 0);
      setOverdueReminders(bootstrap?.overdue_maintenance_reminder_count ?? 0);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.mobileEquipment.loadFailed'));
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const gridEntries = useMemo(() => {
    const entries: MobileWorkbenchEntry[] = [];
    for (const section of sections) {
      for (const entry of section.entries) {
        if (entry.key === 'scan') continue;
        entries.push(entry);
      }
    }
    return entries;
  }, [sections]);

  const sectionTitle = sections[0]?.title ?? t('app.kuaizhizao.mobileEquipment.equipmentOps');

  const navigateEntry = (entry: MobileWorkbenchEntry) => {
    navigate(resolveMobileEquipmentRoute(entry.route));
  };

  return (
    <MobileEquipmentLayout
      title={t(KUAIZHIZAO_MOBILE_EQUIPMENT_APP_TITLE_KEY)}
      showBack={false}
      useAppTitle
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 主扫码区 */}
        <section
          style={{
            borderRadius: 16,
            padding: '20px 18px',
            background: 'linear-gradient(145deg, #1565a8 0%, #0b3d6b 100%)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(11, 61, 107, 0.28)',
          }}
        >
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.88)', marginBottom: 16, fontSize: 14 }}>
            {t('app.kuaizhizao.mobileEquipment.scanHint')}
          </Typography.Paragraph>
          <button
            type="button"
            onClick={() => navigate(KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH)}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 12,
              padding: '14px 16px',
              background: '#fff',
              color: '#0b3d6b',
              fontSize: 17,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            }}
          >
            <ScanOutlined style={{ fontSize: 22 }} />
            {t('app.kuaizhizao.mobileEquipment.scanEquipment')}
          </button>
        </section>

        {/* 待办摘要 */}
        {(pendingFaults > 0 || overdueReminders > 0) && (
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {pendingFaults > 0 ? (
              <button
                type="button"
                onClick={() => navigate(KUAIZHIZAO_MOBILE_EQUIPMENT_FAULTS_PATH)}
                style={statCardStyle}
              >
                <Badge count={pendingFaults} overflowCount={99} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>🔧</span>
                </Badge>
                <span style={statLabelStyle}>{t('app.kuaizhizao.mobileEquipment.pendingFaults')}</span>
              </button>
            ) : null}
            {overdueReminders > 0 ? (
              <button
                type="button"
                onClick={() => navigate(KUAIZHIZAO_MOBILE_EQUIPMENT_MAINTENANCE_PATH)}
                style={statCardStyle}
              >
                <Badge count={overdueReminders} overflowCount={99} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>⏰</span>
                </Badge>
                <span style={statLabelStyle}>{t('app.kuaizhizao.mobileEquipment.overdueMaintenance')}</span>
              </button>
            ) : null}
          </section>
        )}

        {/* 设备作业入口 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : gridEntries.length === 0 ? (
          <Empty description={t('app.kuaizhizao.mobileEquipment.noWorkbenchEntries')} />
        ) : (
          <section>
            <Typography.Text
              strong
              style={{ display: 'block', marginBottom: 12, fontSize: 15, color: '#334155' }}
            >
              {sectionTitle}
            </Typography.Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {gridEntries.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => navigateEntry(entry)}
                  style={{
                    ...entryCardStyle,
                    gridColumn: entry.solo_row ? '1 / -1' : undefined,
                  }}
                >
                  <span style={entryIconWrapStyle}>{renderWorkbenchEntryIcon(entry.icon)}</span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 500, color: '#1e293b' }}>
                    {entry.label}
                  </span>
                  <RightOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </MobileEquipmentLayout>
  );
};

const statCardStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '14px 12px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#475569',
  fontWeight: 500,
};

const entryCardStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '16px 14px',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
};

const entryIconWrapStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: '#eff6ff',
  color: '#1565a8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  flexShrink: 0,
};

export default MobileEquipmentWorkbenchPage;
