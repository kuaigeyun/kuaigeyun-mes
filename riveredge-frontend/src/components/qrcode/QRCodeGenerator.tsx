/**
 * 二维码生成组件
 * 
 * 提供二维码生成和显示功能
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Button, Space, App, Spin, theme } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { qrcodeApi, type QRCodeGenerateRequest, type QRCodeGenerateResponse } from '../../services/qrcode';

export interface QRCodeGeneratorProps {
  /** 二维码类型 */
  qrcodeType: 'MAT' | 'WO' | 'OP' | 'EQ' | 'EMP' | 'BOX' | 'TRACE';
  /** 二维码数据 */
  data: Record<string, any>;
  /** 二维码大小 */
  size?: number;
  /** 边框大小 */
  border?: number;
  /** 错误纠正级别 */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** 是否自动生成 */
  autoGenerate?: boolean;
  /** 生成成功回调 */
  onGenerateSuccess?: (response: QRCodeGenerateResponse) => void;
  /** 是否显示卡片标题「二维码」（默认 true；为 false 时仅保留右上角操作按钮） */
  showCardTitle?: boolean;
  /** 是否不使用外部 Card 容器（用于嵌套或自定义容器场景） */
  noCard?: boolean;
}

/**
 * 二维码生成组件
 */
export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  qrcodeType,
  data,
  size = 10,
  border = 4,
  errorCorrection = 'M',
  autoGenerate = true,
  onGenerateSuccess,
  showCardTitle = true,
  noCard = false,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [qrcodeResponse, setQrcodeResponse] = useState<QRCodeGenerateResponse | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 生成二维码
   */
  const dataString = JSON.stringify(data);
  // 使用 JSON.stringify 比较 data 内容，避免因引用变化导致频繁重新生成
  const stableData = useMemo(() => data, [dataString]);

  const generateQRCode = useCallback(async (silent: boolean = false) => {
    try {
      setLoading(true);
      const request: QRCodeGenerateRequest = {
        qrcode_type: qrcodeType,
        data: stableData,
        size,
        border,
        error_correction: errorCorrection,
      };
      const response = await qrcodeApi.generate(request);
      if (!isMountedRef.current) return;
      setQrcodeResponse(response);
      onGenerateSuccess?.(response);
      if (!silent) {
        message.success('二维码生成成功');
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      message.error(`生成二维码失败: ${error.message || '未知错误'}`);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [qrcodeType, stableData, size, border, errorCorrection, message, onGenerateSuccess]);

  /**
   * 下载二维码
   */
  const downloadQRCode = () => {
    if (!qrcodeResponse?.qrcode_image) {
      message.warning('请先生成二维码');
      return;
    }

    try {
      // 从data URI中提取base64数据
      const base64Data = qrcodeResponse.qrcode_image.split(',')[1];
      const byteCharacters = window.atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new window.Blob([byteArray], { type: 'image/png' });

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qrcode-${qrcodeType}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('二维码下载成功');
    } catch (error: any) {
      message.error(`下载二维码失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 自动生成二维码
   */
  useEffect(() => {
    if (autoGenerate && stableData && Object.keys(stableData).length > 0) {
      // 延迟调用，避免同步 setState 问题
      const timer = window.setTimeout(() => {
        generateQRCode(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [autoGenerate, generateQRCode, stableData]);

  const content = (
    <Spin spinning={loading}>
      {(!showCardTitle && !noCard) && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => generateQRCode(false)}
              loading={loading}
              disabled={!data || Object.keys(data).length === 0}
            >
              重新生成
            </Button>
            {qrcodeResponse && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={downloadQRCode}
              >
                下载
              </Button>
            )}
          </Space>
        </div>
      )}
      {qrcodeResponse?.qrcode_image ? (
        <div style={{ textAlign: 'center' }}>
          {noCard && (
            <div style={{ marginBottom: 8 }}>
              <Space size={4}>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined style={{ color: token.colorSuccess }} />}
                  title="重新生成"
                  aria-label="重新生成"
                  onClick={() => generateQRCode(false)}
                  loading={loading}
                  disabled={!data || Object.keys(data).length === 0}
                />
                {qrcodeResponse && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={downloadQRCode}
                  >
                    下载
                  </Button>
                )}
              </Space>
            </div>
          )}
          <img
            src={qrcodeResponse.qrcode_image}
            alt="二维码"
            style={{ maxWidth: noCard ? 132 : '100%', height: 'auto' }}
          />
          <div style={{ marginTop: noCard ? 8 : 16, color: '#666', fontSize: noCard ? 11 : 12 }}>
            类型: {qrcodeResponse.qrcode_type}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          请生成二维码
        </div>
      )}
    </Spin>
  );

  if (noCard) {
    return content;
  }

  return (
    <Card
      title={showCardTitle ? '二维码' : undefined}
      extra={
        showCardTitle ? (
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => generateQRCode(false)}
              loading={loading}
              disabled={!data || Object.keys(data).length === 0}
            >
              重新生成
            </Button>
            {qrcodeResponse && (
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadQRCode}
              >
                下载
              </Button>
            )}
          </Space>
        ) : undefined
      }
    >
      {content}
    </Card>
  );
};
