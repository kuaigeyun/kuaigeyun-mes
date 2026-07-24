import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Tag, Input, Table, InputNumber, Select } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SendOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { equipmentApi, sparePartApi } from '../../../services/equipment';
import { sparePartRequisitionsApi } from '../../../services/equipmentOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';

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
  updated_at?: string;
  lines?: RequisitionLine[];
}

const STATUS_COLORS: Record<string, string> = {
  草稿: 'default',
  已提交: 'processing',
  已审核: 'success',
  已驳回: 'error',
};

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
    const detail = await sparePartRequisitionsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setLines(
      (detail.lines ?? []).length > 0
        ? detail.lines!.map((l) => ({
            spare_part_id: l.spare_part_id,
            quantity: l.quantity,
            warehouse_location: l.warehouse_location,
          }))
        : [{ quantity: 1, warehouse_location: '默认库位' }],
    );
    setModalVisible(true);
    void loadOptions();
    formRef.current?.setFieldsValue({
      equipment_id: detail.equipment_id,
      purpose: detail.purpose,
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
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
  };

  const approvalStatusValueEnum = useMemo(() => buildApprovalDocStatusValueEnum(), []);

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
        title: t(`${P}.col.status`),
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
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<SparePartRequisition>(t),
      {
        title: t('common.actions'),
        key: 'action',
        width: 280,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button {...rowActionKind('read')} type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleEdit(record)}>
              {t('common.detail')}
            </Button>
            {perms.canUpdate && record.status === '草稿' && (
              <Button {...rowActionKind('update')} type="link" size="small" icon={<EditOutlined />} onClick={() => void handleEdit(record)}>
                {t('common.edit')}
              </Button>
            )}
            {perms.canAction?.('submit') && record.status === '草稿' && (
              <Button
                {...rowActionKind('submit')}
                type="link"
                size="small"
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
                {t(`${P}.action.submit`)}
              </Button>
            )}
            {perms.canAction?.('approve') && record.status === '已提交' && (
              <Button
                {...rowActionKind('approve')}
                type="link"
                size="small"
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
            )}
            {perms.canAction?.('reject') && record.status === '已提交' && (
              <Button
                {...rowActionKind('reject')}
                type="link"
                size="small"
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
            )}
          </>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, messageApi, approvalStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SparePartRequisition>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-part-requisitions"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
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
                  title: t(`${P}.line.quantity`),
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
