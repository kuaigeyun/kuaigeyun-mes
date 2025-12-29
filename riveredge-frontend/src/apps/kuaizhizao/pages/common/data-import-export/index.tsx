/**
 * 数据导入导出页面
 *
 * 提供Excel批量导入导出功能，支持多种数据类型的导入导出
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useState, useRef } from 'react';
import { App, Card, Button, Upload, Table, Space, Tag, Progress, Modal, message, Select, Alert } from 'antd';
import { UploadOutlined, DownloadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

// 导入任务接口定义
interface ImportTask {
  id: number;
  fileName: string;
  dataType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  progress: number;
  startTime: string;
  endTime?: string;
  errorMessage?: string;
}

// 导出任务接口定义
interface ExportTask {
  id: number;
  dataType: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recordCount: number;
  progress: number;
  startTime: string;
  endTime?: string;
  downloadUrl?: string;
}

const DataImportExportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([]);
  const [selectedDataType, setSelectedDataType] = useState<string>('material');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 支持的数据类型
  const dataTypes = [
    { value: 'material', label: '物料主数据', description: '包含物料基本信息、分类、规格等' },
    { value: 'bom', label: 'BOM数据', description: '物料清单及组成关系' },
    { value: 'workorder', label: '工单数据', description: '生产工单及相关信息' },
    { value: 'inventory', label: '库存数据', description: '库存明细及状态信息' },
    { value: 'sales-order', label: '销售订单', description: '销售订单及明细信息' },
    { value: 'quality-inspection', label: '质量检验', description: '检验记录及结果数据' },
  ];

  // 模拟导入任务数据
  const mockImportTasks: ImportTask[] = [
    {
      id: 1,
      fileName: '物料主数据-20251229.xlsx',
      dataType: '物料主数据',
      status: 'completed',
      totalRecords: 500,
      successRecords: 485,
      failedRecords: 15,
      progress: 100,
      startTime: '2025-12-29 09:00:00',
      endTime: '2025-12-29 09:05:30',
    },
    {
      id: 2,
      fileName: 'BOM数据-20251229.xlsx',
      dataType: 'BOM数据',
      status: 'processing',
      totalRecords: 200,
      successRecords: 120,
      failedRecords: 5,
      progress: 65,
      startTime: '2025-12-29 10:00:00',
    },
    {
      id: 3,
      fileName: '工单数据-20251229.xlsx',
      dataType: '工单数据',
      status: 'failed',
      totalRecords: 100,
      successRecords: 0,
      failedRecords: 100,
      progress: 100,
      startTime: '2025-12-29 08:30:00',
      endTime: '2025-12-29 08:35:00',
      errorMessage: '数据格式错误：缺少必填字段',
    },
  ];

  // 模拟导出任务数据
  const mockExportTasks: ExportTask[] = [
    {
      id: 1,
      dataType: '库存数据',
      fileName: '库存数据-20251229.xlsx',
      status: 'completed',
      recordCount: 245,
      progress: 100,
      startTime: '2025-12-29 11:00:00',
      endTime: '2025-12-29 11:02:15',
      downloadUrl: '/downloads/inventory-20251229.xlsx',
    },
    {
      id: 2,
      dataType: '生产报表',
      fileName: '生产报表-20251229.xlsx',
      status: 'processing',
      recordCount: 156,
      progress: 78,
      startTime: '2025-12-29 11:30:00',
    },
  ];

  // 文件上传配置
  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.type === 'application/vnd.ms-excel';

      if (!isExcel) {
        messageApi.error('只能上传 Excel 文件!');
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        messageApi.error('文件大小不能超过 10MB!');
        return false;
      }

      return true;
    },
    onChange: (info) => {
      if (info.file.status === 'done') {
        messageApi.success(`${info.file.name} 上传成功，正在处理...`);

        // 模拟创建导入任务
        const newTask: ImportTask = {
          id: Date.now(),
          fileName: info.file.name,
          dataType: dataTypes.find(t => t.value === selectedDataType)?.label || '未知',
          status: 'processing',
          totalRecords: 0,
          successRecords: 0,
          failedRecords: 0,
          progress: 0,
          startTime: new Date().toLocaleString(),
        };

        setImportTasks(prev => [newTask, ...prev]);

        // 模拟处理进度
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);

            // 完成处理
            setImportTasks(prev => prev.map(task =>
              task.id === newTask.id ? {
                ...task,
                status: 'completed',
                totalRecords: Math.floor(Math.random() * 1000) + 100,
                successRecords: Math.floor(Math.random() * 900) + 50,
                failedRecords: Math.floor(Math.random() * 50),
                progress: 100,
                endTime: new Date().toLocaleString(),
              } : task
            ));
          } else {
            setImportTasks(prev => prev.map(task =>
              task.id === newTask.id ? { ...task, progress: Math.round(progress) } : task
            ));
          }
        }, 500);

      } else if (info.file.status === 'error') {
        messageApi.error(`${info.file.name} 上传失败`);
      }
    },
  };

  // 处理导出
  const handleExport = () => {
    setExportModalVisible(true);
  };

  // 确认导出
  const confirmExport = () => {
    const selectedType = dataTypes.find(t => t.value === selectedDataType);
    if (!selectedType) return;

    messageApi.success(`开始导出${selectedType.label}数据...`);
    setExportModalVisible(false);

    // 模拟创建导出任务
    const newTask: ExportTask = {
      id: Date.now(),
      dataType: selectedType.label,
      fileName: `${selectedType.label}-${new Date().toISOString().split('T')[0]}.xlsx`,
      status: 'processing',
      recordCount: Math.floor(Math.random() * 500) + 50,
      progress: 0,
      startTime: new Date().toLocaleString(),
    };

    setExportTasks(prev => [newTask, ...prev]);

    // 模拟导出进度
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // 完成导出
        setExportTasks(prev => prev.map(task =>
          task.id === newTask.id ? {
            ...task,
            status: 'completed',
            progress: 100,
            endTime: new Date().toLocaleString(),
            downloadUrl: `/downloads/${newTask.fileName}`,
          } : task
        ));

        messageApi.success(`${selectedType.label}导出完成！`);
      } else {
        setExportTasks(prev => prev.map(task =>
          task.id === newTask.id ? { ...task, progress: Math.round(progress) } : task
        ));
      }
    }, 1000);
  };

  // 下载文件
  const handleDownload = (task: ExportTask) => {
    if (task.downloadUrl) {
      const link = document.createElement('a');
      link.href = task.downloadUrl;
      link.download = task.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      messageApi.success('文件下载开始');
    }
  };

  // 导入任务表格列定义
  const importColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap = {
          pending: { text: '待处理', color: 'default' },
          processing: { text: '处理中', color: 'processing' },
          completed: { text: '完成', color: 'success' },
          failed: { text: '失败', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 120,
      render: (progress: number, record: ImportTask) => (
        <div>
          <Progress percent={progress} size="small" status={record.status === 'failed' ? 'exception' : undefined} />
          {record.status === 'completed' && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              成功: {record.successRecords} | 失败: {record.failedRecords}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 160,
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ImportTask) => (
        <Space>
          {record.status === 'completed' && record.failedRecords > 0 && (
            <Button size="small" type="link" onClick={() => messageApi.info('查看失败详情功能开发中...')}>
              失败详情
            </Button>
          )}
          {record.status === 'failed' && (
            <Button size="small" type="link" onClick={() => messageApi.info(record.errorMessage || '查看错误详情')}>
              错误详情
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 导出任务表格列定义
  const exportColumns = [
    {
      title: '数据类型',
      dataIndex: 'dataType',
      width: 120,
    },
    {
      title: '文件名',
      dataIndex: 'fileName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap = {
          pending: { text: '待处理', color: 'default' },
          processing: { text: '处理中', color: 'processing' },
          completed: { text: '完成', color: 'success' },
          failed: { text: '失败', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '记录数',
      dataIndex: 'recordCount',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 120,
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: ExportTask) => (
        <Space>
          {record.status === 'completed' && record.downloadUrl && (
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 导入导出控制面板 */}
      <Card title="数据导入导出" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 导入区域 */}
          <div>
            <h4>数据导入</h4>
            <Space>
              <span>数据类型：</span>
              <Select
                value={selectedDataType}
                onChange={setSelectedDataType}
                style={{ width: 150 }}
                options={dataTypes.map(type => ({
                  label: type.label,
                  value: type.value,
                }))}
              />
              <Upload {...uploadProps}>
                <Button type="primary" icon={<UploadOutlined />}>
                  选择文件导入
                </Button>
              </Upload>
            </Space>

            <Alert
              message="导入说明"
              description={
                <div>
                  <p>• 支持 Excel 格式文件 (.xlsx, .xls)</p>
                  <p>• 文件大小不超过 10MB</p>
                  <p>• {dataTypes.find(t => t.value === selectedDataType)?.description}</p>
                  <p>• 导入过程中请勿关闭页面</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 12 }}
            />
          </div>

          {/* 导出区域 */}
          <div style={{ marginTop: 24 }}>
            <h4>数据导出</h4>
            <Space>
              <span>数据类型：</span>
              <Select
                value={selectedDataType}
                onChange={setSelectedDataType}
                style={{ width: 150 }}
                options={dataTypes.map(type => ({
                  label: type.label,
                  value: type.value,
                }))}
              />
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                导出数据
              </Button>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 导入任务列表 */}
      <Card title="导入任务记录" style={{ marginBottom: 16 }}>
        <Table
          columns={importColumns}
          dataSource={mockImportTasks}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 导出任务列表 */}
      <Card title="导出任务记录">
        <Table
          columns={exportColumns}
          dataSource={mockExportTasks}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 导出确认Modal */}
      <Modal
        title="确认导出"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onOk={confirmExport}
        okText="开始导出"
        cancelText="取消"
      >
        <div>
          <p>确定要导出 <strong>{dataTypes.find(t => t.value === selectedDataType)?.label}</strong> 数据吗？</p>
          <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            导出文件将包含所有相关数据，文件较大时可能需要等待一段时间。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default DataImportExportPage;
