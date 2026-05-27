/**
 * 模具单据待审核列表（审核工作台各 Tab 复用）
 */
import React, { useRef } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { renderRowActionsOverflow } from '../../../../components/uni-action';
import { useGlobalStore } from '../../../../stores/globalStore';
import { buildMoldSheetAuditActionElements } from './MoldSheetAuditActions';
import { canAuditMoldSheet, moldSheetAuditStatusTag } from '../utils/moldSheetStatus';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../constants/moldSheetAudit';
import type { PageResult } from '../services/haoligo';

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

export type MoldAuditSheetRow = {
  id: number;
  sheet_no?: string | null;
  sheet_status?: string | null;
};

type Props<T extends MoldAuditSheetRow> = {
  resource: string;
  headerTitle: string;
  columnPersistenceId: string;
  onViewDetail?: (record: T) => void;
  listFn: (params: {
    skip: number;
    limit: number;
    keyword?: string;
    sheet_status?: string;
  }) => Promise<PageResult<T>>;
  approve: (id: number) => Promise<unknown>;
  reject: (id: number) => Promise<unknown>;
  revoke: (id: number) => Promise<unknown>;
  extraColumns: ProColumns<T>[];
  defaultSheetStatus?: string;
};

export function MoldAuditPendingTable<T extends MoldAuditSheetRow>({
  resource,
  headerTitle,
  columnPersistenceId,
  onViewDetail,
  listFn,
  approve,
  reject,
  revoke,
  extraColumns,
  defaultSheetStatus = '待审核',
}: Props<T>) {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<T>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/关键字' },
    },
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      initialValue: defaultSheetStatus,
      fieldProps: { allowClear: true },
    },
    ...extraColumns,
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      width: 100,
      hideInSearch: true,
      render: (_, r) => moldSheetAuditStatusTag(r.sheet_status),
    },
    {
      title: '操作',
      valueType: 'option',
      width: onViewDetail ? 260 : 200,
      fixed: 'right',
      uniActionRenderOptions: MOLD_SHEET_TABLE_ACTION_OPTIONS,
      render: (_, record) => {
        const handlers = {
          onApprove: () => approve(record.id).then(() => undefined),
          onReject: () => reject(record.id).then(() => undefined),
          onRevoke: () => revoke(record.id).then(() => undefined),
        };
        const actions: React.ReactNode[] = [];
        if (onViewDetail) {
          actions.push(
            <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewDetail(record)}>
              详情
            </Button>,
          );
        }
        actions.push(
          ...buildMoldSheetAuditActionElements({
            canAudit: canAuditMoldSheet(currentUser, resource),
            sheetStatus: record.sheet_status,
            handlers,
            messageApi,
            reload: () => actionRef.current?.reload(),
          }),
        );
        return renderRowActionsOverflow(actions, `audit-pending-${record.id}`, MOLD_SHEET_TABLE_ACTION_OPTIONS);
      },
    },
  ];

  return (
    <UniTable<T>
      headerTitle={headerTitle}
      columnPersistenceId={columnPersistenceId}
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      showAdvancedSearch
      request={async (params, _sort, _filter, searchFormValues) => {
        const current = params.current ?? 1;
        const pageSize = params.pageSize ?? 20;
        const skip = (current - 1) * pageSize;
        const stRaw = searchFormValues?.sheet_status;
        const sheet_status =
          typeof stRaw === 'string' && stRaw.trim()
            ? stRaw.trim()
            : defaultSheetStatus || undefined;
        try {
          const res = await listFn({
            skip,
            limit: pageSize,
            keyword:
              typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                ? searchFormValues.keyword.trim()
                : undefined,
            sheet_status,
          });
          return { data: res.items, success: true, total: res.total };
        } catch (e) {
          return { data: [], success: false, total: 0 };
        }
      }}
      scroll={{ x: 1100 }}
    />
  );
}
