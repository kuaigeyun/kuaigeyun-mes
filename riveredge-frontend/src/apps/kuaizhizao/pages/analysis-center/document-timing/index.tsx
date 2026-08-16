/**
 * 单据耗时统计页面（节点时效）
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Empty } from 'antd';
import { EyeOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { apiRequest } from '../../../../../services/api';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { getDocumentTimingLifecycle } from '../../../utils/documentTimingLifecycle';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { downloadFile } from '../../../../../utils/fileDownload';
import { renderReportDocTypeMarker } from '../../../../kuaireport/utils/reportListPresentation';
import { todaySiteDateString } from '../../../../../utils/format';
import {
  DocumentTimingDetailDrawer,
  type DocumentTiming,
} from './DocumentTimingDetailDrawer';

const TIMING_RESOURCE = 'kuaizhizao:document-timing';

const DocumentTimingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(TIMING_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentTiming, setCurrentTiming] = useState<DocumentTiming | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryRef = useRef<{ document_type?: string; document_id?: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const lastRowsRef = useRef<DocumentTiming[]>([]);

  const docTypeLabel = (type?: string) => {
    if (type === 'work_order') return t('app.kuaireport.analysis.docType.workOrder', { defaultValue: '工单' });
    if (type === 'purchase_order') return t('app.kuaireport.analysis.docType.purchaseOrder', { defaultValue: '采购订单' });
    if (type === 'sales_order') return t('app.kuaireport.analysis.docType.salesOrder', { defaultValue: '销售订单' });
    return type || '-';
  };

  const loadDetail = async (documentType?: string, documentId?: number) => {
    if (!documentType || documentId == null) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await apiRequest<DocumentTiming>(
        `/apps/kuaizhizao/documents/${documentType}/${documentId}/timing`,
        { method: 'GET' },
      );
      setCurrentTiming(result);
    } catch (error) {
      setCurrentTiming(null);
      setDetailError(
        getApiErrorMessage(error, t('app.kuaireport.analysis.timing.loadDetailFailed', { defaultValue: '获取耗时统计失败' })),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetail = (record: DocumentTiming) => {
    detailRetryRef.current = { document_type: record.document_type, document_id: record.document_id };
    setDetailDrawerVisible(true);
    setCurrentTiming(null);
    setDetailError(null);
    void loadDetail(record.document_type, record.document_id);
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
      downloadFile(blob, `document-timing_${todaySiteDateString()}.csv`);
      messageApi.success(t('app.kuaireport.analysis.exportSuccess', { defaultValue: '导出成功' }));
    } finally {
      setExporting(false);
    }
  };

  const DOC_TYPE_MARKER_COLOR: Record<string, string> = {
    work_order: 'processing',
    purchase_order: 'default',
    sales_order: 'success',
  };

  const columns: ProColumns<DocumentTiming>[] = [
    {
      title: t('app.kuaireport.analysis.col.documentCode', { defaultValue: '单据编号' }),
      dataIndex: 'document_code',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.document_code ?? '') }} ellipsis>
          {r.document_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' }),
      dataIndex: 'document_type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueEnum: {
        work_order: { text: docTypeLabel('work_order'), status: 'processing' },
        purchase_order: { text: docTypeLabel('purchase_order'), status: 'default' },
        sales_order: { text: docTypeLabel('sales_order'), status: 'success' },
      },
      render: (_, record) =>
        renderReportDocTypeMarker(
          docTypeLabel(record.document_type),
          DOC_TYPE_MARKER_COLOR[String(record.document_type ?? '')] ?? 'processing',
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
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
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
      key: 'action',
      fixed: 'right',
      search: false,
      render: (_, record) => (
        <a onClick={() => handleDetail(record)}>
          <EyeOutlined /> {t('common.detail', { defaultValue: '详情' })}
        </a>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaireport.analysis.timing.title', { defaultValue: '单据节点耗时' })}
        actionRef={actionRef}
        columnPersistenceId="apps.kuaireport.pages.analysis-center.document-timing.list-v1"
        rowKey={(r) => `${r.document_type}-${r.document_id}-${r.document_code}`}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
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
        onTableDataChange={(rows) => {
          lastRowsRef.current = rows;
        }}
      />

      <DocumentTimingDetailDrawer
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTiming(null);
          setDetailError(null);
        }}
        record={currentTiming}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const key = detailRetryRef.current;
          if (key) void loadDetail(key.document_type, key.document_id);
        }}
      />
    </ListPageTemplate>
  );
};

export default DocumentTimingPage;
