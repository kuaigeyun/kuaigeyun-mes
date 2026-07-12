import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Card } from 'antd';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { buildMobileEquipmentHubPath } from '../paths';
import { QRCodeScanner } from '../../../../components/qrcode';
import { qrcodeApi, type QRCodeParseResponse } from '../../../../services/qrcode';
import { tryParseEquipmentQrText } from '../parseEquipmentQr';

const MobileEquipmentScanPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
    messageApi.success(t('pages.qrcode.scan.navigatingToEquipment'));
    navigate(buildMobileEquipmentHubPath(String(equipmentUuid)));
  };

  const parseText = async (text: string) => {
    const local = tryParseEquipmentQrText(text);
    if (local) {
      navigateEquipmentQr(local);
      return;
    }
    const remote = await qrcodeApi.parse({ qrcode_text: text });
    navigateEquipmentQr(remote);
  };

  useEffect(() => {
    const qrcodeText = searchParams.get('text');
    if (!qrcodeText) return;
    void parseText(qrcodeText).catch((error: unknown) => {
      messageApi.error(
        t('pages.qrcode.scan.parseFailed', {
          error: (error as Error)?.message || t('common.unknownError'),
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.scanTitle')}>
      <Card>
        <QRCodeScanner onScanSuccess={navigateEquipmentQr} showResult />
      </Card>
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentScanPage;
