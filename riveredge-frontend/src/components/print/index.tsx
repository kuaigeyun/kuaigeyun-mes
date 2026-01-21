/**
 * 打印组件
 * 
 * 提供通用的打印功能，支持HTML和PDF格式
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState } from 'react';
import { Button, Modal, message, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api';

/**
 * 打印组件属性
 */
export interface PrintProps {
  /** 打印URL */
  url: string;
  /** 打印参数 */
  params?: Record<string, any>;
  /** 打印标题 */
  title?: string;
  /** 打印格式（html/pdf） */
  format?: 'html' | 'pdf';
  /** 按钮文本 */
  buttonText?: string;
  /** 按钮类型 */
  buttonType?: 'default' | 'primary' | 'link' | 'text';
  /** 按钮大小 */
  buttonSize?: 'small' | 'middle' | 'large';
  /** 是否显示按钮图标 */
  showIcon?: boolean;
  /** 打印成功回调 */
  onSuccess?: () => void;
  /** 打印失败回调 */
  onError?: (error: Error) => void;
}

/**
 * 打印组件
 */
export const Print: React.FC<PrintProps> = ({
  url,
  params = {},
  title = '打印预览',
  format = 'html',
  buttonText = '打印',
  buttonType = 'link',
  buttonSize = 'small',
  showIcon = true,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [printContent, setPrintContent] = useState<string>('');

  /**
   * 处理打印
   */
  const handlePrint = async () => {
    try {
      setLoading(true);
      
      // ⚠️ 关键修复：确保 url 是字符串类型
      if (typeof url !== 'string') {
        console.error('❌ Print组件: url 必须是字符串类型，当前类型:', typeof url, '值:', url);
        message.error('打印失败: URL 参数类型错误');
        onError?.(new Error('URL 参数类型错误'));
        return;
      }
      
      // 调用打印API
      const response = await apiRequest(url, {
        method: 'GET',
        params: {
          ...params,
          output_format: format,
        },
      });

      if (format === 'pdf') {
        // PDF格式：直接下载
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success('PDF下载成功');
      } else {
        // HTML格式：显示预览
        setPrintContent(response.content || response);
        setPreviewVisible(true);
      }

      onSuccess?.();
    } catch (error: any) {
      message.error(`打印失败: ${error.message || '未知错误'}`);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理打印预览确认
   */
  const handlePreviewPrint = () => {
    // 创建新窗口打印
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      message.success('打印成功');
    } else {
      message.error('无法打开打印窗口，请检查浏览器弹窗设置');
    }
  };

  /**
   * 处理打印预览取消
   */
  const handlePreviewCancel = () => {
    setPreviewVisible(false);
    setPrintContent('');
  };

  return (
    <>
      <Button
        type={buttonType}
        size={buttonSize}
        icon={showIcon ? <PrinterOutlined /> : undefined}
        onClick={handlePrint}
        loading={loading}
      >
        {buttonText}
      </Button>

      {/* 打印预览Modal */}
      <Modal
        title={title}
        open={previewVisible}
        onOk={handlePreviewPrint}
        onCancel={handlePreviewCancel}
        okText="打印"
        cancelText="取消"
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '80vh', overflow: 'auto' }}
      >
        <Spin spinning={loading}>
          <div
            dangerouslySetInnerHTML={{ __html: printContent }}
            style={{
              padding: '20px',
              background: '#fff',
            }}
          />
        </Spin>
      </Modal>
    </>
  );
};

export default Print;
