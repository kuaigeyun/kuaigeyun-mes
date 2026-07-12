import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Modal, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { MODAL_CONFIG } from '../../../../../components/layout-templates';
import { qrcodeApi, type QRCodeGenerateResponse } from '../../../../../services/qrcode';
import { rowActionKind } from '../../../../../components/uni-action';

export interface EquipmentCardItem {
  uuid: string;
  code?: string;
  name?: string;
  type?: string;
  workshop_name?: string;
  production_line_name?: string;
  status?: string;
}

interface EquipmentCardQrModalProps {
  open: boolean;
  equipments: EquipmentCardItem[];
  onClose: () => void;
}

interface CardWithQr extends EquipmentCardItem {
  qrcode?: QRCodeGenerateResponse;
  error?: string;
}

function buildPrintHtml(cards: CardWithQr[], title: string): string {
  const cardBlocks = cards
    .filter((c) => c.qrcode?.qrcode_image)
    .map(
      (c) => `
      <div class="equipment-card">
        <div class="card-title">${title}</div>
        <div class="card-body">
          <div class="card-info">
            <div class="row"><span class="label">编号</span><span class="value">${c.code ?? '—'}</span></div>
            <div class="row"><span class="label">名称</span><span class="value">${c.name ?? '—'}</span></div>
            <div class="row"><span class="label">类型</span><span class="value">${c.type ?? '—'}</span></div>
            <div class="row"><span class="label">车间</span><span class="value">${c.workshop_name ?? '—'}</span></div>
            <div class="row"><span class="label">产线</span><span class="value">${c.production_line_name ?? '—'}</span></div>
            <div class="row"><span class="label">状态</span><span class="value">${c.status ?? '—'}</span></div>
          </div>
          <div class="card-qr">
            <img src="${c.qrcode!.qrcode_image}" alt="QR" />
            <div class="scan-hint">扫码查看设备</div>
          </div>
        </div>
      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #1e293b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .equipment-card {
      border: 2px solid #0f4c81; border-radius: 6px; padding: 10px 12px; break-inside: avoid;
    }
    .card-title {
      text-align: center; font-size: 14pt; font-weight: 700; color: #0f4c81;
      border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;
    }
    .card-body { display: flex; gap: 10px; align-items: flex-start; }
    .card-info { flex: 1; font-size: 9.5pt; }
    .row { display: flex; gap: 6px; margin-bottom: 4px; }
    .label { flex: 0 0 36px; color: #64748b; }
    .value { flex: 1; font-weight: 500; word-break: break-word; }
    .card-qr { flex: 0 0 88px; text-align: center; }
    .card-qr img { width: 88px; height: 88px; }
    .scan-hint { font-size: 8pt; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="grid">${cardBlocks}</div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

export const EquipmentCardQrModal: React.FC<EquipmentCardQrModalProps> = ({ open, equipments, onClose }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<CardWithQr[]>([]);

  const loadQrcodes = useCallback(async () => {
    if (!open || equipments.length === 0) {
      setCards([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        equipments.map(async (eq) => {
          try {
            const qrcode = await qrcodeApi.generateEquipment({
              equipment_uuid: eq.uuid,
              equipment_code: eq.code || '',
              equipment_name: eq.name || '',
              size: 8,
            });
            return { ...eq, qrcode };
          } catch (error: any) {
            return { ...eq, error: error?.message || t('common.unknownError') };
          }
        }),
      );
      setCards(results);
    } finally {
      setLoading(false);
    }
  }, [equipments, open, t]);

  useEffect(() => {
    void loadQrcodes();
  }, [loadQrcodes]);

  const handlePrint = () => {
    const printable = cards.filter((c) => c.qrcode?.qrcode_image);
    if (printable.length === 0) {
      messageApi.warning(t('app.kuaizhizao.equipment.qrcodePrintEmpty'));
      return;
    }
    const html = buildPrintHtml(printable, t('app.kuaizhizao.equipment.equipmentCardTitle'));
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) {
      messageApi.error(t('app.kuaizhizao.equipment.qrcodePrintBlocked'));
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <Modal
      title={t('app.kuaizhizao.equipment.qrcodeModalTitle', { count: equipments.length })}
      open={open}
      onCancel={onClose}
      width={MODAL_CONFIG.LARGE_WIDTH}
      footer={[
        <Button {...rowActionKind('close')} key="close" onClick={onClose}>
          {t('common.close')}
        </Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={loading}>
          {t('app.kuaizhizao.equipment.printEquipmentCards')}
        </Button>,
      ]}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip={t('app.kuaizhizao.equipment.qrcodeGenerating')} />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {cards.map((card) => (
            <div
              key={card.uuid}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('app.kuaizhizao.equipment.equipmentCardTitle')}</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div>
                    {t('app.kuaizhizao.equipment.colCode')}：{card.code ?? '—'}
                  </div>
                  <div>
                    {t('app.kuaizhizao.equipment.colName')}：{card.name ?? '—'}
                  </div>
                  {card.error ? <div style={{ color: '#cf1322' }}>{card.error}</div> : null}
                </div>
              </div>
              {card.qrcode?.qrcode_image ? (
                <img src={card.qrcode.qrcode_image} alt="QR" width={96} height={96} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default EquipmentCardQrModal;
