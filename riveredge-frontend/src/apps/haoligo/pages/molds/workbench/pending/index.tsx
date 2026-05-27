/**
 * 好力 GO — 外协维保审核（外协维保完修单唯一审核入口；数据范围内待审/历史）
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Descriptions, Divider, Modal, Space, Spin, Table } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { renderRowActionsOverflow } from '../../../../../../components/uni-action';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { ReadonlyAttachmentStrip } from '../../../../components/ReadonlyAttachmentStrip';
import { buildMoldSheetAuditActionElements } from '../../../../components/MoldSheetAuditActions';
import { MoldSheetDetailAuditFooter } from '../../../../components/MoldSheetDetailAuditFooter';
import { HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE } from '../../../../constants/documentPermissionResources';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import {
  approveMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceCompleteSheet,
  listMoldOutsourceMaintenanceCompleteSheets,
  rejectMoldOutsourceMaintenanceCompleteSheet,
  revokeApprovalMoldOutsourceMaintenanceCompleteSheet,
  type MoldOutsourceCompleteLineRow,
  type MoldOutsourceMaintenanceCompleteSheetRow,
} from '../../../../services/haoligo';
import { canAuditMoldSheet, moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';

function repairSummary(items: MoldOutsourceCompleteLineRow[]): string {
  const parts: string[] = [];
  for (const it of items) {
    const rr = (it.repair_result && String(it.repair_result).trim()) || '';
    const rc = (it.repair_content && String(it.repair_content).trim()) || '';
    if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
  }
  return parts.length ? parts.join('；') : '—';
}

const MoldOutsourcePendingReviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canAudit = canAuditMoldSheet(currentUser, HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE);
  const actionRef = useRef<ActionType>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<MoldOutsourceMaintenanceCompleteSheetRow | null>(null);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRow(null);
  };

  const openDetail = async (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRow(null);
    try {
      const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
      setDetailRow(d);
    } catch (e) {
      messageApi.error((e as Error).message || '加载详情失败');
      closeDetail();
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadDetail = async (id: number) => {
    const d = await getMoldOutsourceMaintenanceCompleteSheet(id);
    setDetailRow(d);
    actionRef.current?.reload();
  };

  const auditHandlersFor = (id: number) => ({
    onApprove: () => approveMoldOutsourceMaintenanceCompleteSheet(id),
    onReject: () => rejectMoldOutsourceMaintenanceCompleteSheet(id),
    onRevoke: () => revokeApprovalMoldOutsourceMaintenanceCompleteSheet(id),
  });

  const sheetStatusEnum: Record<string, { text: string }> = {
    待审核: { text: '待审核' },
    已通过: { text: '已通过' },
    已驳回: { text: '已驳回' },
  };

  const columns: ProColumns<MoldOutsourceMaintenanceCompleteSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/来源单号/外协单位/申请部门/申请人' },
    },
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      key: 'sheet_status',
      width: 100,
      hideInTable: true,
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      initialValue: '待审核',
      fieldProps: { allowClear: true, placeholder: '全部' },
    },
    {
      title: '完修单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, copyable: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '申请部门', dataIndex: 'department_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '外协单位', dataIndex: 'outsourced_unit_name', width: 140, ellipsis: true },
    {
      title: '审核状态',
      key: 'sheet_status_display',
      width: 100,
      hideInSearch: true,
      render: (_, r) => moldSheetAuditStatusTag(r.sheet_status),
    },
    {
      title: '维修摘要',
      key: 'completion_summary',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => repairSummary(r.line_items || []),
    },
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      fixed: 'right',
      uniActionRenderOptions: MOLD_SHEET_TABLE_ACTION_OPTIONS,
      render: (_, record) => {
        const actions: React.ReactNode[] = [
          <Button
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => void openDetail(record)}
          >
            详情
          </Button>,
          ...buildMoldSheetAuditActionElements({
            canAudit,
            sheetStatus: record.sheet_status,
            handlers: auditHandlersFor(record.id),
            messageApi,
            reload: () => actionRef.current?.reload(),
          }),
        ];
        return renderRowActionsOverflow(
          actions,
          `outsource-audit-${record.id}`,
          MOLD_SHEET_TABLE_ACTION_OPTIONS,
        );
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldOutsourceMaintenanceCompleteSheetRow>
          headerTitle={t('app.haoligo.menu.molds.workbench.pending')}
          columnPersistenceId="apps.haoligo.pages.molds.workbench.pending"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const stRaw = searchFormValues?.sheet_status;
              const sheet_status =
                typeof stRaw === 'string' && stRaw.trim() && ['待审核', '已通过', '已驳回'].includes(stRaw.trim())
                  ? stRaw.trim()
                  : undefined;
              const res = await listMoldOutsourceMaintenanceCompleteSheets({
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
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1500 }}
        />
      </ListPageTemplate>

      <Modal
        title="外协维保完修单详情"
        open={detailOpen}
        onCancel={closeDetail}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          detailRow ? (
            <MoldSheetDetailAuditFooter
              resource={HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE}
              sheetStatus={detailRow.sheet_status}
              onClose={closeDetail}
              onReload={() => void reloadDetail(detailRow.id)}
              handlers={auditHandlersFor(detailRow.id)}
            />
          ) : null
        }
      >
        {detailLoading ? (
          <div style={{ display: 'flex', minHeight: 200, alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip="加载中…" />
          </div>
        ) : detailRow ? (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="审核状态">{moldSheetAuditStatusTag(detailRow.sheet_status)}</Descriptions.Item>
              <Descriptions.Item label="完修单单号">{detailRow.sheet_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="来源单号">{detailRow.source_order_no}</Descriptions.Item>
              <Descriptions.Item label="申请人">{detailRow.applicant_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="申请部门">{detailRow.department_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="外协单位" span={2}>
                {detailRow.outsourced_unit_name}
              </Descriptions.Item>
              <Descriptions.Item label="维修摘要" span={2}>
                {repairSummary(detailRow.line_items || [])}
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" plain>
              附件照片（维修后）
            </Divider>
            <ReadonlyAttachmentStrip uuids={detailRow.header_attachment_file_uuids} />
            <Divider orientation="left" plain>
              来源附件（维修前）
            </Divider>
            <ReadonlyAttachmentStrip uuids={detailRow.source_header_attachment_file_uuids} />
            <Divider orientation="left" plain>
              模具明细
            </Divider>
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.mold_code}
              dataSource={detailRow.line_items || []}
              scroll={{ x: 900 }}
              columns={[
                { title: '模具代号', dataIndex: 'mold_code', width: 120 },
                { title: '模具名称', dataIndex: 'mold_name', width: 120, ellipsis: true },
                { title: '维修原因', dataIndex: 'repair_reason', width: 140, ellipsis: true },
                { title: '维修内容', dataIndex: 'repair_content', width: 160, ellipsis: true },
                { title: '维修结果', dataIndex: 'repair_result', width: 100 },
                { title: '维修费用', dataIndex: 'repair_cost', width: 90 },
                {
                  title: '维修前附件',
                  key: 'before',
                  width: 160,
                  render: (_, r) => <ReadonlyAttachmentStrip uuids={r.source_attachment_file_uuids} />,
                },
                {
                  title: '维修后附件',
                  key: 'after',
                  width: 160,
                  render: (_, r) => <ReadonlyAttachmentStrip uuids={r.attachment_file_uuids} />,
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </>
  );
};

export default MoldOutsourcePendingReviewPage;
