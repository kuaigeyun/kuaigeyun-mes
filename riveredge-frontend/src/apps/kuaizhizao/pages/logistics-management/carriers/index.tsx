import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Modal, Table, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import {
  alignDescriptionColumns,
  alignProColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { LogisticsMasterDetailDrawer } from '../shared/LogisticsMasterDetailDrawer';
import {
  renderLogisticsCarrierTypeTag,
  renderLogisticsEnabledTag,
} from '../shared/logisticsListPresentation';
import {
  deleteCarrier,
  listCarrierPresets,
  listCarriers,
  loadCarrierPresets,
  type CarrierPresetItem,
  type LogisticsCarrier,
} from '../../../services/logistics';
import { CarrierFormModal, LOGISTICS_SETTLEMENT_METHOD_OPTIONS } from '../shared/CarrierFormModal';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const CarriersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('kuaizhizao:logistics-carrier');
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsCarrier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<LogisticsCarrier | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);
  const [presetList, setPresetList] = useState<CarrierPresetItem[]>([]);
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([]);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: LogisticsCarrier) => {
    setEditing(row);
    setOpen(true);
  };

  const openDetail = (row: LogisticsCarrier) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const openLoadCommonCarriers = async () => {
    setPresetLoading(true);
    try {
      const list = await listCarrierPresets();
      setPresetList(list);
      setSelectedPresetCodes(list.filter((item) => !item.exists).map((item) => item.code));
      setPresetOpen(true);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    } finally {
      setPresetLoading(false);
    }
  };

  const confirmLoadCommonCarriers = async () => {
    setPresetConfirmLoading(true);
    try {
      const res = await loadCarrierPresets(selectedPresetCodes);
      messageApi.success(
        t('app.kuaizhizao.logistics.message.loadCommonCarriersSuccess', {
          created: res.created,
          skipped: res.skipped,
        }),
      );
      setPresetOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    } finally {
      setPresetConfirmLoading(false);
    }
  };

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<LogisticsCarrier>(
        [
          { title: t('common.code'), dataIndex: 'code' },
          { title: t('common.name'), dataIndex: 'name' },
          {
            title: t('app.kuaizhizao.logistics.field.carrierType'),
            dataIndex: 'carrier_type',
            render: (_, record) => renderLogisticsCarrierTypeTag(t, record.carrier_type),
          },
          { title: t('app.kuaizhizao.logistics.field.contactName'), dataIndex: 'contact_name' },
          { title: t('app.kuaizhizao.logistics.field.contactPhone'), dataIndex: 'contact_phone' },
          { title: t('app.kuaizhizao.logistics.field.serviceHotline'), dataIndex: 'service_hotline' },
          {
            title: t('app.kuaizhizao.logistics.field.settlementMethod'),
            dataIndex: 'settlement_method',
            render: (_, record) => {
              const code = String(record.settlement_method ?? '').trim();
              if (!code) return '-';
              const opt = LOGISTICS_SETTLEMENT_METHOD_OPTIONS.find((item) => item.value === code);
              return opt ? t(opt.labelKey) : code;
            },
          },
          {
            title: t('common.enabled'),
            dataIndex: 'is_enabled',
            render: (_, record) => renderLogisticsEnabledTag(t, record.is_enabled),
          },
          { title: t('common.remark'), dataIndex: 'remark', span: 2 },
        ] as ProDescriptionsItemProps<LogisticsCarrier>[],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const columns: ProColumns<LogisticsCarrier>[] = useMemo(
    () =>
      alignProColumns<LogisticsCarrier>([
        {
          title: t('common.name'),
          key: 'logistics_carrier_stacked',
          dataIndex: 'name',
          minWidth: 160,
          uniTableRemainderFlex: true,
          uniTablePrimaryFlex: true,
          resizable: false,
          ellipsis: true,
          fixed: 'left',
        },
        {
          title: t('common.code'),
          dataIndex: 'code',
          width: 88,
          minWidth: 88,
          uniTableKeepWidth: true,
          resizable: false,
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierType'),
          dataIndex: 'carrier_type',
          ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          render: (_, row) => renderLogisticsCarrierTypeTag(t, row.carrier_type),
        },
        {
          title: t('app.kuaizhizao.logistics.field.serviceHotline'),
          dataIndex: 'service_hotline',
          width: 132,
          minWidth: 132,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => {
            const hotline = String(row.service_hotline ?? '').trim();
            if (!hotline) return '-';
            return <Typography.Text copyable={{ text: hotline }}>{hotline}</Typography.Text>;
          },
        },
        {
          title: t('app.kuaizhizao.logistics.field.contactName'),
          dataIndex: 'contact_name',
          width: 120,
          minWidth: 120,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          render: (_, row) => String(row.contact_name ?? '').trim() || '-',
        },
        {
          title: t('app.kuaizhizao.logistics.field.contactPhone'),
          dataIndex: 'contact_phone',
          width: 132,
          minWidth: 132,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => {
            const phone = String(row.contact_phone ?? '').trim();
            if (!phone) return '-';
            return <Typography.Text copyable={{ text: phone }}>{phone}</Typography.Text>;
          },
        },
        {
          title: t('common.enabled'),
          dataIndex: 'is_enabled',
          ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          hideInSearch: true,
          render: (_, row) => renderLogisticsEnabledTag(t, row.is_enabled),
        },
        {
          title: t('common.action'),
          key: 'option',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => {
            const nodes: React.ReactNode[] = [];
            if (perms.canRead) {
              nodes.push(
                <Button key="detail" {...rowActionKind('read')} onClick={() => openDetail(row)} />,
              );
            }
            if (perms.canUpdate) {
              nodes.push(
                <Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />,
              );
            }
            if (perms.canDelete) {
              nodes.push(
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    await deleteCarrier(row.id);
                    message.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                />,
              );
            }
            return nodes;
          },
        },
      ]),
    [perms.canDelete, perms.canRead, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<LogisticsCarrier>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.carriers')}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.carriers.v4"
        rowKey="id"
        request={async (params) => {
          const res = await listCarriers({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createCarrier')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteCarrier(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canCreate
            ? [
                <Button key="loadCommonCarriers" loading={presetLoading} onClick={() => void openLoadCommonCarriers()}>
                  {t('app.kuaizhizao.logistics.action.loadCommonCarriers')}
                </Button>,
              ]
            : []
        }
      />
      <LogisticsMasterDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        record={detail}
        title={`${t('app.kuaizhizao.logistics.detail.carrierTitle')}${detail?.name ? ` - ${detail.name}` : ''}`}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (detail) openEdit(detail);
        })}
        basicColumns={basicColumns}
      />
      <CarrierFormModal
        open={open}
        editing={editing}
        onClose={() => setOpen(false)}
        onSuccess={(record) => {
          if (detail?.id === record.id) {
            setDetail(record);
          }
          actionRef.current?.reload();
        }}
      />
      <Modal
        title={t('app.kuaizhizao.logistics.action.loadCommonCarriers')}
        open={presetOpen}
        onCancel={() => setPresetOpen(false)}
        width={640}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setPresetOpen(false)}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetCodes.length === 0}
            onClick={() => void confirmLoadCommonCarriers()}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          {t('app.kuaizhizao.logistics.action.loadCommonCarriersDesc')}
        </p>
        <Table<CarrierPresetItem>
          size="small"
          rowKey="code"
          dataSource={presetList}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetCodes,
            onChange: (keys) => setSelectedPresetCodes(keys.map(String)),
          }}
          columns={[
            {
              title: t('common.name'),
              dataIndex: 'name',
            },
            {
              title: t('common.code'),
              dataIndex: 'code',
              width: 80,
            },
            {
              title: t('app.kuaizhizao.logistics.field.carrierType'),
              dataIndex: 'carrier_type',
              width: 96,
              render: (_, row) => renderLogisticsCarrierTypeTag(t, row.carrier_type),
            },
            {
              title: t('app.kuaizhizao.logistics.field.serviceHotline'),
              dataIndex: 'service_hotline',
              width: 120,
              render: (_, row) => row.service_hotline || '-',
            },
            {
              title: t('app.kuaizhizao.logistics.field.alreadyExists'),
              dataIndex: 'exists',
              width: 88,
              render: (_, row) =>
                row.exists ? (
                  <MarkerTag color="default">{t('app.kuaizhizao.logistics.field.alreadyExists')}</MarkerTag>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default CarriersPage;
