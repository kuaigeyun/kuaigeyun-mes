import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Spin, Typography } from 'antd';
import { Html5Qrcode } from 'html5-qrcode';
import { qrcodeApi, type QRCodeParseResponse } from '../../../../services/qrcode';
import { tryParseEquipmentQrText } from '../parseEquipmentQr';

export interface MobileCameraQrScannerProps {
  onScanSuccess: (response: QRCodeParseResponse) => void;
  /** 连续扫描模式（工作台预览）；false 时扫到一次即停止 */
  continuous?: boolean;
  compact?: boolean;
}

/**
 * 企微 H5 摄像头扫码（getUserMedia + html5-qrcode，优先后置摄像头）
 */
export const MobileCameraQrScanner: React.FC<MobileCameraQrScannerProps> = ({
  onScanSuccess,
  continuous = false,
  compact = false,
}) => {
  const { t } = useTranslation();
  const reactId = useId();
  const regionId = `mobile-qr-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDecodedText = useCallback(
    async (text: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      try {
        const local = tryParseEquipmentQrText(text);
        const response = local ?? (await qrcodeApi.parse({ qrcode_text: text }));
        onScanSuccess(response);
        if (!continuous && scannerRef.current?.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err: unknown) {
        setError((err as Error)?.message || t('pages.qrcode.scan.parseFailed', { error: t('common.unknownError') }));
      } finally {
        handlingRef.current = false;
      }
    },
    [continuous, onScanSuccess, t],
  );

  const startScanner = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: compact ? { width: 220, height: 220 } : { width: 280, height: 280 },
          aspectRatio: 1,
        },
        (decoded) => {
          void handleDecodedText(decoded);
        },
        () => {
          // 未识别到码，忽略
        },
      );
    } catch (err: unknown) {
      setError((err as Error)?.message || t('app.kuaizhizao.mobileEquipment.cameraStartFailed'));
    } finally {
      setStarting(false);
    }
  }, [compact, handleDecodedText, regionId, t]);

  useEffect(() => {
    void startScanner();
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      void (async () => {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
          await scanner.clear();
        } catch {
          // 组件卸载时忽略
        }
      })();
    };
  }, [startScanner]);

  return (
    <div style={{ width: '100%' }}>
      <div
        id={regionId}
        style={{
          width: '100%',
          minHeight: compact ? 260 : 320,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0f172a',
          position: 'relative',
        }}
      />
      {starting && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Spin tip={t('app.kuaizhizao.mobileEquipment.cameraStarting')} />
        </div>
      )}
      {error ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12 }}
          message={error}
          action={
            <Button size="small" onClick={() => void startScanner()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12 }}>
          {t('app.kuaizhizao.mobileEquipment.cameraHint')}
        </Typography.Text>
      )}
    </div>
  );
};
