import React, { useState, useEffect, useRef } from 'react';
import { Modal, Select, Button, Spin, message, Space, Empty } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import UniverDocPreview from '../../../../../../components/univer-doc/preview';
import { getPrintTemplateList, getPrintTemplateByUuid, PrintTemplate } from '../../../../../../services/printTemplate';
import { mapWorkOrderToTemplateVariables } from '../../../../../../utils/printTemplateDataMapper';
import { handleError } from '../../../../../../utils/errorHandler';
// Import workOrderApi
import { workOrderApi } from '../../../../services/production';

interface WorkOrderPrintModalProps {
  visible: boolean;
  onCancel: () => void;
  workOrderData?: any; // Keep for backward compatibility or initial data
  workOrderId?: number; // Add workOrderId
}

const WorkOrderPrintModal: React.FC<WorkOrderPrintModalProps> = ({
  visible,
  onCancel,
  workOrderData,
  workOrderId,
}) => {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [templateConfig, setTemplateConfig] = useState<any>();
  const [configLoading, setConfigLoading] = useState(false);
  const [fullWorkOrderData, setFullWorkOrderData] = useState<any>(workOrderData || {});
  const [templateVariables, setTemplateVariables] = useState<Record<string, unknown>>({});
  const previewRef = useRef<HTMLDivElement>(null);

  // Load templates on mount
  useEffect(() => {
    if (visible) {
      loadTemplates();
      setTemplateConfig(undefined);
      setSelectedTemplateId(undefined);
      if (workOrderId) {
        loadWorkOrderData(workOrderId);
      } else if (workOrderData) {
        setFullWorkOrderData(workOrderData);
        setTemplateVariables(
          mapWorkOrderToTemplateVariables(workOrderData, workOrderData.operations || [])
        );
      } else {
        setTemplateVariables({});
      }
    }
  }, [visible, workOrderId, workOrderData]);

  const loadWorkOrderData = async (id: number) => {
    setDataLoading(true);
    try {
      // Create a promise for fetching details
      const detailPromise = workOrderApi.get(id.toString());
      // Create a promise for fetching operations
      const operationsPromise = workOrderApi.getOperations(id.toString());

      const [detail, operations] = await Promise.all([detailPromise, operationsPromise]);

      const combinedData = { ...detail, operations: operations || [] };
      setFullWorkOrderData(combinedData);

      const vars = mapWorkOrderToTemplateVariables(detail, operations || []);
      setTemplateVariables(vars);
    } catch (error: any) {
      handleError(error, '加载工单详情失败');
    } finally {
      setDataLoading(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getPrintTemplateList({ is_active: true });
      // Filter templates that are likely compatible with Work Order (optional logic)
      setTemplates(data);
      // Auto-select the first default one if available
      const defaultInfo = data.find(t => t.is_default);
      if (defaultInfo) {
        handleTemplateChange(defaultInfo.uuid);
      }
    } catch (error: any) {
      handleError(error, '加载打印模板失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = async (uuid: string) => {
    setSelectedTemplateId(uuid);
    setConfigLoading(true);
    try {
      const detail = await getPrintTemplateByUuid(uuid);
      try {
        const config = JSON.parse(detail.content);
        setTemplateConfig(config);
      } catch (e) {
        message.warning('该模板格式不正确或不是可视化模板');
        setTemplateConfig(undefined);
      }
    } catch (error: any) {
      handleError(error, '获取模板详情失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const handlePrint = () => {
    // Univer render canvas, simple innerHTML copy won't work for canvas content.
    // For MVP, we can try window.print() and rely on @media print styles to hide other elements,
    // or we need to implement canvas to image conversion.
    // Since implementing canvas-to-image correctly needs access to the Univer instance or canvas elements,
    // which are encapsulated, we'll use window.print() for now.
    window.print();
  };

  return (
    <Modal
      title="工单打印"
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button 
          key="print" 
          type="primary" 
          icon={<PrinterOutlined />} 
          onClick={handlePrint}
          disabled={!templateConfig || dataLoading}
        >
          打印
        </Button>
      ]}
      className="print-modal"
    >
      <Spin spinning={dataLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space className="no-print">
            <span>选择模板：</span>
            <Select
              style={{ width: 300 }}
              placeholder="请选择打印模板"
              value={selectedTemplateId}
              onChange={handleTemplateChange}
              loading={loading}
              options={templates.map((t: PrintTemplate) => ({ label: t.name, value: t.uuid }))}
            />
          </Space>
          
          <div 
            style={{ 
              border: '1px solid #f0f0f0', 
              minHeight: 400, 
              marginTop: 16,
              overflow: 'hidden', // Univer handles scrolling internally
              height: '60vh',
              position: 'relative'
            }}
          >
            {configLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <Spin tip="加载模板中..." />
              </div>
            ) : templateConfig ? (
              <div ref={previewRef} className="print-preview-area" style={{ height: '100%' }}>
                <UniverDocPreview
                  data={templateConfig}
                  variables={templateVariables}
                />
              </div>
            ) : (
              <Empty description="请选择有效的打印模板" style={{ paddingTop: 100 }} />
            )}
          </div>
        </Space>
      </Spin>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .print-preview-area,
          .print-preview-area *,
          .print-preview-area canvas {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .print-preview-area {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default WorkOrderPrintModal;
