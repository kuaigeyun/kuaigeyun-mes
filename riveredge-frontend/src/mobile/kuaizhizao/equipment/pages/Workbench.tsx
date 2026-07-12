import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Badge, Button, Card, Empty, Space, Typography } from 'antd';
import {
  QrcodeOutlined,
  ScanOutlined,
  ToolOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import {
  KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH,
  buildMobileEquipmentHubPath,
} from '../paths';
import { mobileEquipmentApi, type MobileWorkbenchSection } from '../services/mobileEquipmentApi';
import { QRCodeScanner } from '../../../../components/qrcode';
import { qrcodeApi, type QRCodeParseResponse } from '../../../../services/qrcode';
import { tryParseEquipmentQrText } from '../parseEquipmentQr';
import { touchButtonProps } from '../../../../components/touch-terminal';

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

  const navigateEquipmentQr = (response: QRCodeParseResponse) => {
    if (response.qrcode_type !== 'EQ') {
      messageApi.warning(t('pages.qrcode.scan.unknownType', { type: response.qrcode_type }));
      return;
    }
    const equipmentUuid = response.data?.equipment_uuid;
    if (!equipmentUuid) {
      messageApi.error(t('pages.qrcode.scan.equipmentDataIncomplete'));
      return;
    }
    navigate(buildMobileEquipmentHubPath(String(equipmentUuid)));
  };

  const handleScanSuccess = async (response: QRCodeParseResponse) => {
    navigateEquipmentQr(response);
  };

  const handleQuickParse = async (text: string) => {
    const local = tryParseEquipmentQrText(text);
    if (local) {
      navigateEquipmentQr(local);
      return;
    }
    const remote = await qrcodeApi.parse({ qrcode_text: text });
    navigateEquipmentQr(remote);
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.workbenchTitle')} showBack={false}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text type="secondary">{t('app.kuaizhizao.mobileEquipment.scanHint')}</Typography.Text>
            <Button
              {...touchButtonProps}
              type="primary"
              block
              size="large"
              icon={<ScanOutlined />}
              onClick={() => navigate(KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH)}
            >
              {t('app.kuaizhizao.mobileEquipment.scanEquipment')}
            </Button>
          </Space>
        </Card>

        {(pendingFaults > 0 || overdueReminders > 0) && (
          <Card size="small">
            <Space wrap>
              {pendingFaults > 0 ? (
                <Badge count={pendingFaults}>
                  <Button icon={<ToolOutlined />} type="link">
                    {t('app.kuaizhizao.mobileEquipment.pendingFaults')}
                  </Button>
                </Badge>
              ) : null}
              {overdueReminders > 0 ? (
                <Badge count={overdueReminders}>
                  <Button icon={<BellOutlined />} type="link">
                    {t('app.kuaizhizao.mobileEquipment.overdueMaintenance')}
                  </Button>
                </Badge>
              ) : null}
            </Space>
          </Card>
        )}

        {loading ? (
          <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
        ) : sections.length === 0 ? (
          <Empty description={t('app.kuaizhizao.mobileEquipment.noWorkbenchEntries')} />
        ) : (
          sections.map((section) => (
            <Card key={section.key} title={section.title} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {section.entries.map((entry) => (
                  <Button
                    key={entry.key}
                    block
                    size="large"
                    icon={<QrcodeOutlined />}
                    onClick={() => {
                      if (entry.route.startsWith('/m/')) {
                        navigate(entry.route);
                      } else {
                        window.location.href = entry.route;
                      }
                    }}
                  >
                    {entry.label}
                  </Button>
                ))}
              </Space>
            </Card>
          ))
        )}

        <Card title={t('app.kuaizhizao.mobileEquipment.quickScan')} size="small">
          <QRCodeScanner onScanSuccess={handleScanSuccess} showResult={false} />
        </Card>
      </Space>
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentWorkbenchPage;
