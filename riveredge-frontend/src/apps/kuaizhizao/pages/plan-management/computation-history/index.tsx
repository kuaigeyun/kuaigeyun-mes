/**
 * 需求计算历史记录查询页面
 *
 * 提供需求计算历史记录查询、结果对比、计算差异分析等功能。
 */

import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Space, Modal, Table, Card, Row, Col, Statistic, Divider } from 'antd';
import { DiffOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { MaterialStackedCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  listComputationHistory,
  getDemandComputation,
  compareComputations,
  deleteDemandComputation,
  DemandComputation,
  ComputationCompareResult,
} from '../../../services/demand-computation';
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor } from '../../../utils/businessMode';

const ComputationHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState<ComputationCompareResult | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const statusMap = useMemo(
    () => ({
      进行中: { text: t('app.kuaizhizao.computationHistory.status.inProgress'), color: 'processing' },
      计算中: { text: t('app.kuaizhizao.computationHistory.status.computing'), color: 'processing' },
      完成: { text: t('app.kuaizhizao.computationHistory.status.completed'), color: 'success' },
      失败: { text: t('app.kuaizhizao.computationHistory.status.failed'), color: 'error' },
    }),
    [t]
  );

  const handleCompare = async (keys: React.Key[]) => {
    if (keys.length !== 2) {
      messageApi.warning(t('app.kuaizhizao.computationHistory.compareSelectTwo'));
      return;
    }

    const id1 = Number(keys[0]);
    const id2 = Number(keys[1]);

    try {
      const result = await compareComputations(id1, id2);
      setCompareResult(result);
      setCompareModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.computationHistory.compareFailed'));
    }
  };

  const handleExport = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.computationHistory.exportSelect'));
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
          // skip failed records
        }
      }
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.computationHistory.exportNoData'));
        return;
      }
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `computation-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('app.kuaizhizao.computationHistory.exportSuccess', { count: items.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.computationHistory.exportFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (Number.isNaN(id)) {
        failed += 1;
        continue;
      }
      try {
        await deleteDemandComputation(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(t('app.kuaizhizao.computationHistory.deleteSuccess', { count: success }));
    if (failed > 0) messageApi.warning(t('app.kuaizhizao.computationHistory.deleteFailed', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const columns: ProColumns<DemandComputation>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.computationHistory.col.computationCode'),
        dataIndex: 'computation_code',
        width: 150,
        fixed: 'left',
      },
      {
        title: t('app.kuaizhizao.computationHistory.col.demandCode'),
        dataIndex: 'demand_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.computationHistory.col.businessMode'),
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
        title: t('app.kuaizhizao.computationHistory.col.computationStatus'),
        dataIndex: 'computation_status',
        width: 100,
        valueEnum: {
          进行中: { text: statusMap['进行中'].text, status: 'Processing' },
          计算中: { text: statusMap['计算中'].text, status: 'Processing' },
          完成: { text: statusMap['完成'].text, status: 'Success' },
          失败: { text: statusMap['失败'].text, status: 'Error' },
        },
        render: (_, record) => {
          const status = statusMap[record.computation_status as keyof typeof statusMap] || statusMap['进行中'];
          return <Tag color={status.color}>{status.text}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.computationHistory.col.computationStartTime'),
        dataIndex: 'computation_start_time',
        width: 180,
        valueType: 'dateTime',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.computationHistory.col.computationEndTime'),
        dataIndex: 'computation_end_time',
        width: 180,
        valueType: 'dateTime',
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.computationHistory.col.createdAt'),
        dataIndex: 'created_at',
        width: 180,
        valueType: 'dateTime',
        hideInSearch: true,
      },
    ],
    [statusMap, t]
  );

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
    } catch {
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const renderDiffCell = (record: any, field: string) => {
    if (!record.exists_in_both) {
      return (
        <Tag color="warning">
          {t('app.kuaizhizao.computationHistory.compare.onlyIn', {
            which:
              record.only_in === 'computation1'
                ? t('app.kuaizhizao.computationHistory.compare.computation1')
                : t('app.kuaizhizao.computationHistory.compare.computation2'),
          })}
        </Tag>
      );
    }
    const diff = record.differences?.[field];
    if (diff) {
      const diffValue = diff.diff && diff.diff > 0 ? `+${diff.diff}` : String(diff.diff ?? '');
      return (
        <div>
          <div>{t('app.kuaizhizao.computationHistory.compare.value1', { value: diff.value1 })}</div>
          <div>{t('app.kuaizhizao.computationHistory.compare.value2', { value: diff.value2 })}</div>
          <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
            {t('app.kuaizhizao.computationHistory.compare.diff', { diff: diffValue })}
          </div>
        </div>
      );
    }
    return <Tag color="success">{t('app.kuaizhizao.computationHistory.compare.same')}</Tag>;
  };

  const compareColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.computationHistory.compareCol.material'),
        key: 'material',
        width: 220,
        render: (_: unknown, record: { material_name?: string; material_code?: string }) => (
          <MaterialStackedCell material_name={record.material_name} material_code={record.material_code} />
        ),
      },
      {
        title: t('app.kuaizhizao.computationHistory.compareCol.requiredQuantity'),
        key: 'required_quantity',
        width: 120,
        render: (_: any, record: any) => renderDiffCell(record, 'required_quantity'),
      },
      {
        title: t('app.kuaizhizao.computationHistory.compareCol.netRequirement'),
        key: 'net_requirement',
        width: 120,
        render: (_: any, record: any) =>
          !record.exists_in_both ? '—' : renderDiffCell(record, 'net_requirement'),
      },
      {
        title: t('app.kuaizhizao.computationHistory.compareCol.suggestedWorkOrderQty'),
        key: 'suggested_work_order_quantity',
        width: 150,
        render: (_: any, record: any) =>
          !record.exists_in_both ? '—' : renderDiffCell(record, 'suggested_work_order_quantity'),
      },
      {
        title: t('app.kuaizhizao.computationHistory.compareCol.suggestedPurchaseQty'),
        key: 'suggested_purchase_order_quantity',
        width: 150,
        render: (_: any, record: any) =>
          !record.exists_in_both ? '—' : renderDiffCell(record, 'suggested_purchase_order_quantity'),
      },
    ],
    [t]
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<DemandComputation>
          columnPersistenceId="apps.kuaizhizao.pages.plan-management.computation-history"
          actionRef={actionRef}
          columns={columns}
          request={handleRequest}
          rowKey="id"
          showAdvancedSearch={true}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={(keys) => setSelectedRowKeys(keys)}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.computationHistory.deleteConfirm', { count })}
          toolBarActionsAfterDelete={[
            <UniBatchMenuButton
              key="computation-history-batch-menu"
              selectedRowKeys={selectedRowKeys}
              menuItems={[
                {
                  key: 'compare',
                  label: t('app.kuaizhizao.computationHistory.action.compareSelected'),
                  icon: <DiffOutlined />,
                  disabled: selectedRowKeys.length !== 2,
                  onClick: (keys) => void handleCompare(keys),
                },
                {
                  key: 'export',
                  label: t('app.kuaizhizao.computationHistory.action.exportSelected'),
                  icon: <DownloadOutlined />,
                  disabled: selectedRowKeys.length === 0,
                  onClick: (keys) => void handleExport(keys),
                },
              ]}
              toolBarButtonSize="middle"
            />,
          ]}
        />
      </ListPageTemplate>

      <Modal
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        title={t('app.kuaizhizao.computationHistory.compareModal.title')}
        width={MODAL_CONFIG.LARGE_WIDTH}
        footer={null}
      >
        {compareResult && (
          <div>
            <Card title={t('app.kuaizhizao.computationHistory.compareModal.basicInfo')} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    size="small"
                    title={t('app.kuaizhizao.computationHistory.compareModal.computation1', {
                      code: compareResult.computation1.computation_code,
                    })}
                  >
                    <Statistic
                      title={t('app.kuaizhizao.computationHistory.compareModal.businessMode')}
                      value={
                        compareResult.basic_diff.business_mode?.value1 ??
                        compareResult.basic_diff.computation_type.value1
                      }
                      styles={{
                        content: {
                          color:
                            (compareResult.basic_diff.business_mode?.same ??
                              compareResult.basic_diff.computation_type.same)
                              ? '#3f8600'
                              : '#cf1322',
                        },
                      }}
                    />
                    <Divider />
                    <div>
                      <strong>{t('app.kuaizhizao.computationHistory.compareModal.startTime')}</strong>{' '}
                      {compareResult.computation1.computation_start_time || '-'}
                    </div>
                    <div>
                      <strong>{t('app.kuaizhizao.computationHistory.compareModal.endTime')}</strong>{' '}
                      {compareResult.computation1.computation_end_time || '-'}
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card
                    size="small"
                    title={t('app.kuaizhizao.computationHistory.compareModal.computation2', {
                      code: compareResult.computation2.computation_code,
                    })}
                  >
                    <Statistic
                      title={t('app.kuaizhizao.computationHistory.compareModal.businessMode')}
                      value={
                        compareResult.basic_diff.business_mode?.value2 ??
                        compareResult.basic_diff.computation_type.value2
                      }
                      styles={{
                        content: {
                          color:
                            (compareResult.basic_diff.business_mode?.same ??
                              compareResult.basic_diff.computation_type.same)
                              ? '#3f8600'
                              : '#cf1322',
                        },
                      }}
                    />
                    <Divider />
                    <div>
                      <strong>{t('app.kuaizhizao.computationHistory.compareModal.startTime')}</strong>{' '}
                      {compareResult.computation2.computation_start_time || '-'}
                    </div>
                    <div>
                      <strong>{t('app.kuaizhizao.computationHistory.compareModal.endTime')}</strong>{' '}
                      {compareResult.computation2.computation_end_time || '-'}
                    </div>
                  </Card>
                </Col>
              </Row>
            </Card>

            <Card
              title={t('app.kuaizhizao.computationHistory.compareModal.itemsDiff', {
                count: compareResult.total_differences,
              })}
            >
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
