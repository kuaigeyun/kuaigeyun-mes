/**
 * 工序检验弹窗 (Process Inspection Modal)
 * 
 * 功能：
 * 1. 首检/巡检/末检录入
 * 2. 录入检验结果与结论
 * 
 * Author: Antigravity
 * Date: 2026-02-15
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'
import { 
  Modal, Form, Radio, Input, Button, 
  message 
} from 'antd';
import { 
  CheckCircleOutlined
} from '@ant-design/icons';
import { qualityApi } from '../../../../services/production';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates';

export interface ProcessInspectionModalProps {
  visible: boolean;
  onCancel: () => void;
  workOrderId?: string | number;
  operationId?: string | number;
  workOrderCode?: string;
  operationName?: string;
}

const ProcessInspectionModal: React.FC<ProcessInspectionModalProps> = ({
  visible,
  onCancel,
  workOrderId,
  operationId,
  workOrderCode,
  operationName,
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!workOrderId || !operationId) {
      message.error(t('app.kuaizhizao.workOrder.kioskInspectionMissingInfo'));
      return;
    }

    try {
      setLoading(true);
      const created = await qualityApi.processInspection.createFromWorkOrder(
        String(workOrderId),
        String(operationId),
      );
      const inspectionId = (created as { id?: number })?.id;
      if (!inspectionId) {
        message.error(t('app.kuaizhizao.workOrder.kioskInspectionCreateFailed'));
        return;
      }
      const isPass = values.conclusion === 'pass';
      await qualityApi.processInspection.conduct(String(inspectionId), {
        qualified_quantity: isPass ? 1 : 0,
        unqualified_quantity: isPass ? 0 : 1,
        inspection_quantity: 1,
        notes: [values.inspection_type, values.remarks].filter(Boolean).join(' · '),
      });
      message.success(t('app.kuaizhizao.workOrder.kioskInspectionSubmitted'));
      form.resetFields();
      onCancel();
    } catch (error) {
      console.error('Failed to submit inspection', error);
      message.error(t('app.kuaizhizao.workOrder.kioskInspectionSubmitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<span style={{ color: '#fff', fontSize: 20 }}>工序检验 - {operationName}</span>}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={MODAL_CONFIG.STANDARD_WIDTH}
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
          border: 1px solid var(--river-border-color);
          border-radius: 12px;
        }
        .kiosk-modal-terminal-bg .ant-modal-header {
          background: transparent !important;
          border-bottom: 1px solid var(--river-divider-color);
          padding-bottom: 16px;
        }
        .kiosk-modal-terminal-bg .ant-form-item-label label { color: rgba(255, 255, 255, 0.65) !important; font-size: 16px; }
      `}</style>

      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleSubmit}
        initialValues={{ inspection_type: 'first', conclusion: 'pass' }}
      >
        <Form.Item name="inspection_type" label="检验类型">
          <Radio.Group buttonStyle="solid" className="kiosk-radio-group">
            <Radio.Button value="first" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>{t('app.kuaizhizao.workOrder.kioskInspectionFirst')}</Radio.Button>
            <Radio.Button value="patrol" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>{t('app.kuaizhizao.workOrder.kioskInspectionPatrol')}</Radio.Button>
            <Radio.Button value="last" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>{t('app.kuaizhizao.workOrder.kioskInspectionFinal')}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="conclusion" label="检验结论">
          <Radio.Group buttonStyle="solid" className="kiosk-radio-group">
            <Radio.Button value="pass" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>{t('app.kuaizhizao.workOrder.kioskQualified')}</Radio.Button>
            <Radio.Button value="fail" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>{t('app.kuaizhizao.workOrder.kioskUnqualified')}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="remarks" label="检验备注">
          <Input.TextArea 
            rows={4} 
            placeholder="请输入检验详情或异常说明" 
            style={{ fontSize: 18, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </Form.Item>

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
            htmlType="submit"
            icon={<CheckCircleOutlined />}
            style={{ 
              flex: 2,
              height: 60, 
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            保存检验结果
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default ProcessInspectionModal;
