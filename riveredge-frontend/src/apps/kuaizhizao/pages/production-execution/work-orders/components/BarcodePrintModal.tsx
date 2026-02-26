/**
 * 条码/标签打印弹窗 (Barcode/Label Print Modal)
 * 
 * 功能：
 * 1. 选择打印模板（工序流转卡、工序标签等）
 * 2. 预览与打印
 * 
 * Author: Antigravity
 * Date: 2026-02-15
 */

import React, { useState, useEffect } from 'react';
import { 
  Modal, Radio, Button, Typography, 
  Space, message, Spin 
} from 'antd';
import { 
  PrinterOutlined, 
  FileTextOutlined,
  QrcodeOutlined
} from '@ant-design/icons';
import { getPrintTemplateList, type PrintTemplate } from '../../../../../../services/printTemplate';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates';

const { Title } = Typography;

export interface BarcodePrintModalProps {
  visible: boolean;
  onCancel: () => void;
  workOrderId?: string | number;
  operationId?: string | number;
  /** 打印级别: 'work_order' | 'operation' */
  level?: 'work_order' | 'operation';
}

const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  visible,
  onCancel,
  workOrderId,
  operationId,
  level = 'operation',
}) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible, level]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Filter templates by type based on level
      const type = level === 'work_order' ? 'work_order' : 'operation';
      const res = await getPrintTemplateList({ type });
      setTemplates(res || []);
      if (res && res.length > 0) {
        setSelectedTemplate(res[0].uuid);
      }
    } catch (error) {
      console.error('Failed to load print templates', error);
      message.error('加载打印模板失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedTemplate) {
      message.warning('请选择打印模板');
      return;
    }

    try {
      setLoading(true);
      // Logic for printing: 
      // Usually opening a specific URL or calling a render API
      // For now, we simulate by opening a print window if possible,
      // or just show a success message.
      
      const printUrl = level === 'work_order' 
        ? `/api/v1/apps/kuaizhizao/work-orders/${workOrderId}/print?template_uuid=${selectedTemplate}`
        : `/api/v1/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/print?template_uuid=${selectedTemplate}`;
      
      window.open(printUrl, '_blank');
      message.success('已发送打印请求');
      onCancel();
    } catch (error) {
      console.error('Print failed', error);
      message.error('打印失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<span style={{ color: '#fff', fontSize: 20 }}>条码打印 - {level === 'work_order' ? '工单级' : '工序级'}</span>}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={MODAL_CONFIG.SMALL_WIDTH}
      centered
      rootClassName="kiosk-modal-terminal-bg"
      styles={{
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        body: { padding: '24px', background: '#1a1a1a' }
      }}
    >
      <style>{`
        .kiosk-modal-terminal-bg .ant-modal-content {
          background: #141414 !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
        }
        .kiosk-modal-terminal-bg .ant-modal-header {
          background: transparent !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 16px;
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper {
          color: rgba(255, 255, 255, 0.85) !important;
          font-size: 18px !important;
          width: 100%;
          padding: 16px;
          margin: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s;
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper-checked {
          background: rgba(22, 119, 255, 0.1);
        }
      `}</style>

      {loading && templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.45)' }}>加载模板中...</div>
        </div>
      ) : (
        <div style={{ minHeight: 300 }}>
          <Title level={4} style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>选择打印模板</Title>
          {templates.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <FileTextOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />
              <div style={{ color: 'rgba(255,255,255,0.45)' }}>未发现相关打印模板</div>
            </div>
          ) : (
            <Radio.Group 
              onChange={e => setSelectedTemplate(e.target.value)} 
              value={selectedTemplate}
              style={{ width: '100%', maxHeight: 400, overflowY: 'auto' }}
            >
              {templates.map(tpl => (
                <Radio key={tpl.uuid} value={tpl.uuid}>
                  <Space size={12}>
                    <QrcodeOutlined />
                    {tpl.name}
                  </Space>
                </Radio>
              ))}
            </Radio.Group>
          )}

          <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
            <Button 
              size="large" 
              onClick={onCancel}
              style={{ 
                flex: 1,
                height: 60, 
                fontSize: 20,
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              取消
            </Button>
            <Button 
              type="primary"
              size="large" 
              loading={loading}
              onClick={handlePrint}
              icon={<PrinterOutlined />}
              disabled={!selectedTemplate}
              style={{ 
                flex: 2,
                height: 60, 
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              立即打印
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BarcodePrintModal;
