import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormTextArea,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';
import { App, Button, Modal, Row, Col, Input, Table, InputNumber, Select } from 'antd';
import { StatusTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { SendOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  MasterDataLinesTable,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { equipmentApi, sparePartApi } from '../../../services/equipment';
import { sparePartRequisitionsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const P = 'app.kuaizhizao.equipmentOps.sparePartRequisition';
const RESOURCE = 'kuaizhizao:spare-part-requisition';

interface RequisitionLine {
  spare_part_id?: number;
  quantity?: number;
  warehouse_location?: string;
  part_no?: string;
  part_name?: string;
}

interface SparePartRequisition {
  id?: number;
  requisition_no?: string;
  equipment_id?: number;
  equipment_name?: string;
  purpose?: string;
  applicant_name?: string;
  status?: string;
  reject_reason?: string;
  remark?: string;
  updated_at?: string;
  lines?: RequisitionLine[];
}


const SparePartRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<SparePartRequisition | null>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [sparePartOptions, setSparePartOptions] = useState<{ label: string; value: number }[]>([]);
  const [lines, setLines] = useState<RequisitionLine[]>([{ quantity: 1, warehouse_location: '默认库位' }]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SparePartRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<SparePartRequisition>();

  const handleDetail = useCallback(
    (record: SparePartRequisition) => {
      if (!record.id) return;
      void openDetail(() => sparePartRequisitionsApi.get(record.id!) as Promise<SparePartRequisition>);
    },
    [openDetail],
  );

  const loadOptions = async () => {
    const [eqRes, partRes] = await Promise.all([
      equipmentApi.list({ limit: 1000 }),
      sparePartApi.list({ limit: 1000, is_active: true }),
    ]);
    setEquipmentOptions(
      (eqRes.items ?? []).map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
    const parts = partRes?.items ?? [];
    setSparePartOptions(
      parts.map((p: { id: number; part_no: string; part_name: string }) => ({
        label: `${p.part_no} - ${p.part_name}`,
        value: p.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setLines([{ quantity: 1, warehouse_location: '默认库位' }]);
    setModalVisible(true);
    void loadOptions();
    formRef.current?.resetFields();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: SparePartRequisition) => {
    if (!record.id) return;
    try {
      const loaded = await sparePartRequisitionsApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setLines(
        (loaded.lines ?? []).length > 0
          ? loaded.lines!.map((l) => ({
              spare_part_id: l.spare_part_id,
              quantity: l.quantity,
              warehouse_location: l.warehouse_location,
            }))
          : [{ quantity: 1, warehouse_location: '默认库位' }],
      );
      setModalVisible(true);
      void loadOptions();
      formRef.current?.setFieldsValue({
        equipment_id: loaded.equipment_id,
        purpose: loaded.purpose,
        remark: loaded.remark,
      });
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    getAntdModal().confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await sparePartRequisitionsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const validLines = lines.filter((l) => l.spare_part_id && l.quantity);
    if (validLines.length === 0) {
      messageApi.error(t(`${P}.linesRequired`));
      return;
    }
    const payload = {
      equipment_id: values.equipment_id,
      purpose: values.purpose,
      remark: values.remark,
      lines: validLines.map((l) => ({
        spare_part_id: l.spare_part_id,
        quantity: l.quantity,
        warehouse_location: l.warehouse_location || '默认库位',
      })),
    };
    if (isEdit && current?.id) {
      await sparePartRequisitionsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await sparePartRequisitionsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
    if (detailVisible && detail?.id === current?.id && current?.id) {
      void handleDetail({ id: current.id });
    }
  };

  const approvalStatusValueEnum = useMemo(() => buildApprovalDocStatusValueEnum(), []);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<SparePartRequisition>[]>(
    () => [
      { title: t(`${P}.col.requisitionNo`), dataIndex: 'requisition_no' },
      { title: t(`${P}.col.equipment`), dataIndex: 'equipment_name' },
      { title: t(`${P}.col.purpose`), dataIndex: 'purpose', span: 2 },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
      { title: t(`${P}.form.rejectReason`, { defaultValue: '驳回原因' }), dataIndex: 'reject_reason', span: 2 },
    ],
    [t],
  );

  const detailLineColumns = useMemo<ColumnsType<RequisitionLine>>(
    () => [
      { title: t(`${P}.line.part`), dataIndex: 'part_name', render: (_, row) => row.part_name ?? row.part_no ?? '-' },
      { title: t(`${P}.line.partNo`, { defaultValue: '料号' }), dataIndex: 'part_no', width: 120 },
      { title: t('common.quantity'), dataIndex: 'quantity', width: 80, align: 'right' },
      { title: t(`${P}.line.location`), dataIndex: 'warehouse_location' },
    ],
    [t],
  );

  const columns: ProColumns<SparePartRequisition>[] = useMemo(() => alignProColumns<SparePartRequisition>([
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: approvalStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.requisitionNo`),
        dataIndex: 'requisition_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.purpose`),
        dataIndex: 'purpose',
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.applicant`),
        dataIndex: 'applicant_name',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<SparePartRequisition>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          perms.canRead ? (
            <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>
          ) : null,
          perms.canUpdate && record.status === '草稿' ? (
            <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          perms.canAction?.('submit') && record.status === '草稿' ? (
            <Button
              key="submit"
              {...rowActionKind('submit')}
              icon={<SendOutlined />}
              onClick={async () => {
                if (!record.id) return;
                try {
                  await sparePartRequisitionsApi.submit(record.id);
                  messageApi.success(t(`${P}.submitSuccess`));
                  actionRef.current?.reload();
                } catch (error: unknown) {
                  messageApi.error(
                    error instanceof Error ? error.message : t('common.operationFailed'),
                  );
                }
              }}
            >
              {t('common.submit')}
            </Button>
          ) : null,
          perms.canAction?.('approve') && record.status === '已提交' ? (
            <Button
              key="approve"
              {...rowActionKind('approve')}
              icon={<CheckOutlined />}
              onClick={async () => {
                if (!record.id) return;
                try {
                  await sparePartRequisitionsApi.approve(record.id);
                  messageApi.success(t(`${P}.approveSuccess`));
                  actionRef.current?.reload();
                } catch (error: unknown) {
                  messageApi.error(
                    error instanceof Error ? error.message : t('common.operationFailed'),
                  );
                }
              }}
            >
              {t(`${P}.action.approve`)}
            </Button>
          ) : null,
          perms.canAction?.('reject') && record.status === '已提交' ? (
            <Button
              key="reject"
              {...rowActionKind('reject')}
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setRejectTarget(record);
                setRejectReason('');
                setRejectModalVisible(true);
              }}
            >
              {t(`${P}.action.reject`)}
            </Button>
          ) : null,
        ],
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, messageApi, approvalStatusValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SparePartRequisition>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.sparePartRequisitions)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-part-requisitions-equip-rank-v1"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => perms.canRead && handleDetail(record),
            style: { cursor: perms.canRead ? 'pointer' : undefined },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveApprovalDocListParams(searchFormValues, sort);
              const res = await sparePartRequisitionsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as SparePartRequisition[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          enableRowSelection={perms.canDelete}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.requisition_no ? ` - ${detail.requisition_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        linesTitle={t(`${P}.form.lines`)}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.spare_part_id ?? row.part_no ?? '')}
            emptyDescription={t('common.noData')}
          />
        }
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(detail && perms.canUpdate && detail.status === '草稿'),
          () => {
            if (!detail) return;
            closeDetail();
            void handleEdit(detail);
          },
        )}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect name="equipment_id" label={t(`${P}.form.equipment`)} options={equipmentOptions} showSearch allowClear />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="purpose" label={t(`${P}.form.purpose`)} />
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{t(`${P}.form.lines`)}</div>
            <Table
              size="small"
              pagination={false}
              dataSource={lines.map((l, i) => ({ ...l, key: i }))}
              columns={[
                {
                  title: t(`${P}.line.part`),
                  render: (_, __, index) => (
                    <Select
                      value={lines[index]?.spare_part_id}
                      options={sparePartOptions}
                      showSearch
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      onChange={(val: number) => {
                        const next = [...lines];
                        next[index] = { ...next[index], spare_part_id: val };
                        setLines(next);
                      }}
                    />
                  ),
                },
                {
                  title: t('common.quantity'),
                  width: 100,
                  render: (_, __, index) => (
                    <InputNumber
                      min={1}
                      value={lines[index]?.quantity}
                      onChange={(val) => {
                        const next = [...lines];
                        next[index] = { ...next[index], quantity: Number(val) || 1 };
                        setLines(next);
                      }}
                    />
                  ),
                },
                {
                  title: t(`${P}.line.location`),
                  render: (_, __, index) => (
                    <Input
                      value={lines[index]?.warehouse_location}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = { ...next[index], warehouse_location: e.target.value };
                        setLines(next);
                      }}
                    />
                  ),
                },
              ]}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              style={{ marginTop: 8 }}
              onClick={() => setLines([...lines, { quantity: 1, warehouse_location: '默认库位' }])}
            >
              {t(`${P}.form.addLine`)}
            </Button>
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        title={t(`${P}.rejectModal`)}
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={async () => {
          if (!rejectTarget?.id || !rejectReason.trim()) return;
          try {
            await sparePartRequisitionsApi.reject(rejectTarget.id, { reject_reason: rejectReason });
            messageApi.success(t(`${P}.rejectSuccess`));
            setRejectModalVisible(false);
            actionRef.current?.reload();
          } catch (error: unknown) {
            messageApi.error(
              error instanceof Error ? error.message : t('common.operationFailed'),
            );
          }
        }}
      >
        <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>
    </>
  );
};

export default SparePartRequisitionsPage;
