import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Modal, Space, Typography } from 'antd';
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
import { useTranslation } from 'react-i18next';
import {
  getQualityInspectionResultValueEnum,
  getQualityQualityStatusValueEnum,
  getQualityReleaseDecisionValueEnum,
  renderReleaseDecisionTag,
} from '../components/qualityMeta';

const OQC_RESOURCE = 'kuaizhizao:quality-management-oqc-inspection';

const OQCInspectionPage: React.FC = () => {
  const { t } = useTranslation();
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
      messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadShipmentNoticeFailed'));
    }
  };

  const openFromDeliveryModal = async () => {
    try {
      setDeliveryOptions(await fetchSalesDeliveriesForOqc());
      setSelectedDeliveryId(undefined);
      setFromDeliveryVisible(true);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadSalesDeliveryFailed'));
    }
  };

  const columns: ProColumns<OQCInspection>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
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
        t('app.kuaizhizao.quality.oqc.columns.shipmentNoticeSalesOrder'),
        'noticeSalesOrder',
        ['shipment_notice_code', 'shipmentNoticeCode'],
        ['sales_order_code', 'salesOrderCode'],
        { dataIndex: 'shipment_notice_code' },
      ),
      { title: t('app.kuaizhizao.quality.oqc.columns.shipmentNotice'), dataIndex: 'shipment_notice_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.salesOrder'), dataIndex: 'sales_order_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.customer'), dataIndex: 'customer_name', width: 140, ellipsis: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.sourceCode'), dataIndex: 'source_code', width: 130 },
      {
        title: t('app.kuaizhizao.quality.common.columns.material'),
        key: 'material',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, r) => (
          <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
        dataIndex: 'inspection_quantity',
        valueType: 'digit',
        width: 100,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
        dataIndex: 'qualified_quantity',
        ...qualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'unqualified_quantity',
        ...unqualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision'),
        dataIndex: 'release_decision',
        width: 100,
        render: (_, row) => renderReleaseDecisionTag(t, row.release_decision),
      },
      { title: t('app.kuaizhizao.quality.common.columns.status'), dataIndex: 'status', width: 90 },
      { title: t('app.kuaizhizao.quality.common.columns.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 170 },
      {
        title: t('app.kuaizhizao.quality.common.columns.actions'),
        valueType: 'option',
        width: 200,
        render: (_, row) => (
          <Space>
            {canUpdate && row.status === '待检验' && (
              <Button
                key="submit"
                {...rowActionKind('submit')}
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
                {t('app.kuaizhizao.quality.oqc.actions.conduct')}
              </Button>
            )}
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="wf"
              record={row}
              entityName={t('app.kuaizhizao.quality.common.entity.oqcInspection')}
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
    ],
    [t, canUpdate],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.oqc.permission.noReadAccess')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
          headerTitle={t('app.kuaizhizao.quality.oqc.pageTitle')}
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
                messageApi.warning(t('app.kuaizhizao.quality.common.messages.exportEmpty'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const exportDate = new Date().toISOString().slice(0, 10);
              a.download = `${t('app.kuaizhizao.quality.common.entity.oqcInspection')}_${exportDate}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
            }
          }}
          showDeleteButton
          onDelete={async (keys) => {
            try {
              for (const key of keys) {
                await qualityImprovementApi.oqc.delete(Number(key));
              }
              messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: keys.length }));
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.oqc.messages.deleteConfirm', { count })}
          deleteConfirmDescription={t('app.kuaizhizao.quality.oqc.messages.deleteConfirmDescription')}
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
                    {withSingleNewShortcutHint(t('app.kuaizhizao.quality.oqc.actions.createFromNotice'))}
                  </Button>,
                  <Button
                    {...rowActionKind('create')}
                    key="from-delivery"
                    icon={<PlusOutlined />}
                    onClick={() => void openFromDeliveryModal()}
                  >
                    {t('app.kuaizhizao.quality.oqc.actions.createFromDelivery')}
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
          title={t('app.kuaizhizao.quality.oqc.modal.createFromNoticeTitle')}
          open={fromNoticeVisible}
          confirmLoading={creatingFromNotice}
          onCancel={() => setFromNoticeVisible(false)}
          onOk={async () => {
            if (!selectedNoticeId) {
              messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectShipmentNotice'));
              return;
            }
            setCreatingFromNotice(true);
            try {
              const created = await qualityImprovementApi.oqc.createFromShipmentNotice(selectedNoticeId);
              messageApi.success(t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }));
              setFromNoticeVisible(false);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.createFailed'));
            } finally {
              setCreatingFromNotice(false);
            }
          }}
        >
          <ProFormSelect
            label={t('app.kuaizhizao.quality.oqc.form.shipmentNotice')}
            showSearch
            options={noticeOptions}
            fieldProps={{
              value: selectedNoticeId,
              onChange: (v) => setSelectedNoticeId(v as number),
              placeholder: t('app.kuaizhizao.quality.oqc.form.shipmentNoticePlaceholder'),
              style: { width: '100%' },
            }}
          />
        </Modal>

        <Modal
          title={t('app.kuaizhizao.quality.oqc.modal.createFromDeliveryTitle')}
          open={fromDeliveryVisible}
          confirmLoading={creatingFromDelivery}
          onCancel={() => setFromDeliveryVisible(false)}
          onOk={async () => {
            if (!selectedDeliveryId) {
              messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectSalesDelivery'));
              return;
            }
            setCreatingFromDelivery(true);
            try {
              const created = await qualityImprovementApi.oqc.createFromSalesDelivery(selectedDeliveryId);
              messageApi.success(t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }));
              setFromDeliveryVisible(false);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.createFailed'));
            } finally {
              setCreatingFromDelivery(false);
            }
          }}
        >
          <ProFormSelect
            label={t('app.kuaizhizao.quality.oqc.form.salesDelivery')}
            showSearch
            options={deliveryOptions}
            fieldProps={{
              value: selectedDeliveryId,
              onChange: (v) => setSelectedDeliveryId(v as number),
              placeholder: t('app.kuaizhizao.quality.oqc.form.salesDeliveryPlaceholder'),
              style: { width: '100%' },
            }}
          />
        </Modal>

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.oqc.modal.conductTitle', { code: currentRow?.inspection_code || '' })}
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
              messageApi.error(t('app.kuaizhizao.quality.oqc.messages.noConductPermission'));
              return false;
            }
            await qualityImprovementApi.oqc.conduct(currentRow.id, {
              ...values,
              attachments: normalizeDocumentAttachments(values.attachments),
              ...pickInspectionConductExtras(values),
            });
            messageApi.success(t('app.kuaizhizao.quality.oqc.messages.conductSuccess'));
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <InspectionTemplateConductFields inspection={currentRow as Record<string, unknown>} />
          <ProFormSelect
            name="inspection_result"
            label={t('app.kuaizhizao.quality.common.columns.inspectionResult')}
            valueEnum={getQualityInspectionResultValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="quality_status"
            label={t('app.kuaizhizao.quality.common.columns.qualityStatus')}
            valueEnum={getQualityQualityStatusValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="qualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="unqualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="release_decision"
            label={t('app.kuaizhizao.quality.oqc.columns.releaseDecision')}
            valueEnum={getQualityReleaseDecisionValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="release_note" label={t('app.kuaizhizao.quality.oqc.form.releaseNote')} />
          <DocumentAttachmentsField category="oqc_inspection_attachments" />
          <ProFormTextArea name="notes" label={t('app.kuaizhizao.quality.common.form.notes')} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
