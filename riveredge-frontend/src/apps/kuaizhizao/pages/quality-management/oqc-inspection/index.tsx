import { rowActionKind } from '../../../../../components/uni-action';
import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Modal, Space, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { MaterialStackedCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  qualifiedQuantityColumnProps,
  stackedPrimarySecondaryColumn,
  unqualifiedQuantityColumnProps,
} from '../components/qualityTableColumns';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  fetchSalesDeliveriesForOqc,
  fetchShipmentNoticesForOqc,
} from '../components/inspectionCreateSourceUtils';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const OQC_RESOURCE = 'kuaizhizao:quality-management-oqc-inspection';

const OQCInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { canCreate, canUpdate } = useResourcePermissions(OQC_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const conductFormRef = useRef<any>(null);
  const [conductVisible, setConductVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<OQCInspection | null>(null);
  const [fromNoticeVisible, setFromNoticeVisible] = useState(false);
  const [noticeOptions, setNoticeOptions] = useState<{ label: string; value: number }[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | undefined>();
  const [creatingFromNotice, setCreatingFromNotice] = useState(false);
  const [fromDeliveryVisible, setFromDeliveryVisible] = useState(false);
  const [deliveryOptions, setDeliveryOptions] = useState<{ label: string; value: number }[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | undefined>();
  const [creatingFromDelivery, setCreatingFromDelivery] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openFromNoticeModal = async () => {
    try {
      setNoticeOptions(await fetchShipmentNoticesForOqc());
      setSelectedNoticeId(undefined);
      setFromNoticeVisible(true);
    } catch (e: any) {
      messageApi.error(e?.message || '加载发货通知失败');
    }
  };

  const openFromDeliveryModal = async () => {
    try {
      setDeliveryOptions(await fetchSalesDeliveriesForOqc());
      setSelectedDeliveryId(undefined);
      setFromDeliveryVisible(true);
    } catch (e: any) {
      messageApi.error(e?.message || '加载销售出库单失败');
    }
  };

  const columns: ProColumns<OQCInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspection_code',
      width: 150,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
          {r.inspection_code ?? '-'}
        </Typography.Text>
      ),
    },
    stackedPrimarySecondaryColumn<OQCInspection>(
      '发货通知 / 销售订单',
      'noticeSalesOrder',
      ['shipment_notice_code', 'shipmentNoticeCode'],
      ['sales_order_code', 'salesOrderCode'],
      { dataIndex: 'shipment_notice_code' },
    ),
    { title: '发货通知', dataIndex: 'shipment_notice_code', hideInTable: true },
    { title: '销售订单', dataIndex: 'sales_order_code', hideInTable: true },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '来源单号', dataIndex: 'source_code', width: 130 },
    {
      title: '物料',
      key: 'material',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: '物料编码', dataIndex: 'material_code', hideInTable: true },
    { title: '物料名称', dataIndex: 'material_name', hideInTable: true },
    { title: '检验数量', dataIndex: 'inspection_quantity', valueType: 'digit', width: 100, align: 'right' },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      ...qualifiedQuantityColumnProps,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      ...unqualifiedQuantityColumnProps,
    },
    {
      title: '放行结论',
      dataIndex: 'release_decision',
      width: 100,
      render: (_, row) => {
        const color = row.release_decision === 'released' ? 'success' : row.release_decision === 'rejected' ? 'error' : 'default';
        const text = row.release_decision === 'released' ? '放行' : row.release_decision === 'rejected' ? '拒绝放行' : '待判定';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '状态', dataIndex: 'status', width: 90 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 170 },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, row) => (
        <Space>
          {canUpdate && row.status === '待检验' && (
            <Button key="submit" {...rowActionKind('submit')}
              onClick={() => {
                setCurrentRow(row);
                setConductVisible(true);
                setTimeout(
                  () =>
                    conductFormRef.current?.setFieldsValue({
                      inspection_result: row.inspection_result || '合格',
                      quality_status: row.quality_status || '合格',
                      release_decision: row.release_decision || 'pending',
                      qualified_quantity: row.qualified_quantity,
                      unqualified_quantity: row.unqualified_quantity,
                      attachments: mapAttachmentsToUploadList(row.attachments),
                    }),
                  50,
                );
              }}
            >
              执行检验
            </Button>
          )}
          <UniWorkflowActions {...rowActionKind('skip')}
            key="wf"
            record={row}
            entityName="出货检验单"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[]}
            pendingStatuses={['待审核', '已检验']}
            approvedStatuses={['已审核']}
            rejectedStatuses={['已驳回']}
            theme="link"
            size="small"
            resourcePrefix={OQC_RESOURCE}
            onSuccess={() => actionRef.current?.reload()}
          />
        </Space>
      ),
    },
  ];

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description="暂无出货检验查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
          headerTitle="出货检验 (OQC)"
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={OQC_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection"
          showExportButton
          onExport={async () => {
            try {
              const res = await qualityImprovementApi.oqc.export();
              const items = res.items || [];
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `oqc-inspections-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (e: any) {
              messageApi.error(e?.message || '导出失败');
            }
          }}
          showDeleteButton
          onDelete={async (keys) => {
            try {
              for (const key of keys) {
                await qualityImprovementApi.oqc.delete(Number(key));
              }
              messageApi.success(`已删除 ${keys.length} 条记录`);
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || '删除失败');
            }
          }}
          deleteConfirmTitle={(count) => `确定删除选中的 ${count} 张出货检验单？`}
          deleteConfirmDescription="仅「待检验」状态可删除。"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button
                    {...rowActionKind('create')}
                    key="from-notice"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => void openFromNoticeModal()}
                  >
                    {withSingleNewShortcutHint('从发货通知创建')}
                  </Button>,
                  <Button
                    {...rowActionKind('create')}
                    key="from-delivery"
                    icon={<PlusOutlined />}
                    onClick={() => void openFromDeliveryModal()}
                  >
                    从销售出库创建
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const result = await qualityImprovementApi.oqc.list({ skip, limit: pageSize, status: params.status });
            return {
              success: true,
              data: result?.items || [],
              total: result?.total || 0,
            };
          }}
        />

        <Modal
          title="从发货通知创建 OQC"
          open={fromNoticeVisible}
          confirmLoading={creatingFromNotice}
          onCancel={() => setFromNoticeVisible(false)}
          onOk={async () => {
            if (!selectedNoticeId) {
              messageApi.warning('请选择发货通知单');
              return;
            }
            setCreatingFromNotice(true);
            try {
              const created = await qualityImprovementApi.oqc.createFromShipmentNotice(selectedNoticeId);
              messageApi.success(`已创建 ${created.length} 张出货检验单`);
              setFromNoticeVisible(false);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || '创建失败');
            } finally {
              setCreatingFromNotice(false);
            }
          }}
        >
          <ProFormSelect
            label="发货通知单"
            showSearch
            options={noticeOptions}
            fieldProps={{
              value: selectedNoticeId,
              onChange: (v) => setSelectedNoticeId(v as number),
              placeholder: '选择待发货的通知单',
              style: { width: '100%' },
            }}
          />
        </Modal>

        <Modal
          title="从销售出库创建 OQC"
          open={fromDeliveryVisible}
          confirmLoading={creatingFromDelivery}
          onCancel={() => setFromDeliveryVisible(false)}
          onOk={async () => {
            if (!selectedDeliveryId) {
              messageApi.warning('请选择销售出库单');
              return;
            }
            setCreatingFromDelivery(true);
            try {
              const created = await qualityImprovementApi.oqc.createFromSalesDelivery(selectedDeliveryId);
              messageApi.success(`已创建 ${created.length} 张出货检验单`);
              setFromDeliveryVisible(false);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || '创建失败');
            } finally {
              setCreatingFromDelivery(false);
            }
          }}
        >
          <ProFormSelect
            label="销售出库单"
            showSearch
            options={deliveryOptions}
            fieldProps={{
              value: selectedDeliveryId,
              onChange: (v) => setSelectedDeliveryId(v as number),
              placeholder: '选择待出库的销售出库单',
              style: { width: '100%' },
            }}
          />
        </Modal>

        <FormModalTemplate
          title={`执行出货检验 - ${currentRow?.inspection_code || ''}`}
          open={conductVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          formRef={conductFormRef}
          onClose={() => {
            setConductVisible(false);
            setCurrentRow(null);
            conductFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error('无执行检验权限');
              return false;
            }
            await qualityImprovementApi.oqc.conduct(currentRow.id, {
              ...values,
              attachments: normalizeDocumentAttachments(values.attachments),
              ...pickInspectionConductExtras(values),
            });
            messageApi.success('检验执行成功');
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <InspectionTemplateConductFields inspection={currentRow as Record<string, unknown>} />
          <ProFormSelect
            name="inspection_result"
            label="检验结果"
            valueEnum={{ 合格: '合格', 不合格: '不合格', 部分合格: '部分合格' }}
            rules={[{ required: true }]}
          />
          <ProFormSelect name="quality_status" label="质量状态" valueEnum={{ 合格: '合格', 不合格: '不合格' }} rules={[{ required: true }]} />
          <ProFormDigit name="qualified_quantity" label="合格数量" rules={[{ required: true }]} />
          <ProFormDigit name="unqualified_quantity" label="不合格数量" rules={[{ required: true }]} />
          <ProFormSelect
            name="release_decision"
            label="放行结论"
            valueEnum={{ pending: '待判定', released: '放行', rejected: '拒绝放行' }}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="release_note" label="放行说明" />
          <DocumentAttachmentsField category="oqc_inspection_attachments" />
          <ProFormTextArea name="notes" label="备注" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
