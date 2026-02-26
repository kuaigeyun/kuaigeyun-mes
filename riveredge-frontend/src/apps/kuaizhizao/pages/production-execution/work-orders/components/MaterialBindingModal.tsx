/**
 * 物料绑定弹窗 (Material Binding Modal)
 * 
 * 功能：
 * 1. 上料 (Feeding) / 下料 (Discharging) 绑定
 * 2. 扫码录入支持
 * 3. 关联报工记录
 * 
 * Author: Antigravity
 * Date: 2026-02-15
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, Tabs, Form, Input, Button, Table, 
  Typography, message, InputNumber, Divider, Card 
} from 'antd';
import { 
  BarcodeOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { materialBindingApi } from '../../../../services/production';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates';

const { Text } = Typography;

interface MaterialBinding {
  id?: string;
  material_code: string;
  material_name?: string;
  batch_number?: string;
  quantity: number;
  unit?: string;
  binding_type: 'feeding' | 'discharging';
}

export interface MaterialBindingModalProps {
  visible: boolean;
  onCancel: () => void;
  reportingRecordId: string | number;
  onSuccess?: () => void;
}

const MaterialBindingModal: React.FC<MaterialBindingModalProps> = ({
  visible,
  onCancel,
  reportingRecordId,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'feeding' | 'discharging'>('feeding');
  const [loading, setLoading] = useState(false);
  const [boundMaterials, setBoundMaterials] = useState<MaterialBinding[]>([]);
  const [form] = Form.useForm();
  const scanInputRef = useRef<any>(null);

  useEffect(() => {
    if (visible && reportingRecordId) {
      loadBoundMaterials();
      // Auto focus scan input
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 300);
    }
  }, [visible, reportingRecordId]);

  const loadBoundMaterials = async () => {
    try {
      setLoading(true);
      const res = await materialBindingApi.getByReportingRecord(reportingRecordId.toString());
      setBoundMaterials(res?.data || []);
    } catch (error) {
      console.error('Failed to load material bindings', error);
      message.error('加载绑定记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBinding = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        material_code: values.barcode, // Assume barcode is material_code or we parse it
        batch_number: values.batch_number,
        quantity: values.quantity || 1,
        remark: values.remark,
      };

      if (activeTab === 'feeding') {
        await materialBindingApi.createFeeding(reportingRecordId.toString(), data);
      } else {
        await materialBindingApi.createDischarging(reportingRecordId.toString(), data);
      }

      message.success('绑定成功');
      form.resetFields(['barcode', 'quantity', 'batch_number']);
      loadBoundMaterials();
      onSuccess?.();
      
      // Keep focus on barcode for continuous scanning
      scanInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to bind material', error);
      message.error('绑定失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBinding = async (id: string) => {
    try {
      setLoading(true);
      await materialBindingApi.delete(id);
      message.success('已删除');
      loadBoundMaterials();
    } catch (error) {
      console.error('Failed to delete binding', error);
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '物料编码/条码', dataIndex: 'material_code', key: 'material_code', render: (text: string, record: any) => text || record.barcode },
    { title: '批次', dataIndex: 'batch_number', key: 'batch_number' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '类型', dataIndex: 'binding_type', key: 'binding_type', render: (type: string) => <Text style={{ color: '#fff' }}>{type === 'feeding' ? '上料' : '下料'}</Text> },
    { 
      title: '操作', 
      key: 'action', 
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleDeleteBinding(record.id)}
        />
      ) 
    },
  ];

  return (
    <Modal
      title={<span style={{ color: '#fff', fontSize: 20 }}>物料绑定 - 记录 ID: {reportingRecordId}</span>}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={MODAL_CONFIG.LARGE_WIDTH}
      centered
      rootClassName="kiosk-modal-terminal-bg"
      styles={{
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        body: { padding: '24px', background: '#1a1a1a', minHeight: 500 }
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
        .kiosk-modal-terminal-bg .ant-tabs-tab { color: rgba(255, 255, 255, 0.6) !important; font-size: 18px !important; }
        .kiosk-modal-terminal-bg .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1677ff !important; font-weight: 600; }
        .kiosk-modal-terminal-bg .ant-form-item-label label { color: rgba(255, 255, 255, 0.8) !important; font-size: 16px; }
        .kiosk-modal-terminal-bg .ant-table { background: transparent !important; color: #fff !important; }
        .kiosk-modal-terminal-bg .ant-table-thead > tr > th { 
          background: rgba(255, 255, 255, 0.05) !important; 
          color: rgba(255, 255, 255, 0.8) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .kiosk-modal-terminal-bg .ant-table-tbody > tr > td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
        .kiosk-modal-terminal-bg .ant-table-cell { font-size: 16px !important; }
      `}</style>

      <Tabs 
        activeKey={activeTab} 
        onChange={(k) => setActiveTab(k as any)}
        items={[
          { key: 'feeding', label: '上料绑定 (Feeding)' },
          { key: 'discharging', label: '下料绑定 (Discharging)' },
        ]}
      />

      <div style={{ marginTop: 24 }}>
        <Card style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleAddBinding}
            initialValues={{ quantity: 1 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 150px', gap: 16, alignItems: 'end' }}>
              <Form.Item 
                name="barcode" 
                label="物料条码/编号" 
                rules={[{ required: true, message: '请扫码或输入' }]}
              >
                <Input 
                  ref={scanInputRef}
                  prefix={<BarcodeOutlined />} 
                  placeholder="扫码或手动输入"
                  style={{ height: 60, fontSize: 20, background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }}
                  onPressEnter={() => form.submit()}
                />
              </Form.Item>
              <Form.Item name="batch_number" label="批次号">
                <Input 
                  placeholder="批次号(可选)" 
                  style={{ height: 60, fontSize: 20, background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }}
                />
              </Form.Item>
              <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
                <InputNumber 
                  min={0.001} 
                  style={{ width: '100%', height: 60, fontSize: 20, background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }} 
                  className="kiosk-input-number"
                />
              </Form.Item>
              <Form.Item label=" ">
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<PlusOutlined />}
                  style={{ 
                    height: 60, 
                    width: '100%', 
                    fontSize: 20, 
                    fontWeight: 600,
                    borderRadius: 8
                  }}
                >
                  确认绑定
                </Button>
              </Form.Item>
            </div>
          </Form>
        </Card>

        <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 18 }}>当前已绑定物料 ({boundMaterials.length})</Text>
            <Button icon={<SaveOutlined />} onClick={loadBoundMaterials}>刷新</Button>
          </div>
          <Table 
            dataSource={boundMaterials} 
            columns={columns} 
            rowKey="id" 
            pagination={false}
            loading={loading}
            scroll={{ y: 300 }}
          />
        </div>
      </div>
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button 
          size="large" 
          onClick={onCancel}
          style={{ 
            height: 60, 
            padding: '0 40px', 
            fontSize: 20,
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          关闭
        </Button>
      </div>
    </Modal>
  );
};

export default MaterialBindingModal;
