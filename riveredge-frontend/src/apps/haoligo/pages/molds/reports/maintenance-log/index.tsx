/**
 * 好力 GO — 厂内维保记录（统计报表：以维保完修单为事实口径，支持时间/类型筛选与导出）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  listMoldMaintenanceCompleteSheets,
  type MoldMaintenanceCompleteSheetRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { parseMoldReportCreatedRange } from '../../../../utils/moldReportDateRange';

const serviceTypeEnum: Record<string, { text: string }> = {
  维修: { text: '维修' },
  保养: { text: '保养' },
};

const MoldInhouseMaintenanceLogReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<MoldMaintenanceCompleteSheetRow>[] = [
    {
      title: '创建时间',
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { placeholder: ['开始日期', '结束日期'] },
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '完修单号/来源单号/申请人/部门' },
    },
    {
      title: '完修单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, hideInSearch: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '申请部门', dataIndex: 'department_name', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '维修/保养',
      dataIndex: 'service_type',
      valueType: 'select',
      valueEnum: serviceTypeEnum,
      width: 100,
      fieldProps: { allowClear: true },
    },
    {
      title: '保养内容 / 维修摘要',
      key: 'completion_summary',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const items = r.line_items || [];
        if (r.service_type === '保养') {
          const parts = items
            .map((it) => (it.upkeep_content && String(it.upkeep_content).trim()) || '')
            .filter(Boolean);
          return parts.length ? parts.join('；') : '—';
        }
        const parts: string[] = [];
        for (const it of items) {
          const rr = (it.repair_result && String(it.repair_result).trim()) || '';
          const rc = (it.repair_content && String(it.repair_content).trim()) || '';
          if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
        }
        return parts.length ? parts.join('；') : '—';
      },
    },
    {
      title: '清空总产量',
      dataIndex: 'clear_total_production',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        if (r.service_type !== '保养') return '—';
        const items = r.line_items || [];
        if (!items.length) return r.clear_total_production ? '是' : '否';
        const flags = items.map((i) => Boolean(i.clear_total_production));
        if (flags.every(Boolean)) return '是';
        if (!flags.some(Boolean)) return '否';
        return '部分';
      },
    },
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '模具条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
    },
    moldDocumentCreatedAtColumn<MoldMaintenanceCompleteSheetRow>(),
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldMaintenanceCompleteSheetRow>
        headerTitle="厂内维保记录"
        columnPersistenceId="apps.haoligo.pages.molds.reports.maintenance-log"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        request={async (params, _sort, _filter, searchFormValues) => {
          const current = params.current ?? 1;
          const pageSize = params.pageSize ?? 20;
          const skip = (current - 1) * pageSize;
          const range = parseMoldReportCreatedRange(searchFormValues as Record<string, unknown>);
          try {
            const res = await listMoldMaintenanceCompleteSheets({
              skip,
              limit: pageSize,
              keyword:
                typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                  ? searchFormValues.keyword.trim()
                  : undefined,
              service_type:
                typeof searchFormValues?.service_type === 'string' && searchFormValues.service_type
                  ? searchFormValues.service_type
                  : undefined,
              ...range,
            });
            return {
              data: res.items,
              success: true,
              total: res.total,
            };
          } catch (e) {
            messageApi.error((e as Error).message || '加载厂内维保记录失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default MoldInhouseMaintenanceLogReportPage;
