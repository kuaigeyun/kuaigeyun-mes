/**
 * 需求计算 - 历史与对比 Tab
 * 原计算历史页面能力整合至此。
 */

import React, { useMemo, useState } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { App, Button, Modal, Table, Card, Row, Col, Statistic, Divider, Tag } from 'antd';
import { DiffOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  listComputationHistory,
  getDemandComputation,
  compareComputations,
  type DemandComputation,
  type ComputationCompareResult,
} from '../../../services/demand-computation';
import { buildDemandBusinessModeValueEnum } from '../../../utils/businessMode';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  buildComputationStatusValueEnum,
  formatPlanDateTimeCell,
  normalizePlanListResponse,
  resolveComputationHistoryListParams,
} from '../../../utils/planListCore';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';

const ComputationHistoryTab: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState<ComputationCompareResult | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const statusLabels = useMemo(
    () => ({
      进行中: t('app.kuaizhizao.demandComputation.statusInProgress'),
      计算中: t('app.kuaizhizao.demandComputation.statusComputing'),
      完成: t('app.kuaizhizao.demandComputation.statusCompleted'),
      失败: t('app.kuaizhizao.demandComputation.statusFailed'),
    }),
    [t],
  );

  const computationStatusValueEnum = useMemo(() => buildComputationStatusValueEnum(t), [t]);

  const handleCompare = async (keys: React.Key[]) => {
    if (keys.length !== 2) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.selectTwoToCompare'));
      return;
    }
    const id1 = Number(keys[0]);
    const id2 = Number(keys[1]);
    try {
      const result = await compareComputations(id1, id2);
      setCompareResult(result);
      setCompareModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.demandComputation.compareFailed'));
    }
  };

  const handleExport = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.selectRecordsToExport'));
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
        messageApi.warning(t('app.kuaizhizao.demandComputation.noValidExportData'));
        return;
      }
      await downloadRecordsAsXlsx(
        items as Array<Record<string, unknown>>,
        `computation-history-${todaySiteDateString()}.xlsx`,
      );
      messageApi.success(t('app.kuaizhizao.demandComputation.exportedCount', { count: items.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.demandComputation.exportFailed'));
    }
  };

  const columns: ProColumns<DemandComputation>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.demandComputation.colStartTime'),
        dataIndex: 'computation_start_time_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.demandComputation.colComputationCode'),
        dataIndex: 'computation_code',
        width: 168,
        fixed: 'left',
        hideInSearch: false,
        sorter: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.demandComputation.colSourceNo'),
        dataIndex: 'demand_code',
        width: 150,
        hideInSearch: false,
        sorter: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
        dataIndex: 'business_mode',
        width: 140,
        uniTableKeepWidth: true,
        valueType: 'select',
        sorter: true,
        hideInSearch: false,
        valueEnum: buildDemandBusinessModeValueEnum((mode) => {
          if (mode === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMts');
          if (mode === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMto');
          return t('app.kuaizhizao.demandManagement.businessModeAto');
        }),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colComputationStatus'),
        dataIndex: 'computation_status',
        width: 110,
        valueType: 'select',
        sorter: true,
        hideInSearch: false,
        valueEnum: computationStatusValueEnum,
        render: (_, record) => {
          const statusMap: Record<string, { text: string; color: string }> = {
            进行中: { text: statusLabels['进行中'], color: 'processing' },
            计算中: { text: statusLabels['计算中'], color: 'processing' },
            完成: { text: statusLabels['完成'], color: 'success' },
            失败: { text: statusLabels['失败'], color: 'error' },
          };
          const status = statusMap[record.computation_status || '进行中'];
          return <Tag color={status.color}>{status.text}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.demandComputation.colComputationStartTime'),
        dataIndex: 'computation_start_time',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => formatDateTimeBySiteSetting(record.computation_start_time),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colComputationEndTime'),
        dataIndex: 'computation_end_time',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => formatDateTimeBySiteSetting(record.computation_end_time),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colCreatedAt'),
        dataIndex: 'created_at',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => formatPlanDateTimeCell(record.created_at),
      },
    ],
    [computationStatusValueEnum, statusLabels, t],
  );

  const compareColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandComputation.colMaterialCode'), dataIndex: 'material_code', key: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.demandComputation.colMaterialName'), dataIndex: 'material_name', key: 'material_name', width: 200 },
      {
        title: t('app.kuaizhizao.demandComputation.colRequiredQty'),
        key: 'required_quantity',
        width: 120,
        render: (_: any, record: any) => {
          if (!record.exists_in_both) {
            return (
              <Tag color="warning">
                {t('app.kuaizhizao.demandComputation.compareOnlyIn', {
                  which:
                    record.only_in === 'computation1'
                      ? t('app.kuaizhizao.demandComputation.compareComputation1')
                      : t('app.kuaizhizao.demandComputation.compareComputation2'),
                })}
              </Tag>
            );
          }
          const diff = record.differences?.required_quantity;
          if (diff) {
            return (
              <div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation1')}: {diff.value1}
                </div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation2')}: {diff.value2}
                </div>
                <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                  {t('app.kuaizhizao.demandComputation.compareDiff')}: {diff.diff && diff.diff > 0 ? '+' : ''}
                  {diff.diff}
                </div>
              </div>
            );
          }
          return <Tag color="success">{t('app.kuaizhizao.demandComputation.compareSame')}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.demandComputation.colNetRequirement'),
        key: 'net_requirement',
        width: 120,
        render: (_: any, record: any) => {
          if (!record.exists_in_both) return '-';
          const diff = record.differences?.net_requirement;
          if (diff) {
            return (
              <div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation1')}: {diff.value1}
                </div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation2')}: {diff.value2}
                </div>
                <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                  {t('app.kuaizhizao.demandComputation.compareDiff')}: {diff.diff && diff.diff > 0 ? '+' : ''}
                  {diff.diff}
                </div>
              </div>
            );
          }
          return <Tag color="success">{t('app.kuaizhizao.demandComputation.compareSame')}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.demandComputation.colSuggestedWorkOrderQty'),
        key: 'suggested_work_order_quantity',
        width: 150,
        render: (_: any, record: any) => {
          if (!record.exists_in_both) return '-';
          const diff = record.differences?.suggested_work_order_quantity;
          if (diff) {
            return (
              <div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation1')}: {diff.value1}
                </div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation2')}: {diff.value2}
                </div>
                <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                  {t('app.kuaizhizao.demandComputation.compareDiff')}: {diff.diff && diff.diff > 0 ? '+' : ''}
                  {diff.diff}
                </div>
              </div>
            );
          }
          return <Tag color="success">{t('app.kuaizhizao.demandComputation.compareSame')}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.demandComputation.colSuggestedPurchaseQty'),
        key: 'suggested_purchase_order_quantity',
        width: 150,
        render: (_: any, record: any) => {
          if (!record.exists_in_both) return '-';
          const diff = record.differences?.suggested_purchase_order_quantity;
          if (diff) {
            return (
              <div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation1')}: {diff.value1}
                </div>
                <div>
                  {t('app.kuaizhizao.demandComputation.compareComputation2')}: {diff.value2}
                </div>
                <div style={{ color: diff.diff && diff.diff > 0 ? 'red' : 'green' }}>
                  {t('app.kuaizhizao.demandComputation.compareDiff')}: {diff.diff && diff.diff > 0 ? '+' : ''}
                  {diff.diff}
                </div>
              </div>
            );
          }
          return <Tag color="success">{t('app.kuaizhizao.demandComputation.compareSame')}</Tag>;
        },
      },
    ],
    [t],
  );

  return (
    <>
      <UniTable<DemandComputation>
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const listParams = resolveComputationHistoryListParams(searchFormValues, sort);
            const response = await listComputationHistory({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...listParams,
            });
            const normalized = normalizePlanListResponse(response);
            return {
              data: normalized.data as DemandComputation[],
              success: response.success !== false,
              total: normalized.total,
            };
          } catch {
            return { data: [], success: false, total: 0 };
          }
        }}
        rowKey="id"
        columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-computation.ComputationHistoryTab"
        viewTypes={['table']}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField="computation_status"
        pinnedTabsValueEnum={computationStatusValueEnum}
        showImportButton={false}
        showExportButton={false}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={(keys) => setSelectedRowKeys(keys)}
        toolBarRender={() => [
          <Button
            key="compare"
            icon={<DiffOutlined />}
            onClick={() => handleCompare(selectedRowKeys)}
            disabled={selectedRowKeys.length !== 2}
          >
            {t('app.kuaizhizao.demandComputation.actionCompareSelected')}
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(selectedRowKeys)}
            disabled={selectedRowKeys.length === 0}
          >
            {t('app.kuaizhizao.demandComputation.actionExportSelected')}
          </Button>,
        ]}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <Modal
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        title={t('app.kuaizhizao.demandComputation.compareTitle')}
        width={MODAL_CONFIG.LARGE_WIDTH}
        footer={null}
      >
        {compareResult && (
          <div>
            <Card title={t('app.kuaizhizao.demandComputation.compareBasicInfo')} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    size="small"
                    title={`${t('app.kuaizhizao.demandComputation.compareComputation1')}: ${compareResult.computation1.computation_code}`}
                  >
                    <Statistic
                      title={t('app.kuaizhizao.demandComputation.colBusinessMode')}
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
                      <strong>{t('app.kuaizhizao.demandComputation.colComputationStartTime')}:</strong>{' '}
                      {formatDateTimeBySiteSetting(compareResult.computation1.computation_start_time)}
                    </div>
                    <div>
                      <strong>{t('app.kuaizhizao.demandComputation.colComputationEndTime')}:</strong>{' '}
                      {formatDateTimeBySiteSetting(compareResult.computation1.computation_end_time)}
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card
                    size="small"
                    title={`${t('app.kuaizhizao.demandComputation.compareComputation2')}: ${compareResult.computation2.computation_code}`}
                  >
                    <Statistic
                      title={t('app.kuaizhizao.demandComputation.colBusinessMode')}
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
                      <strong>{t('app.kuaizhizao.demandComputation.colComputationStartTime')}:</strong>{' '}
                      {formatDateTimeBySiteSetting(compareResult.computation2.computation_start_time)}
                    </div>
                    <div>
                      <strong>{t('app.kuaizhizao.demandComputation.colComputationEndTime')}:</strong>{' '}
                      {formatDateTimeBySiteSetting(compareResult.computation2.computation_end_time)}
                    </div>
                  </Card>
                </Col>
              </Row>
            </Card>
            <Card
              title={t('app.kuaizhizao.demandComputation.compareDiffItems', {
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

export default ComputationHistoryTab;
