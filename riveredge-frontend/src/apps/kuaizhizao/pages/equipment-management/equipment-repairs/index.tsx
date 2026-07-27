import React, { useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Descriptions, Modal, Tag, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  FormModalTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { equipmentFaultApi } from '../../../services/equipment';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildEquipmentRepairStatusValueEnum,
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveEquipmentRepairListParams,
} from '../../../utils/equipmentListCore';
import { ROUTES } from '../../../constants/routes';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';

const P = 'app.kuaizhizao.equipmentRepair';
const RESOURCE = 'kuaizhizao:equipment-fault';

interface EquipmentRepair {
  uuid?: string;
  repair_no?: string;
  equipment_uuid?: string;
  equipment_name?: string;
  equipment_fault_uuid?: string;
  repair_date?: string;
  repair_type?: string;
  repair_description?: string;
  repairer_name?: string;
  repair_duration?: number;
  repair_cost?: number;
  status?: string;
  repair_result?: string;
  repair_parts?: { items?: Array<{ spare_part_id?: number; quantity?: number }> };
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  进行中: 'processing',
  已完成: 'success',
  已取消: 'default',
};

const EquipmentRepairsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { open: drawerVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<EquipmentRepair>();
  const [completeVisible, setCompleteVisible] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<EquipmentRepair | null>(null);
  const [completing, setCompleting] = useState(false);

  const repairStatusValueEnum = useMemo(() => buildEquipmentRepairStatusValueEnum(t), [t]);

  const handleDetail = (record: EquipmentRepair) => {
    if (!record.uuid) return;
    void openDetail(() => equipmentFaultApi.getRepair(record.uuid!) as Promise<EquipmentRepair>);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const key of keys) {
          await equipmentFaultApi.deleteRepair(String(key));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const openComplete = (record: EquipmentRepair) => {
    setCompleteTarget(record);
    setCompleteVisible(true);
  };

  const handleComplete = async (values: { repair_result?: string }) => {
    if (!completeTarget?.uuid) return;
    setCompleting(true);
    try {
      await equipmentFaultApi.updateRepair(completeTarget.uuid, {
        status: '已完成',
        repair_result: values.repair_result || '成功',
      });
      messageApi.success(t(`${P}.completeSuccess`));
      setCompleteVisible(false);
      setCompleteTarget(null);
      closeDetail();
      actionRef.current?.reload();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
      throw error;
    } finally {
      setCompleting(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<EquipmentRepair>[] = useMemo(
    () => [
      { title: t(`${P}.col.repairNo`), dataIndex: 'repair_no' },
      { title: t(`${P}.col.equipmentName`), dataIndex: 'equipment_name' },
      {
        title: t(`${P}.col.linkedFault`),
        key: 'equipment_fault_uuid',
        render: (_, r) =>
          r.equipment_fault_uuid ? (
            <Typography.Link
              onClick={() =>
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?keyword=${encodeURIComponent(r.equipment_fault_uuid!)}`,
                )
              }
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      {
        title: t(`${P}.col.repairDate`),
        dataIndex: 'repair_date',
        render: (_, r) => (r.repair_date ? formatDateTime(r.repair_date) : '-'),
      },
      { title: t(`${P}.col.repairType`), dataIndex: 'repair_type' },
      { title: t(`${P}.col.repairerName`), dataIndex: 'repairer_name' },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      { title: t(`${P}.col.repairResult`), dataIndex: 'repair_result' },
      { title: t(`${P}.col.repairDescription`), dataIndex: 'repair_description', span: 2 },
      {
        title: t(`${P}.col.sparePartsUsed`, { defaultValue: '使用备件' }),
        key: 'repair_parts',
        span: 2,
        render: (_, r) =>
          r.repair_parts?.items?.length
            ? r.repair_parts.items.map((i) => `#${i.spare_part_id}×${i.quantity}`).join(', ')
            : '-',
      },
    ],
    [t, navigate],
  );

  const columns: ProColumns<EquipmentRepair>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.repairDate`),
        dataIndex: 'repair_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: repairStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.repairNo`),
        dataIndex: 'repair_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.repair_no ?? '') }} ellipsis>
            {r.repair_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.col.equipmentName`),
        dataIndex: 'equipment_name',
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.linkedFault`),
        dataIndex: 'equipment_fault_uuid',
        width: 110,
        hideInSearch: true,
        render: (_, r) =>
          r.equipment_fault_uuid ? (
            <Typography.Link
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?keyword=${encodeURIComponent(r.equipment_fault_uuid!)}`,
                );
              }}
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      {
        title: t(`${P}.col.repairDate`),
        dataIndex: 'repair_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.repair_date ? formatDateTime(r.repair_date, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      { title: t(`${P}.col.repairType`), dataIndex: 'repair_type', width: 120, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.repairerName`), dataIndex: 'repairer_name', width: 120, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      {
        title: t(`${P}.col.repairResult`),
        dataIndex: 'repair_result',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<EquipmentRepair>(t),
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 160,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const actions = [
            perms.canRead ? (
              <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />
            ) : null,
            perms.canUpdate && record.status === '进行中' ? (
              <Button
                key="complete"
                {...rowActionKind('execute')}
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openComplete(record);
                }}
              >
                {t(`${P}.action.complete`)}
              </Button>
            ) : null,
          ];
          return renderRowActionsOverflow(actions, { keyPrefix: `repair-${record.uuid ?? 'row'}` });
        },
      },
    ],
    [t, perms.canRead, perms.canUpdate, repairStatusValueEnum, navigate],
  );

  if (!perms.canRead) return null;

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentRepair>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-repairs"
          actionRef={actionRef}
          rowKey="uuid"
          enableRowSelection={perms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
          showAdvancedSearch
          pinnedTabsField={EQUIPMENT_OPS_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({ onClick: () => handleDetail(record), style: { cursor: 'pointer' } })}
          request={async (params, sort, _filter, searchFormValues) => {
            const listParams = resolveEquipmentRepairListParams(searchFormValues, sort);
            const res = await equipmentFaultApi.listRepairs({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...listParams,
            });
            const { data, total } = normalizeEquipmentListResponse(res);
            return { data: data as EquipmentRepair[], success: true, total };
          }}
          search={{ labelWidth: 'auto' }}
          pagination={{ defaultPageSize: 20 }}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t(`${P}.detailTitle`)}${detail?.repair_no ? ` - ${detail.repair_no}` : ''}`}
        open={drawerVisible}
        loading={detailLoading}
        onClose={closeDetail}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        extra={
          detail && perms.canUpdate && detail.status === '进行中' ? (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openComplete(detail)}>
              {t(`${P}.action.complete`)}
            </Button>
          ) : null
        }
        basic={
          detail ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(detailColumns, detail)}
            />
          ) : undefined
        }
        supplementary={
          detail?.attachments?.length ? (
            <LineAttachmentsUpload
              category="equipment_repair_attachments"
              value={detail.attachments}
              readOnly
            />
          ) : undefined
        }
        supplementaryTitle={t(`${P}.col.attachments`, { defaultValue: '照片' })}
      />

      <FormModalTemplate
        title={t(`${P}.completeModal`)}
        open={completeVisible}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteVisible(false);
            setCompleteTarget(null);
          }
        }}
        initialValues={{ repair_result: '成功' }}
        onFinish={handleComplete}
        submitter={{ submitButtonProps: { loading: completing } }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="repair_result"
          label={t(`${P}.col.repairResult`)}
          options={[
            { label: '成功', value: '成功' },
            { label: '失败', value: '失败' },
            { label: '部分成功', value: '部分成功' },
          ]}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>
    </>
  );
};

export default EquipmentRepairsPage;
