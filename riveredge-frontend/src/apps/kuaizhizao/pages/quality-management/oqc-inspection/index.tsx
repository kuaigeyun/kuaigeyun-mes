import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Modal, Space, Tag } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import {
  fetchSalesDeliveriesForOqc,
  fetchShipmentNoticesForOqc,
} from '../components/inspectionCreateSourceUtils';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

const OQCInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
  const canCreate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:create');
  const canUpdate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:update');
  const canApprove = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:approve');

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
    { title: '检验单号', dataIndex: 'inspection_code', width: 150 },
    { title: '发货通知', dataIndex: 'shipment_notice_code', width: 140 },
    { title: '销售订单', dataIndex: 'sales_order_code', width: 130 },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '来源单号', dataIndex: 'source_code', width: 130 },
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
    { title: '检验数量', dataIndex: 'inspection_quantity', valueType: 'digit', width: 100 },
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
          {canUpdate && (
            <Button
              type="link"
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
                    }),
                  50,
                );
              }}
            >
              执行检验
            </Button>
          )}
          {canApprove && row.status === '已检验' && (
            <Button
              type="link"
              onClick={async () => {
                if (!row.id) return;
                await qualityImprovementApi.oqc.approve(row.id, true);
                messageApi.success('审核通过，可放行出库');
                actionRef.current?.reload();
              }}
            >
              审核通过
            </Button>
          )}
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
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="from-notice" type="primary" onClick={() => void openFromNoticeModal()}>
                    从发货通知创建
                  </Button>,
                  <Button key="from-delivery" onClick={() => void openFromDeliveryModal()}>
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
          <ProFormTextArea name="notes" label="备注" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
