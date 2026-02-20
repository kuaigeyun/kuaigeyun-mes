/**
 * 从数据集同步数据 Modal
 *
 * 选择数据集 → 执行查询 → 预览结果 → 确认后回调映射数据
 * 供业务主数据/单据类页面从其他系统（通过数据集）同步数据使用
 */

import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, Table, App, Spin, Empty } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { getDatasetList, executeDatasetQuery } from '../../services/dataset';

export interface SyncFromDatasetModalProps {
  /** 是否可见 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认同步回调，传入映射后的行数据 */
  onConfirm: (rows: Record<string, any>[]) => void;
  /** 弹窗标题（默认：'从数据集同步'） */
  title?: string;
  /** 弹窗宽度（默认：800） */
  width?: number;
  /** 字段映射：数据集列名 -> 目标实体字段名。不传则使用原始列名 */
  fieldMapping?: Record<string, string>;
  /** 最多获取行数（默认：500） */
  limit?: number;
}

/**
 * 从数据集同步数据 Modal
 */
const SyncFromDatasetModal: React.FC<SyncFromDatasetModalProps> = ({
  open,
  onClose,
  onConfirm,
  title = '从数据集同步',
  width = 800,
  fieldMapping,
  limit = 500,
}) => {
  const { message: messageApi } = App.useApp();
  const [datasetOptions, setDatasetOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedDatasetUuid, setSelectedDatasetUuid] = useState<string | undefined>();
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    data: Record<string, any>[];
    columns: string[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedDatasetUuid(undefined);
      setQueryResult(null);
      loadDatasets();
    }
  }, [open]);

  const loadDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const res = await getDatasetList({ page: 1, page_size: 200, is_active: true });
      setDatasetOptions(
        res.items.map((d) => ({
          label: `${d.name} (${d.code})`,
          value: d.uuid,
        }))
      );
    } catch (e: any) {
      messageApi.error(e?.message || '加载数据集列表失败');
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedDatasetUuid) {
      messageApi.warning('请先选择数据集');
      return;
    }
    setExecuting(true);
    setQueryResult(null);
    try {
      const res = await executeDatasetQuery(selectedDatasetUuid, {
        limit,
        offset: 0,
      });
      if (!res.success) {
        messageApi.error(res.error || '查询执行失败');
        return;
      }
      const data = res.data || [];
      const columns = res.columns || (data.length > 0 ? Object.keys(data[0]) : []);
      setQueryResult({ data, columns });
      messageApi.success(`获取到 ${data.length} 条数据`);
    } catch (e: any) {
      messageApi.error(e?.message || '查询执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleConfirm = () => {
    if (!queryResult || queryResult.data.length === 0) {
      messageApi.warning('暂无数据可同步');
      return;
    }
    const rows = fieldMapping && Object.keys(fieldMapping).length > 0
      ? queryResult.data.map((row) => {
          const mapped: Record<string, any> = {};
          for (const [srcKey, targetKey] of Object.entries(fieldMapping)) {
            if (row[srcKey] !== undefined) {
              mapped[targetKey] = row[srcKey];
            }
          }
          return mapped;
        })
      : queryResult.data;
    onConfirm(rows);
    onClose();
  };

  const tableColumns =
    queryResult?.columns.map((col) => ({
      title: fieldMapping?.[col] || col,
      dataIndex: col,
      key: col,
      ellipsis: true,
    })) || [];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={width}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="execute"
          type="default"
          icon={<SyncOutlined />}
          loading={executing}
          disabled={!selectedDatasetUuid}
          onClick={handleExecute}
        >
          执行查询
        </Button>,
        <Button
          key="confirm"
          type="primary"
          disabled={!queryResult || queryResult.data.length === 0}
          onClick={handleConfirm}
        >
          确认同步 ({queryResult?.data.length ?? 0} 条)
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>选择数据集：</span>
        <Select
          placeholder="请选择数据集"
          style={{ width: 320 }}
          loading={loadingDatasets}
          options={datasetOptions}
          value={selectedDatasetUuid}
          onChange={setSelectedDatasetUuid}
          showSearch
          optionFilterProp="label"
          allowClear
        />
      </div>

      {executing && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="正在执行查询..." />
        </div>
      )}

      {!executing && queryResult && (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {queryResult.data.length === 0 ? (
            <Empty description="查询结果为空" />
          ) : (
            <Table
              dataSource={queryResult.data}
              columns={tableColumns}
              rowKey={(_, i) => String(i)}
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          )}
        </div>
      )}

      {!executing && !queryResult && (
        <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>
          选择数据集后点击「执行查询」获取数据
        </div>
      )}
    </Modal>
  );
};

export default SyncFromDatasetModal;
