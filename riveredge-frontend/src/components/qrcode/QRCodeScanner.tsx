/**
 * 二维码扫描组件
 * 
 * 提供二维码扫描和解析功能
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Space, message, Input, Upload, Modal } from 'antd';
import { ScanOutlined, UploadOutlined, FileImageOutlined } from '@ant-design/icons';
import { qrcodeApi, type QRCodeParseResponse } from '../../services/qrcode';
import type { UploadFile } from 'antd/es/upload/interface';

/**
 * 二维码扫描组件属性
 */
export interface QRCodeScannerProps {
  /** 扫描成功回调 */
  onScanSuccess?: (response: QRCodeParseResponse) => void;
  /** 是否显示解析结果 */
  showResult?: boolean;
}

/**
 * 二维码扫描组件
 */
export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScanSuccess,
  showResult = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [qrcodeText, setQrcodeText] = useState('');
  const [parseResult, setParseResult] = useState<QRCodeParseResponse | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 解析二维码文本
   */
  const parseQRCodeText = async () => {
    if (!qrcodeText.trim()) {
      message.warning('请输入二维码文本');
      return;
    }

    try {
      setLoading(true);
      const response = await qrcodeApi.parse({ qrcode_text: qrcodeText });
      setParseResult(response);
      onScanSuccess?.(response);
      message.success('二维码解析成功');
    } catch (error: any) {
      message.error(`解析二维码失败: ${error.message || '未知错误'}`);
      setParseResult(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理图片上传
   */
  const handleImageUpload = async (file: File) => {
    try {
      setLoading(true);
      
      // 将图片转换为base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        setUploadedImage(base64Image);
        
        try {
          const response = await qrcodeApi.parse({ qrcode_image: base64Image });
          setParseResult(response);
          onScanSuccess?.(response);
          message.success('二维码解析成功');
        } catch (error: any) {
          message.error(`解析二维码失败: ${error.message || '未知错误'}`);
          setParseResult(null);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      message.error(`上传图片失败: ${error.message || '未知错误'}`);
      setLoading(false);
    }
    
    return false; // 阻止自动上传
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        message.error('请选择图片文件');
        return;
      }
      handleImageUpload(file);
    }
  };

  /**
   * 打开文件选择对话框
   */
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card
      title="二维码扫描"
      extra={
        <Space>
          <Button
            icon={<FileImageOutlined />}
            onClick={openFileDialog}
            loading={loading}
          >
            选择图片
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 文本输入方式 */}
        <div>
          <Input.TextArea
            placeholder="请输入二维码文本内容（JSON格式）"
            value={qrcodeText}
            onChange={(e) => setQrcodeText(e.target.value)}
            rows={4}
            style={{ marginBottom: 8 }}
          />
          <Button
            type="primary"
            icon={<ScanOutlined />}
            onClick={parseQRCodeText}
            loading={loading}
            block
          >
            解析二维码
          </Button>
        </div>

        {/* 图片上传方式 */}
        <Upload
          accept="image/*"
          beforeUpload={handleImageUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} block>
            上传二维码图片
          </Button>
        </Upload>

        {/* 显示上传的图片 */}
        {uploadedImage && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={uploadedImage}
              alt="上传的二维码"
              style={{ maxWidth: '100%', maxHeight: 300, border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
          </div>
        )}

        {/* 显示解析结果 */}
        {showResult && parseResult && (
          <Card size="small" title="解析结果">
            <div>
              <div><strong>类型:</strong> {parseResult.qrcode_type}</div>
              <div style={{ marginTop: 8 }}>
                <strong>数据:</strong>
                <pre style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'auto' }}>
                  {JSON.stringify(parseResult.data, null, 2)}
                </pre>
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>状态:</strong>{' '}
                <span style={{ color: parseResult.valid ? '#52c41a' : '#ff4d4f' }}>
                  {parseResult.valid ? '有效' : '无效'}
                </span>
              </div>
            </div>
          </Card>
        )}
      </Space>
    </Card>
  );
};
