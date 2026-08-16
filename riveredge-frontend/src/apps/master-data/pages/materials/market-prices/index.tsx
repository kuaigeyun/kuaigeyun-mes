/**
 * 原料行情：按品种与业务日维护行情价；预设常用金属，表格内改当日价。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { App, Button, InputNumber, Modal, Popconfirm, Space, Table } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { formatBusinessDateOnly, todaySiteDateString } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  GLOBAL_DOC_LIST_FIELD_RANK,
  masterCrudCreatedUpdatedColumns,
} from '../../../utils/materialListCore';
import { materialMarketPriceApi } from '../../../services/material-market-price';
import type {
  MaterialMarketPrice,
  MaterialMarketPricePresetItem,
} from '../../../types/material-market-price';

function formatDate(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v && typeof v === 'object' && 'format' in v && typeof (v as { format?: (p: string) => string }).format === 'function') {
    return (v as { format: (p: string) => string }).format('YYYY-MM-DD');
  }
  return String(v);
}

function numericPrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const TodayPriceInput: React.FC<{
  record: MaterialMarketPrice;
  disabled: boolean;
  placeholder: string;
  onSave: (record: MaterialMarketPrice, unitPrice: number) => Promise<void>;
}> = ({ record, disabled, placeholder, onSave }) => {
  const [value, setValue] = useState<number | null>(
    numericPrice(record.unitPrice) > 0 ? numericPrice(record.unitPrice) : null,
  );

  useEffect(() => {
    setValue(numericPrice(record.unitPrice) > 0 ? numericPrice(record.unitPrice) : null);
  }, [record.uuid, record.unitPrice, record.updatedAt]);

  const commit = async (next: number | null) => {
    const unitPrice = next == null || Number.isNaN(next) ? 0 : next;
    if (unitPrice === numericPrice(record.unitPrice)) return;
    await onSave(record, unitPrice);
  };

  return (
    <InputNumber
      min={0}
      precision={2}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: '100%' }}
      onChange={(next) => setValue(next)}
      onBlur={() => void commit(value)}
      onPressEnter={() => void commit(value)}
    />
  );
};

const MarketPricesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('master-data:material');
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>();
  const savingRef = useRef<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);
  const [presetList, setPresetList] = useState<MaterialMarketPricePresetItem[]>([]);
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([]);
  const today = todaySiteDateString();

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priceDate: today,
      priceType: 'tax_inclusive',
    });
  };

  const handleEdit = async (record: MaterialMarketPrice) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await materialMarketPriceApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        priceDate: detail.priceDate,
        unitPrice: numericPrice(detail.unitPrice) > 0 ? numericPrice(detail.unitPrice) : undefined,
        priceType: detail.priceType === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive',
      });
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('app.master-data.marketPrices.getDetailFailed')));
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const priceDate = formatDate(values.priceDate);
    const unitPrice = Number(values.unitPrice);
    const priceType = values.priceType === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive';
    if (!priceDate || !(unitPrice > 0)) {
      messageApi.error(t('app.master-data.marketPrices.invalidForm'));
      throw new Error(t('app.master-data.marketPrices.invalidForm'));
    }
    try {
      if (isEdit && currentUuid) {
        await materialMarketPriceApi.update(currentUuid, {
          name: String(values.name || '').trim(),
          unitPrice,
          priceType,
        });
        messageApi.success(t('common.updateSuccess'));
      } else {
        await materialMarketPriceApi.create({
          code: String(values.code || '').trim(),
          name: String(values.name || '').trim(),
          priceDate,
          unitPrice,
          priceType,
        });
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('common.operationFailed')));
      throw e;
    }
  };

  const handleDelete = async (record: MaterialMarketPrice) => {
    try {
      await materialMarketPriceApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('common.deleteFailed')));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await materialMarketPriceApi.delete(String(key));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleSaveTodayPrice = async (record: MaterialMarketPrice, unitPrice: number) => {
    if (unitPrice < 0) {
      messageApi.error(t('app.master-data.marketPrices.priceInvalid'));
      return;
    }
    if (savingRef.current.has(record.uuid)) return;
    savingRef.current.add(record.uuid);
    try {
      await materialMarketPriceApi.update(record.uuid, { unitPrice });
      messageApi.success(t('app.master-data.marketPrices.priceSaved'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('common.operationFailed')));
    } finally {
      savingRef.current.delete(record.uuid);
    }
  };

  const openLoadPreset = async () => {
    setPresetLoading(true);
    try {
      const list = await materialMarketPriceApi.listPresets();
      setPresetList(list);
      setSelectedPresetCodes(list.filter((item) => !item.exists).map((item) => item.code));
      setPresetOpen(true);
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('common.operationFailed')));
    } finally {
      setPresetLoading(false);
    }
  };

  const confirmLoadPreset = async () => {
    setPresetConfirmLoading(true);
    try {
      const res = await materialMarketPriceApi.loadPresets(selectedPresetCodes);
      messageApi.success(
        t('app.master-data.marketPrices.loadPresetSuccess', {
          created: res.created,
          skipped: res.skipped,
        }),
      );
      setPresetOpen(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(getApiErrorMessage(e, t('common.operationFailed')));
    } finally {
      setPresetConfirmLoading(false);
    }
  };

  const columns: ProColumns<MaterialMarketPrice>[] = useMemo(
    () => [
      {
        title: t('app.master-data.marketPrices.priceDate'),
        dataIndex: 'priceDate',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'date',
        initialValue: today,
        sorter: true,
        render: (_, r) => (r.priceDate ? formatBusinessDateOnly(String(r.priceDate)) : '-'),
      },
      {
        title: t('app.master-data.marketPrices.quoteCode'),
        dataIndex: 'code',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        copyable: true,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.master-data.marketPrices.quoteName'),
        dataIndex: 'name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.master-data.marketPrices.keyword'),
        dataIndex: 'keyword',
        hideInTable: true,
      },
      {
        title: t('app.master-data.marketPrices.unitPrice'),
        dataIndex: 'unitPrice',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, record) =>
          perms.canUpdate ? (
            <TodayPriceInput
              record={record}
              disabled={false}
              placeholder={t('app.master-data.marketPrices.pricePlaceholder')}
              onSave={handleSaveTodayPrice}
            />
          ) : numericPrice(record.unitPrice) > 0 ? (
            numericPrice(record.unitPrice)
          ) : (
            '-'
          ),
      },
      {
        title: t('app.kuaizhizao.salesOrder.priceType'),
        dataIndex: 'priceType',
        width: 80,
        minWidth: 80,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => (
          <MarkerTag>
            {r.priceType === 'tax_exclusive'
              ? t('app.kuaizhizao.salesOrder.taxExclusive')
              : t('app.kuaizhizao.salesOrder.taxInclusive')}
          </MarkerTag>
        ),
      },
      ...masterCrudCreatedUpdatedColumns<MaterialMarketPrice>(t),
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        render: (_, record) =>
          perms.canUpdate ? (
            <Space>
              <Button
                key="edit"
                {...rowActionKind('update')}
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                {t('field.customField.edit')}
              </Button>
              <Popconfirm
                key="delete"
                {...rowActionKind('delete')}
                title={t('common.confirmDelete')}
                onConfirm={() => handleDelete(record)}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  {t('field.customField.delete')}
                </Button>
              </Popconfirm>
            </Space>
          ) : null,
      },
    ],
    [t, perms.canUpdate, today],
  );

  return (
    <ListPageTemplate>
      <UniTable<MaterialMarketPrice>
        columnPersistenceId="apps.master-data.pages.materials.market-prices.list-v3"
        headerTitle={t('app.master-data.menu.materials.market-prices')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, search) => {
          const { current = 1, pageSize = 20 } = params;
          const sortKey = sort ? Object.keys(sort)[0] : undefined;
          const res = await materialMarketPriceApi.list({
            skip: ((current as number) - 1) * (pageSize as number),
            limit: pageSize as number,
            keyword: (params.keyword as string) || (search?.keyword as string) || undefined,
            priceDate: formatDate(params.priceDate ?? search?.priceDate) || today,
            sortBy: sortKey,
            sortOrder: sortKey && sort?.[sortKey] === 'ascend' ? 'asc' : sortKey ? 'desc' : undefined,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{ labelWidth: 'auto' }}
        showCreateButton={perms.canUpdate}
        createButtonText={t('pages.system.create')}
        onCreate={handleCreate}
        showDeleteButton={perms.canUpdate}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        enableRowSelection={perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        toolBarActionsAfterCreate={
          perms.canUpdate
            ? [
                <Button key="loadPreset" loading={presetLoading} onClick={() => void openLoadPreset()}>
                  {t('app.master-data.marketPrices.loadPreset')}
                </Button>,
              ]
            : []
        }
      />

      <FormModalTemplate
        title={isEdit ? t('app.master-data.marketPrices.editTitle') : t('app.master-data.marketPrices.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="code"
          label={t('app.master-data.marketPrices.quoteCode')}
          rules={[{ required: true, message: t('app.master-data.marketPrices.quoteCodeRequired') }]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label={t('app.master-data.marketPrices.quoteName')}
          rules={[{ required: true, message: t('app.master-data.marketPrices.quoteNameRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="priceDate"
          label={t('app.master-data.marketPrices.priceDate')}
          rules={[{ required: true, message: t('app.master-data.marketPrices.priceDateRequired') }]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="unitPrice"
          label={t('app.master-data.marketPrices.unitPrice')}
          rules={[{ required: true, message: t('app.master-data.marketPrices.unitPriceRequired') }]}
          min={0.000001}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="priceType"
          label={t('app.kuaizhizao.salesOrder.priceType')}
          initialValue="tax_inclusive"
          options={[
            { label: t('app.kuaizhizao.salesOrder.taxInclusive'), value: 'tax_inclusive' },
            { label: t('app.kuaizhizao.salesOrder.taxExclusive'), value: 'tax_exclusive' },
          ]}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      <Modal
        title={t('app.master-data.marketPrices.loadPreset')}
        open={presetOpen}
        onCancel={() => setPresetOpen(false)}
        width={560}
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
            onClick={() => void confirmLoadPreset()}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          {t('app.master-data.marketPrices.loadPresetDesc')}
        </p>
        <Table<MaterialMarketPricePresetItem>
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
              title: t('app.master-data.marketPrices.quoteName'),
              dataIndex: 'name',
            },
            {
              title: t('app.master-data.marketPrices.quoteCode'),
              dataIndex: 'code',
              width: 120,
            },
            {
              title: t('app.master-data.marketPrices.alreadyExists'),
              dataIndex: 'exists',
              width: 88,
              render: (_, row) =>
                row.exists ? (
                  <MarkerTag color="default">{t('app.master-data.marketPrices.alreadyExists')}</MarkerTag>
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

export default MarketPricesPage;
