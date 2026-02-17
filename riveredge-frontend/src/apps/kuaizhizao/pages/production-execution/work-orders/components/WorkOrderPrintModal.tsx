import React, { useState, useEffect, useRef } from 'react';
import { Modal, Select, Button, Spin, message, Space, Empty } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { Preview } from '../../../../../../components/report-designer';
import { ReportConfig } from '../../../../../../components/report-designer';
import { getPrintTemplateList, getPrintTemplateByUuid, PrintTemplate } from '../../../../../../services/printTemplate';
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
  const [templateConfig, setTemplateConfig] = useState<ReportConfig>();
  const [configLoading, setConfigLoading] = useState(false);
  const [fullWorkOrderData, setFullWorkOrderData] = useState<any>(workOrderData || {});
  const previewRef = useRef<HTMLDivElement>(null);

  // Load templates on mount
  useEffect(() => {
    if (visible) {
      loadTemplates();
      setTemplateConfig(undefined);
      setSelectedTemplateId(undefined);
      // If we have an ID, load full data
      if (workOrderId) {
        loadWorkOrderData(workOrderId);
      } else if (workOrderData) {
        setFullWorkOrderData(workOrderData);
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
      
      // Combine data
      // We will put operations under a specific key, usually 'operations'
      // But for flat structure access in template like {{operations.0.name}}, it works too if operations is an array
      const combinedData = {
        ...detail,
        operations: operations || [],
      };
      
      setFullWorkOrderData(combinedData);
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
    if (!previewRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('无法打开打印窗口');
      return;
    }

    const content = previewRef.current.innerHTML;
    
    // Basic styles for printing
    const styles = `
      <style>
        body { margin: 0; padding: 0; }
        @media print {
            @page { margin: 0; }
            body { -webkit-print-color-adjust: exact; }
        }
        /* Restore relative positioning for the canvas content */
        .preview-content {
             position: relative;
             width: 100%;
             height: 100%;
        }
        /* 
           Since React components might use scoped styles or antd styles, 
           we might lose them. For a robust solution, we'd need to copy stylesheets.
           For now, we assume simple inline styles from ReportDesigner.
        */
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 4px; }
      </style>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>打印预览</title>
          ${styles}
        </head>
        <body>
          <div class="preview-content">
            ${content}
          </div>
          <script>
            window.onload = () => {
              window.print();
              // window.close(); // Optional: close after print
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
    >
      <Spin spinning={dataLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
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
              overflow: 'auto',
              maxHeight: '60vh'
            }}
          >
            {configLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <Spin tip="加载模板中..." />
              </div>
            ) : templateConfig ? (
              <div ref={previewRef}>
                <Preview 
                  config={templateConfig} 
                  showRefresh={false} 
                  externalData={fullWorkOrderData}
                />
              </div>
            ) : (
              <Empty description="请选择有效的打印模板" style={{ paddingTop: 100 }} />
            )}
          </div>
        </Space>
      </Spin>
    </Modal>
  );
};

export default WorkOrderPrintModal;
