/**
 * 好力 GO — 外协维修记录（统计报表：以外协维修完成单为事实口径，含审核状态筛选）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  listMoldOutsourceMaintenanceCompleteSheets,
  type MoldOutsourceMaintenanceCompleteSheetRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';
import { parseMoldReportCreatedRange } from '../../../../utils/moldReportDateRange';

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

const MoldOutsourceMaintenanceLogReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<MoldOutsourceMaintenanceCompleteSheetRow>[] = [
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
      fieldProps: { placeholder: '完修单号/来源单号/外协单位/申请人' },
    },
    {
      title: '外协维修完成单号',
      dataIndex: 'sheet_no',
      width: 168,
      ellipsis: true,
      hideInSearch: true,
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, hideInSearch: true },
    {
      title: '外协单位',
      dataIndex: 'outsourced_unit_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '申请部门', dataIndex: 'department_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '维修/保养', dataIndex: 'service_type', width: 100, hideInSearch: true },
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      width: 120,
      fieldProps: { allowClear: true },
      render: (_, r) => moldSheetAuditStatusTag(r.sheet_status),
    },
    {
      title: '维修摘要',
      key: 'repair_summary',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const items = r.line_items || [];
        const parts: string[] = [];
        for (const it of items) {
          const rr = (it.repair_result && String(it.repair_result).trim()) || '';
          const rc = (it.repair_content && String(it.repair_content).trim()) || '';
          if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
        }
        return parts.length ? parts.join('；') : '—';
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
    moldDocumentCreatedAtColumn<MoldOutsourceMaintenanceCompleteSheetRow>(),
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldOutsourceMaintenanceCompleteSheetRow>
        headerTitle="外协维修记录"
        columnPersistenceId="apps.haoligo.pages.molds.reports.outsource-maintenance-log"
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
            const res = await listMoldOutsourceMaintenanceCompleteSheets({
              skip,
              limit: pageSize,
              keyword:
                typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                  ? searchFormValues.keyword.trim()
                  : undefined,
              sheet_status:
                typeof searchFormValues?.sheet_status === 'string' && searchFormValues.sheet_status
                  ? searchFormValues.sheet_status
                  : undefined,
              ...range,
            });
            return {
              data: res.items,
              success: true,
              total: res.total,
            };
          } catch (e) {
            messageApi.error((e as Error).message || '加载外协维修记录失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default MoldOutsourceMaintenanceLogReportPage;
