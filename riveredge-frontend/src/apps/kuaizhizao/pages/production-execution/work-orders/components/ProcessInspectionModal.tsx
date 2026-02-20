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
import { 
  Modal, Form, Radio, Input, Button, 
  message 
} from 'antd';
import { 
  CheckCircleOutlined
} from '@ant-design/icons';
import { qualityApi } from '../../../../services/production';

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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!workOrderId || !operationId) {
      message.error('由于缺少工单或工序信息，无法提交检验');
      return;
    }

    try {
      setLoading(true);
      const data = {
        inspection_type: values.inspection_type,
        work_order_id: workOrderId,
        work_order_code: workOrderCode,
        operation_id: operationId,
        operation_name: operationName,
        check_points: values.check_points,
        conclusion: values.conclusion,
        inspector_id: 1, // TODO: Get from auth
        inspected_at: new Date().toISOString(),
        remarks: values.remarks,
      };

      await qualityApi.processInspection.create(data);
      message.success('检验记录已提交');
      form.resetFields();
      onCancel();
    } catch (error) {
      console.error('Failed to submit inspection', error);
      message.error('提交失败');
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
      width={700}
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
            <Radio.Button value="first" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>首检</Radio.Button>
            <Radio.Button value="patrol" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>巡检</Radio.Button>
            <Radio.Button value="last" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>末检</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="conclusion" label="检验结论">
          <Radio.Group buttonStyle="solid" className="kiosk-radio-group">
            <Radio.Button value="pass" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>合格</Radio.Button>
            <Radio.Button value="fail" style={{ height: 50, lineHeight: '48px', fontSize: 18, flex: 1, textAlign: 'center' }}>不合格</Radio.Button>
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
