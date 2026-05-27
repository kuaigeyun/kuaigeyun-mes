/**
 * 好力 GO — 试模记录表（统计报表：多维筛选 + 导出，数据同源试模单）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { listMoldTrialSheets, type MoldTrialSheetRow } from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { parseMoldReportCreatedRange } from '../../../../utils/moldReportDateRange';

const trialResultEnum: Record<string, { text: string }> = {
  合格: { text: '合格' },
  不合格: { text: '不合格' },
};

const MoldTrialRecordReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<MoldTrialSheetRow>[] = [
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
      fieldProps: { placeholder: '单号/订单号/模具代号/名称/供应商' },
    },
    {
      title: '试模单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_no',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具代号',
      dataIndex: 'mold_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具名称',
      dataIndex: 'mold_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '试模次数',
      dataIndex: 'trial_times',
      width: 96,
      hideInSearch: true,
    },
    {
      title: '试模人员',
      dataIndex: 'trial_user_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.trial_user_name || '—',
    },
    {
      title: '试模结果',
      dataIndex: 'trial_result',
      valueType: 'select',
      valueEnum: trialResultEnum,
      width: 100,
      fieldProps: { allowClear: true },
      render: (_, r) => (
        <Tag color={r.trial_result === '合格' ? 'success' : 'error'}>{r.trial_result}</Tag>
      ),
    },
    moldDocumentCreatedAtColumn<MoldTrialSheetRow>(),
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldTrialSheetRow>
        headerTitle="试模记录表"
        columnPersistenceId="apps.haoligo.pages.molds.reports.trial-record"
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
            const res = await listMoldTrialSheets({
              skip,
              limit: pageSize,
              trial_result:
                typeof searchFormValues?.trial_result === 'string' && searchFormValues.trial_result
                  ? searchFormValues.trial_result
                  : undefined,
              keyword:
                typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                  ? searchFormValues.keyword.trim()
                  : undefined,
              ...range,
            });
            return {
              data: res.items,
              success: true,
              total: res.total,
            };
          } catch (e) {
            messageApi.error((e as Error).message || '加载试模记录失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default MoldTrialRecordReportPage;
