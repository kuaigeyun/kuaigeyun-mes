/**
 * 二维码生成组件
 * 
 * 提供二维码生成和显示功能
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { qrcodeApi, type QRCodeGenerateRequest, type QRCodeGenerateResponse } from '../../services/qrcode';

/**
 * 二维码生成组件属性
 */
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
}) => {
  const [loading, setLoading] = useState(false);
  const [qrcodeResponse, setQrcodeResponse] = useState<QRCodeGenerateResponse | null>(null);

  /**
   * 生成二维码
   */
  const generateQRCode = async () => {
    try {
      setLoading(true);
      const request: QRCodeGenerateRequest = {
        qrcode_type: qrcodeType,
        data,
        size,
        border,
        error_correction: errorCorrection,
      };
      const response = await qrcodeApi.generate(request);
      setQrcodeResponse(response);
      onGenerateSuccess?.(response);
      message.success('二维码生成成功');
    } catch (error: any) {
      message.error(`生成二维码失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

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
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qrcode-${qrcodeType}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success('二维码下载成功');
    } catch (error: any) {
      message.error(`下载二维码失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 自动生成二维码
   */
  useEffect(() => {
    if (autoGenerate && data && Object.keys(data).length > 0) {
      generateQRCode();
    }
  }, [autoGenerate, qrcodeType, data, size, border, errorCorrection]);

  return (
    <Card
      title="二维码"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={generateQRCode}
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
      }
    >
      <Spin spinning={loading}>
        {qrcodeResponse?.qrcode_image ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={qrcodeResponse.qrcode_image}
              alt="二维码"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
              类型: {qrcodeResponse.qrcode_type}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            请生成二维码
          </div>
        )}
      </Spin>
    </Card>
  );
};
