/**
 * 需求计算历史记录查询页面
 *
 * 提供需求计算历史记录查询、结果对比、计算差异分析等功能。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Card, Row, Col, Statistic, Divider } from 'antd';
import { EyeOutlined, CompareArrowsOutlined, DownloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { 
  listComputationHistory, 
  getDemandComputation,
  compareComputations,
  DemandComputation,
  ComputationCompareResult
} from '../../../services/demand-computation';

const ComputationHistoryPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // 对比Modal状态
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState<ComputationCompareResult | null>(null);
  const [selectedComputation1, setSelectedComputation1] = useState<number | null>(null);
  const [selectedComputation2, setSelectedComputation2] = useState<number | null>(null);
  
  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /**
   * 处理对比
   */
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
      setSelectedComputation1(id1);
      setSelectedComputation2(id2);
      setCompareModalVisible(true);
    } catch (error: any) {
      messageApi.error('对比失败');
    }
  };

  /**
   * 处理导出
   */
  const handleExport = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要导出的记录');
      return;
    }
    
    // TODO: 实现导出功能
    messageApi.info('导出功能开发中');
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = [
    {
      title: '计算编码',
      dataIndex: 'computation_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 150,
    },
    {
      title: '计算类型',
      dataIndex: 'computation_type',
      width: 100,
      valueEnum: {
        MRP: { text: '按预测', status: 'Processing' },
        LRP: { text: '按订单', status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.computation_type === 'MRP' ? 'processing' : 'success'}>
          {record.computation_type === 'MRP' ? '按预测' : '按订单'}
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
      valueType: 'dateTime',
      sorter: true,
    },
    {
      title: '计算结束时间',
      dataIndex: 'computation_end_time',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
  ];

  /**
   * 处理表格请求
   */
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
      return {
        data: response.data,
        success: true,
        total: response.total,
      };
    } catch (error) {
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  /**
   * 对比结果表格列定义
   */
  const compareColumns = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      key: 'material_code',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 200,
    },
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
        if (!record.exists_in_both) {
          return '-';
        }
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
        if (!record.exists_in_both) {
          return '-';
        }
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
        if (!record.exists_in_both) {
          return '-';
        }
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

  return (
    <>
      <ListPageTemplate>
        <UniTable<DemandComputation>
          actionRef={actionRef}
          columns={columns}
          request={handleRequest}
          rowKey="id"
          showAdvancedSearch={true}
          enableRowSelection={true}
          enableRowSelection={true}
          onRowSelectionChange={(keys) => setSelectedRowKeys(keys)}
          toolBarActions={[
            <Button
              key="compare"
              icon={<CompareArrowsOutlined />}
              onClick={() => handleCompare(selectedRowKeys)}
              disabled={selectedRowKeys.length !== 2}
            >
              对比选中记录
            </Button>,
            <Button
              key="export"
              icon={<DownloadOutlined />}
              onClick={() => handleExport(selectedRowKeys)}
              disabled={selectedRowKeys.length === 0}
            >
              导出选中记录
            </Button>,
          ]}
        />
      </ListPageTemplate>

      {/* 对比结果Modal */}
      <Modal
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        title="计算结果对比"
        width={1200}
        footer={null}
      >
        {compareResult && (
          <div>
            {/* 基本信息对比 */}
            <Card title="基本信息对比" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title={`计算1: ${compareResult.computation1.computation_code}`}>
                    <Statistic
                      title="计算类型"
                      value={compareResult.basic_diff.computation_type.value1}
                      valueStyle={{ color: compareResult.basic_diff.computation_type.same ? '#3f8600' : '#cf1322' }}
                    />
                    <Divider />
                    <div>
                      <strong>计算开始时间:</strong> {compareResult.computation1.computation_start_time || '-'}
                    </div>
                    <div>
                      <strong>计算结束时间:</strong> {compareResult.computation1.computation_end_time || '-'}
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title={`计算2: ${compareResult.computation2.computation_code}`}>
                    <Statistic
                      title="计算类型"
                      value={compareResult.basic_diff.computation_type.value2}
                      valueStyle={{ color: compareResult.basic_diff.computation_type.same ? '#3f8600' : '#cf1322' }}
                    />
                    <Divider />
                    <div>
                      <strong>计算开始时间:</strong> {compareResult.computation2.computation_start_time || '-'}
                    </div>
                    <div>
                      <strong>计算结束时间:</strong> {compareResult.computation2.computation_end_time || '-'}
                    </div>
                  </Card>
                </Col>
              </Row>
            </Card>

            {/* 明细项差异 */}
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

export default ComputationHistoryPage;
