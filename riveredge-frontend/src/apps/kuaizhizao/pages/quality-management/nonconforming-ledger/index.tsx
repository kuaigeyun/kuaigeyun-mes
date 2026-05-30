import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Modal, Space, Tag } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { DefectLedgerItem, qualityImprovementApi } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

function sourceInspectionPath(row: DefectLedgerItem): string | null {
  if (row.incoming_inspection_id) {
    return `/apps/kuaizhizao/quality-management/incoming-inspection?incoming_inspection_id=${row.incoming_inspection_id}`;
  }
  if (row.process_inspection_id) {
    return `/apps/kuaizhizao/quality-management/process-inspection?process_inspection_id=${row.process_inspection_id}`;
  }
  if (row.finished_goods_inspection_id) {
    return `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${row.finished_goods_inspection_id}`;
  }
  return null;
}

function sourceInspectionLabel(row: DefectLedgerItem): string | null {
  return (
    row.incoming_inspection_code ||
    row.process_inspection_code ||
    row.finished_goods_inspection_code ||
    null
  );
}

const NonconformingLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [searchParams] = useSearchParams();
  const [currentRow, setCurrentRow] = useState<DefectLedgerItem | null>(null);
  const [open, setOpen] = useState(false);
  const canUpdate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-nonconforming-ledger:update');
  const canStart8d = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-eight-d-reports:create');

  const initialFilter = useMemo(
    () => ({
      incoming_inspection_id: searchParams.get('incoming_inspection_id') || undefined,
      process_inspection_id: searchParams.get('process_inspection_id') || undefined,
      finished_goods_inspection_id: searchParams.get('finished_goods_inspection_id') || undefined,
      defect_id: searchParams.get('defect_id') || undefined,
    }),
    [searchParams],
  );

  const handleStart8d = (row: DefectLedgerItem) => {
    Modal.confirm({
      title: '发起 8D 报告',
      content: `从不合格品台账 ${row.code} 创建 8D 报告？`,
      onOk: async () => {
        const report = await qualityImprovementApi.nonconformingLedger.start8d(
          row.id,
          `8D - ${row.product_name || row.code}`,
        );
        messageApi.success(`8D 报告已创建：${report.report_code}`);
        navigate('/apps/kuaizhizao/quality-management/eight-d-reports');
      },
    });
  };

  const columns: ProColumns<DefectLedgerItem>[] = [
    { title: '台账编号', dataIndex: 'code', width: 150 },
    {
      title: '源检验单',
      width: 150,
      render: (_, row) => {
        const label = sourceInspectionLabel(row);
        const path = sourceInspectionPath(row);
        if (!label || !path) return '-';
        return (
          <Button type="link" size="small" onClick={() => navigate(path)}>
            {label}
          </Button>
        );
      },
    },
    { title: '工单', dataIndex: 'work_order_code', width: 120 },
    { title: '工序', dataIndex: 'operation_name', width: 120 },
    { title: '物料', dataIndex: 'product_name', width: 180, ellipsis: true },
    { title: '不合格数量', dataIndex: 'defect_quantity', valueType: 'digit', width: 120 },
    { title: '缺陷类型', dataIndex: 'defect_type', width: 120 },
    { title: '原因', dataIndex: 'defect_reason', width: 240, ellipsis: true },
    {
      title: '处置方式',
      dataIndex: 'disposition',
      width: 120,
      valueEnum: {
        quarantine: '隔离',
        rework: '返工',
        scrap: '报废',
        accept: '让步接收',
        return: '退货',
        other: '其他',
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, row) => <Tag color={row.status === 'processed' ? 'success' : 'processing'}>{row.status || '-'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          {canUpdate && (
            <Button
              type="link"
              onClick={() => {
                setCurrentRow(row);
                setOpen(true);
                setTimeout(() => formRef.current?.setFieldsValue({ disposition: row.disposition, status: row.status }), 50);
              }}
            >
              更新处置
            </Button>
          )}
          {canStart8d && (
            <Button type="link" onClick={() => handleStart8d(row)}>
              发起 8D
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-nonconforming-ledger:read"
      fallback={<Empty description="暂无台账查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<DefectLedgerItem>
          headerTitle="不合格品台账"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.nonconforming-ledger"
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const rows = await qualityImprovementApi.nonconformingLedger.list({
              skip,
              limit: pageSize,
              disposition: params.disposition,
              status: params.status,
              defect_type: params.defect_type,
              defect_id: initialFilter.defect_id ? Number(initialFilter.defect_id) : undefined,
              incoming_inspection_id: initialFilter.incoming_inspection_id
                ? Number(initialFilter.incoming_inspection_id)
                : undefined,
              process_inspection_id: initialFilter.process_inspection_id
                ? Number(initialFilter.process_inspection_id)
                : undefined,
              finished_goods_inspection_id: initialFilter.finished_goods_inspection_id
                ? Number(initialFilter.finished_goods_inspection_id)
                : undefined,
            });
            return {
              success: true,
              data: rows || [],
              total: rows.length < pageSize ? skip + rows.length : skip + rows.length + 1,
            };
          }}
        />

        <FormModalTemplate
          title={`更新处置 - ${currentRow?.code || ''}`}
          open={open}
          width={MODAL_CONFIG.SMALL_WIDTH}
          formRef={formRef}
          onClose={() => {
            setOpen(false);
            setCurrentRow(null);
            formRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error('无处置更新权限');
              return false;
            }
            await qualityImprovementApi.nonconformingLedger.updateDisposition(currentRow.id, values);
            messageApi.success('台账处置已更新');
            setOpen(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <ProFormSelect
            name="disposition"
            label="处置方式"
            valueEnum={{
              quarantine: '隔离',
              rework: '返工',
              scrap: '报废',
              accept: '让步接收',
              return: '退货',
              other: '其他',
            }}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="status"
            label="台账状态"
            valueEnum={{ draft: '草稿', processed: '已处理', cancelled: '已取消' }}
          />
          <ProFormTextArea name="remarks" label="备注" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default NonconformingLedgerPage;
