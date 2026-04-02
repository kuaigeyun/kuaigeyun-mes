/**
 * 需求计算 - 历史与对比 Tab
 * 原计算历史页面能力整合至此。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { App, Button, Modal, Table, Card, Row, Col, Statistic, Divider, Tag, Space } from 'antd';
import { DiffOutlined, DownloadOutlined } from '@ant-design/icons';
import { MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  listComputationHistory,
  getDemandComputation,
  compareComputations,
  type DemandComputation,
  type ComputationCompareResult,
} from '../../../services/demand-computation';
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor } from '../../../utils/businessMode';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';

const ComputationHistoryTab: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState<ComputationCompareResult | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleCompare = async (keys: React.Key[]) => {
    if (keys.length !== 2) {
      messageApi.warning('请选择两个计算结果进行对比');
      return;
    }
    const id1 = Number(keys[0]);
    const id2 = Number(keys[1]);
    try {
      const result = await compareComputations(id1, id2);
      setCompareResult(result);
      setCompareModalVisible(true);
    } catch {
      messageApi.error('对比失败');
    }
  };

  const handleExport = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要导出的记录');
      return;
    }
    try {
      const items: DemandComputation[] = [];
      for (const k of keys) {
        const id = Number(k);
        if (isNaN(id)) continue;
        try {
          const detail = await getDemandComputation(id, true);
          items.push(detail);
        } catch {
          // skip
        }
      }
      if (items.length === 0) {
        messageApi.warning('无有效数据可导出');
        return;
      }
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `computation-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(`已导出 ${items.length} 条记录`);
    } catch (error: any) {
      messageApi.error(error?.message || '导出失败');
    }
  };

  const columns: ProColumns<DemandComputation>[] = [
    { title: '计算编号', dataIndex: 'computation_code', width: 150, fixed: 'left' },
    { title: '需求编号', dataIndex: 'demand_code', width: 150 },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 110,
      valueEnum: { MTS: { text: 'MTS' }, MTO: { text: 'MTO' }, ATO: { text: 'ATO' } },
      render: (_, record) => (
        <Tag color={getDemandBusinessModeTagColor(record.business_mode)}>
          {getDemandBusinessModeLabel(record.business_mode)}
        </Tag>
      ),
    },
    {
      title: '计算状态',
      dataIndex: 'computation_status',
      width: 100,
      valueEnum: {
        进行中: { text: '进行中', status: 'Processing' },
        计算中: { text: '计算中', status: 'Processing' },
        完成: { text: '完成', status: 'Success' },
        失败: { text: '失败', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          进行中: { text: '进行中', color: 'processing' },
          计算中: { text: '计算中', color: 'processing' },
          完成: { text: '完成', color: 'success' },
          失败: { text: '失败', color: 'error' },
        };
        const status = statusMap[record.computation_status || '进行中'];
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '计算开始时间',
      dataIndex: 'computation_start_time',
      width: 180,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_start_time),
      sorter: true,
    },
    {
      title: '计算结束时间',
      dataIndex: 'computation_end_time',
      width: 180,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_end_time),
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (_, record) => formatDateTimeBySiteSetting(record.created_at),
      hideInSearch: true,
    },
  ];

  const compareColumns = [
    { title: '物料编号', dataIndex: 'material_code', key: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 200 },
    {
      title: '需求数量',
      key: 'required_quantity',
      width: 120,
      render: (_: any, record: any) => {
        if (!record.exists_in_both) {
          return <Tag color="warning">仅存在于{record.only_in === 'computation1' ? '计算1' : '计算2'}</Tag>;
        }
        const diff = record.differences?.required_quantity;
        if (diff) {
          return (
            <div>
              <div>计算1: {diff.value1}</div>
              <div>计算2: {diff.value2}</div>
              <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                差异: {diff.diff && diff.diff > 0 ? '+' : ''}{diff.diff}
              </div>
            </div>
          );
        }
        return <Tag color="success">相同</Tag>;
      },
    },
    {
      title: '净需求',
      key: 'net_requirement',
      width: 120,
      render: (_: any, record: any) => {
        if (!record.exists_in_both) return '-';
        const diff = record.differences?.net_requirement;
        if (diff) {
          return (
            <div>
              <div>计算1: {diff.value1}</div>
              <div>计算2: {diff.value2}</div>
              <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                差异: {diff.diff && diff.diff > 0 ? '+' : ''}{diff.diff}
              </div>
            </div>
          );
        }
        return <Tag color="success">相同</Tag>;
      },
    },
    {
      title: '建议工单数量',
      key: 'suggested_work_order_quantity',
      width: 150,
      render: (_: any, record: any) => {
        if (!record.exists_in_both) return '-';
        const diff = record.differences?.suggested_work_order_quantity;
        if (diff) {
          return (
            <div>
              <div>计算1: {diff.value1}</div>
              <div>计算2: {diff.value2}</div>
              <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                差异: {diff.diff && diff.diff > 0 ? '+' : ''}{diff.diff}
              </div>
            </div>
          );
        }
        return <Tag color="success">相同</Tag>;
      },
    },
    {
      title: '建议采购数量',
      key: 'suggested_purchase_order_quantity',
      width: 150,
      render: (_: any, record: any) => {
        if (!record.exists_in_both) return '-';
        const diff = record.differences?.suggested_purchase_order_quantity;
        if (diff) {
          return (
            <div>
              <div>计算1: {diff.value1}</div>
              <div>计算2: {diff.value2}</div>
              <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                差异: {diff.diff && diff.diff > 0 ? '+' : ''}{diff.diff}
              </div>
            </div>
          );
        }
        return <Tag color="success">相同</Tag>;
      },
    },
  ];

  const handleRequest = async (params: any) => {
    try {
      const response = await listComputationHistory({
        skip: (params.current - 1) * params.pageSize,
        limit: params.pageSize,
        demand_id: params.demand_id,
        computation_type: params.computation_type,
        start_date: params.start_date,
        end_date: params.end_date,
      });
      return { data: response.data, success: true, total: response.total };
    } catch {
      return { data: [], success: false, total: 0 };
    }
  };

  return (
    <>
      <ProTable<DemandComputation>
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        search={false}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as React.Key[]),
        }}
        headerTitle={
          <Space>
            <Button
              icon={<DiffOutlined />}
              onClick={() => handleCompare(selectedRowKeys)}
              disabled={selectedRowKeys.length !== 2}
            >
              对比选中记录
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleExport(selectedRowKeys)}
              disabled={selectedRowKeys.length === 0}
            >
              导出选中记录
            </Button>
          </Space>
        }
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <Modal
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        title="计算结果对比"
        width={MODAL_CONFIG.LARGE_WIDTH}
        footer={null}
      >
        {compareResult && (
          <div>
            <Card title="基本信息对比" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title={`计算1: ${compareResult.computation1.computation_code}`}>
                    <Statistic
                      title="业务模式"
                      value={compareResult.basic_diff.business_mode?.value1 ?? compareResult.basic_diff.computation_type.value1}
                      valueStyle={{
                        color:
                          (compareResult.basic_diff.business_mode?.same ??
                            compareResult.basic_diff.computation_type.same)
                            ? '#3f8600'
                            : '#cf1322',
                      }}
                    />
                    <Divider />
                    <div><strong>计算开始时间:</strong> {formatDateTimeBySiteSetting(compareResult.computation1.computation_start_time)}</div>
                    <div><strong>计算结束时间:</strong> {formatDateTimeBySiteSetting(compareResult.computation1.computation_end_time)}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title={`计算2: ${compareResult.computation2.computation_code}`}>
                    <Statistic
                      title="业务模式"
                      value={compareResult.basic_diff.business_mode?.value2 ?? compareResult.basic_diff.computation_type.value2}
                      valueStyle={{
                        color:
                          (compareResult.basic_diff.business_mode?.same ??
                            compareResult.basic_diff.computation_type.same)
                            ? '#3f8600'
                            : '#cf1322',
                      }}
                    />
                    <Divider />
                    <div><strong>计算开始时间:</strong> {formatDateTimeBySiteSetting(compareResult.computation2.computation_start_time)}</div>
                    <div><strong>计算结束时间:</strong> {formatDateTimeBySiteSetting(compareResult.computation2.computation_end_time)}</div>
                  </Card>
                </Col>
              </Row>
            </Card>
            <Card title={`明细项差异 (共${compareResult.total_differences}项)`}>
              <Table
                columns={compareColumns}
                dataSource={compareResult.items_diff}
                rowKey="material_id"
                pagination={false}
                scroll={{ y: 400 }}
              />
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ComputationHistoryTab;
