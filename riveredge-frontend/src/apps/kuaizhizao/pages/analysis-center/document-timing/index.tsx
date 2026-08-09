/**
 * 单据耗时统计页面（节点时效）
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Table, Descriptions, Typography, Timeline, Button, Empty } from 'antd';
import { EyeOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { apiRequest } from '../../../../../services/api';
import { getDocumentTimingLifecycle } from '../../../utils/documentTimingLifecycle';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { downloadFile } from '../../../../../utils/fileDownload';

interface DocumentTiming {
  document_type?: string;
  document_id?: number;
  document_code?: string;
  total_duration_seconds?: number;
  total_duration_hours?: number;
  nodes?: DocumentNode[];
}

interface DocumentNode {
  id?: number;
  node_name?: string;
  node_code?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  duration_hours?: number;
  operator_name?: string;
}

const TIMING_RESOURCE = 'kuaizhizao:document-timing';

const DocumentTimingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(TIMING_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentTiming, setCurrentTiming] = useState<DocumentTiming | null>(null);
  const [exporting, setExporting] = useState(false);
  const lastRowsRef = useRef<DocumentTiming[]>([]);

  const docTypeLabel = (type?: string) => {
    if (type === 'work_order') return t('app.kuaireport.analysis.docType.workOrder', { defaultValue: '工单' });
    if (type === 'purchase_order') return t('app.kuaireport.analysis.docType.purchaseOrder', { defaultValue: '采购订单' });
    if (type === 'sales_order') return t('app.kuaireport.analysis.docType.salesOrder', { defaultValue: '销售订单' });
    return type || '-';
  };

  const handleDetail = async (record: DocumentTiming) => {
    try {
      const result = await apiRequest(
        `/apps/kuaizhizao/documents/${record.document_type}/${record.document_id}/timing`,
        { method: 'GET' },
      );
      setCurrentTiming(result);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error(t('app.kuaireport.analysis.timing.loadDetailFailed', { defaultValue: '获取耗时统计失败' }));
    }
  };

  const handleExport = () => {
    const rows = lastRowsRef.current;
    if (!rows.length) {
      messageApi.warning(t('app.kuaireport.analysis.exportEmpty', { defaultValue: '暂无数据可导出' }));
      return;
    }
    setExporting(true);
    try {
      const headers = ['单据类型', '单据编号', '总耗时(小时)', '总耗时(秒)'];
      const lines = [
        headers.join(','),
        ...rows.map((r) =>
          [
            docTypeLabel(r.document_type),
            r.document_code ?? '',
            r.total_duration_hours?.toFixed(2) ?? '',
            r.total_duration_seconds ?? '',
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ];
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `document-timing_${new Date().toISOString().slice(0, 10)}.csv`);
      messageApi.success(t('app.kuaireport.analysis.exportSuccess', { defaultValue: '导出成功' }));
    } finally {
      setExporting(false);
    }
  };

  const columns: ProColumns<DocumentTiming>[] = [
    {
      title: t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' }),
      dataIndex: 'document_type',
      width: 120,
      valueEnum: {
        work_order: { text: docTypeLabel('work_order'), status: 'processing' },
        purchase_order: { text: docTypeLabel('purchase_order'), status: 'default' },
        sales_order: { text: docTypeLabel('sales_order'), status: 'success' },
      },
      render: (_, record) => docTypeLabel(record.document_type),
    },
    {
      title: t('app.kuaireport.analysis.col.documentCode', { defaultValue: '单据编号' }),
      dataIndex: 'document_code',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.document_code ?? '') }} ellipsis>
          {r.document_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaireport.analysis.col.dateRange', { defaultValue: '时间范围' }),
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { transform: (v) => ({ date_start: v?.[0], date_end: v?.[1] }) },
    },
    {
      title: t('app.kuaireport.analysis.col.totalHours', { defaultValue: '总耗时（小时）' }),
      dataIndex: 'total_duration_hours',
      width: 120,
      align: 'right',
      search: false,
      render: (_, record) => record.total_duration_hours?.toFixed(2) || '-',
    },
    {
      title: t('app.kuaireport.analysis.col.lifecycle', { defaultValue: '执行状态' }),
      dataIndex: 'lifecycle_stage',
      key: 'lifecycle',
      fixed: 'right',
      search: false,
      render: (_, record) => (
        <UniLifecycle {...getDocumentTimingLifecycle(record)} showCircleTooltip={false} />
      ),
    },
    {
      title: t('common.actions', { defaultValue: '操作' }),
      width: 100,
      fixed: 'right',
      search: false,
      render: (_, record) => (
        <a onClick={() => handleDetail(record)}>
          <EyeOutlined /> {t('common.detail', { defaultValue: '详情' })}
        </a>
      ),
    },
  ];

  const nodeColumns = [
    { title: t('app.kuaireport.analysis.col.nodeName', { defaultValue: '节点名称' }), dataIndex: 'node_name', key: 'node_name', width: 120 },
    { title: t('app.kuaireport.analysis.col.startTime', { defaultValue: '开始时间' }), dataIndex: 'start_time', key: 'start_time', width: 160 },
    { title: t('app.kuaireport.analysis.col.endTime', { defaultValue: '结束时间' }), dataIndex: 'end_time', key: 'end_time', width: 160 },
    {
      title: t('app.kuaireport.analysis.col.durationHours', { defaultValue: '耗时（小时）' }),
      dataIndex: 'duration_hours',
      key: 'duration_hours',
      width: 120,
      align: 'right' as const,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    { title: t('app.kuaireport.analysis.col.operator', { defaultValue: '操作人' }), dataIndex: 'operator_name', key: 'operator_name', width: 100 },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaireport.analysis.timing.title', { defaultValue: '单据节点耗时' })}
        actionRef={actionRef}
        columnPersistenceId="apps.kuaizhizao.pages.analysis-center.document-timing"rowKey={(r) => `${r.document_type}-${r.document_id}-${r.document_code}`}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        toolBarRender={() => {
          const actions: React.ReactNode[] = [];
          if (perms.canExport) {
            actions.push(
              <Button key="export" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
                {t('common.export', { defaultValue: '导出' })}
              </Button>,
            );
          }
          if (perms.canPrint) {
            actions.push(
              <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
                {t('common.print', { defaultValue: '打印' })}
              </Button>,
            );
          }
          return actions;
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaireport.analysis.timing.empty', {
                defaultValue: '暂无节点耗时数据（目前主要来自工单生命周期节点记录）',
              })}
            />
          ),
        }}
        request={async (params: any) => {
          try {
            const result = await apiRequest<DocumentTiming[]>('/apps/kuaizhizao/documents/timing', {
              method: 'GET',
              params: {
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                document_type: params.document_type,
                date_start: params.date_start,
                date_end: params.date_end,
              },
            });
            const data = Array.isArray(result) ? result : [];
            lastRowsRef.current = data;
            return {
              data,
              success: true,
              // 后端按 limit 截断且无 total；用本页长度近似，满页时提示仍有更多
              total: data.length < (params.pageSize || 20)
                ? ((params.current || 1) - 1) * (params.pageSize || 20) + data.length
                : ((params.current || 1) * (params.pageSize || 20)) + 1,
            };
          } catch {
            messageApi.error(t('app.kuaireport.analysis.timing.loadListFailed', { defaultValue: '获取单据列表失败' }));
            return { data: [], success: false, total: 0 };
          }
        }}
        showAdvancedSearch
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaireport.analysis.timing.detailTitle', { defaultValue: '耗时统计' })} - ${currentTiming?.document_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTiming(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentTiming ? (
            <>
              <DetailDrawerSection title={t('common.basicInfo', { defaultValue: '基本信息' })}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label={t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' })}>
                    <Tag
                      color={
                        currentTiming.document_type === 'work_order'
                          ? 'processing'
                          : currentTiming.document_type === 'purchase_order'
                            ? 'default'
                            : 'success'
                      }
                    >
                      {docTypeLabel(currentTiming.document_type)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaireport.analysis.col.documentCode', { defaultValue: '单据编号' })}>
                    <Typography.Text copyable={{ text: String(currentTiming.document_code ?? '') }}>
                      {currentTiming.document_code ?? '-'}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaireport.analysis.col.totalHours', { defaultValue: '总耗时（小时）' })}>
                    {currentTiming.total_duration_hours?.toFixed(2) ?? '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaireport.analysis.col.totalSeconds', { defaultValue: '总耗时（秒）' })}>
                    {currentTiming.total_duration_seconds ?? '-'}
                  </Descriptions.Item>
                </Descriptions>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaireport.analysis.col.lifecycle', { defaultValue: '生命周期' })}>
                <UniLifecycle {...getDocumentTimingLifecycle(currentTiming)} showCircleTooltip={false} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaireport.analysis.timing.nodeDetail', { defaultValue: '节点明细' })}>
                {(currentTiming.nodes || []).length ? (
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      columns={nodeColumns}
                      dataSource={currentTiming.nodes || []}
                      rowKey={(r) => String(r.id ?? r.node_code ?? Math.random())}
                      pagination={false}
                      size="small"
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaireport.analysis.timing.noNodes', { defaultValue: '暂无节点明细' })} />
                )}
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaireport.analysis.timing.timeline', { defaultValue: '节点时间线' })} marginBottom={0}>
                {(currentTiming.nodes || []).length ? (
                  <Timeline
                    items={(currentTiming.nodes || []).slice(0, 12).map((n, i) => ({
                      key: String(n.id ?? i),
                      color: 'blue',
                      children: (
                        <>
                          {n.node_name || n.node_code || t('app.kuaireport.analysis.col.node', { defaultValue: '节点' })}
                          {' '}
                          {n.end_time || n.start_time ? `${n.start_time ?? ''} → ${n.end_time ?? ''}` : '-'}
                          {n.operator_name ? ` - ${n.operator_name}` : ''}
                        </>
                      ),
                    }))}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    {t('app.kuaireport.analysis.timing.noTimeline', { defaultValue: '暂无节点级时间线' })}
                  </Typography.Text>
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default DocumentTimingPage;
