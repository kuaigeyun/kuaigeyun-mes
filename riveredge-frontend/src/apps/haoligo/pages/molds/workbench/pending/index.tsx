/**
 * 好力 GO — 委外审核（外协维保完修单；审核人为申请人；列表含待审核/已通过/已驳回）
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Descriptions, Divider, Modal, Space, Spin, Table, Tag, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { CheckOutlined, CloseOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { getFileDownloadUrl } from '../../../../../../services/file';
import {
  approveMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceCompleteSheet,
  listAuditMoldOutsourceMaintenanceCompleteSheetsMine,
  rejectMoldOutsourceMaintenanceCompleteSheet,
  revokeApprovalMoldOutsourceMaintenanceCompleteSheet,
  type MoldOutsourceCompleteLineRow,
  type MoldOutsourceMaintenanceCompleteSheetRow,
} from '../../../../services/haoligo';

function uuidsToUploadFileList(uuids: string[] | undefined): UploadFile[] {
  if (!uuids?.length) return [];
  return uuids.map((uuid) => ({
    uid: uuid,
    name: '附件',
    status: 'done',
    url: getFileDownloadUrl(uuid),
    response: { uuid },
  }));
}

function ReadonlyAttachmentStrip({ uuids }: { uuids: string[] | undefined }) {
  const fl = uuidsToUploadFileList(uuids);
  if (!fl.length) return <span style={{ color: '#999' }}>无</span>;
  return <Upload listType="picture-card" disabled fileList={fl} />;
}

function repairSummary(items: MoldOutsourceCompleteLineRow[]): string {
  const parts: string[] = [];
  for (const it of items) {
    const rr = (it.repair_result && String(it.repair_result).trim()) || '';
    const rc = (it.repair_content && String(it.repair_content).trim()) || '';
    if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
  }
  return parts.length ? parts.join('；') : '—';
}

function effectiveSheetStatus(r: MoldOutsourceMaintenanceCompleteSheetRow): string {
  const s = (r.sheet_status || '').trim();
  if (s === '待审核' || s === '已通过' || s === '已驳回') return s;
  return '已通过';
}

function auditStatusTag(r: MoldOutsourceMaintenanceCompleteSheetRow) {
  const s = effectiveSheetStatus(r);
  const color = s === '已通过' ? 'success' : s === '已驳回' ? 'error' : 'processing';
  return <Tag color={color}>{s}</Tag>;
}

const MoldOutsourcePendingReviewPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<MoldOutsourceMaintenanceCompleteSheetRow | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const openDetail = async (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRow(null);
    try {
      const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
      setDetailRow(d);
    } catch (e) {
      messageApi.error((e as Error).message || '加载详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    modalApi.confirm({
      title: '审核通过',
      content: `确认通过外协维保完修单「${record.sheet_no || record.id}」？通过后模具将按维修结果更新状态。`,
      onOk: async () => {
        setActionLoadingId(record.id);
        try {
          await approveMoldOutsourceMaintenanceCompleteSheet(record.id);
          messageApi.success('已通过审核');
          if (detailRow?.id === record.id) {
            const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
            setDetailRow(d);
          }
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '操作失败');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleReject = (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    modalApi.confirm({
      title: '驳回',
      content: `确认驳回外协维保完修单「${record.sheet_no || record.id}」？驳回后可重新编辑或再次提交完修。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoadingId(record.id);
        try {
          await rejectMoldOutsourceMaintenanceCompleteSheet(record.id);
          messageApi.success('已驳回');
          if (detailRow?.id === record.id) {
            const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
            setDetailRow(d);
          }
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '操作失败');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleRevoke = (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    modalApi.confirm({
      title: '撤回审核',
      content: `确认撤回外协维保完修单「${record.sheet_no || record.id}」的审核通过？撤回后将回到待审核，模具台账将按未通过审核重新计算（通常回到外协维修）。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoadingId(record.id);
        try {
          await revokeApprovalMoldOutsourceMaintenanceCompleteSheet(record.id);
          messageApi.success('已撤回审核');
          if (detailRow?.id === record.id) {
            const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
            setDetailRow(d);
          }
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '操作失败');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

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
      render: (_, r) => auditStatusTag(r),
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
      width: 220,
      fixed: 'right',
      uniActionRenderOptions: { suppressAuditSemanticActions: false, directMax: 4 },
      render: (_, record) => {
        const st = effectiveSheetStatus(record);
        return (
          <Space size={4} style={{ flexWrap: 'nowrap' }}>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openDetail(record)}>
              详情
            </Button>
            {st === '待审核' ? (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  loading={actionLoadingId === record.id}
                  onClick={() => handleApprove(record)}
                >
                  通过
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  loading={actionLoadingId === record.id}
                  onClick={() => handleReject(record)}
                >
                  驳回
                </Button>
              </>
            ) : null}
            {st === '已通过' ? (
              <Button
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                loading={actionLoadingId === record.id}
                onClick={() => handleRevoke(record)}
              >
                撤回审核
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const detailStatus = detailRow ? effectiveSheetStatus(detailRow) : null;

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldOutsourceMaintenanceCompleteSheetRow>
          headerTitle="委外审核"
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
              const res = await listAuditMoldOutsourceMaintenanceCompleteSheetsMine({
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
        onCancel={() => {
          setDetailOpen(false);
          setDetailRow(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          detailRow ? (
            <Space wrap>
              <Button onClick={() => setDetailOpen(false)}>关闭</Button>
              {detailStatus === '待审核' ? (
                <>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    loading={actionLoadingId === detailRow.id}
                    onClick={() => handleReject(detailRow)}
                  >
                    驳回
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={actionLoadingId === detailRow.id}
                    onClick={() => handleApprove(detailRow)}
                  >
                    通过
                  </Button>
                </>
              ) : null}
              {detailStatus === '已通过' ? (
                <Button
                  icon={<RollbackOutlined />}
                  loading={actionLoadingId === detailRow.id}
                  onClick={() => handleRevoke(detailRow)}
                >
                  撤回审核
                </Button>
              ) : null}
            </Space>
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
              <Descriptions.Item label="审核状态">{auditStatusTag(detailRow)}</Descriptions.Item>
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
