/**
 * 销售合同条款管理弹窗（条款项 + 条款组 + 公司印章）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSwitch,
  ProFormDigit,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Tabs, Transfer } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { MODAL_CONFIG } from '../../../../../components/layout-templates/constants';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { extractPlaceholders, extractFieldBindings } from './contract-term-placeholders';
import { ContractTermContentField } from './ContractTermContentField';
import { useCompanySealSettings } from './CompanySealSettingsPanel';
import {
  salesContractTermApi,
  type SalesContractTermGroup,
  type SalesContractTermItem,
} from '../../../services/sales-contract-term';

interface SalesContractTermsManageModalProps {
  open: boolean;
  onClose: () => void;
}

export const SalesContractTermsManageModal: React.FC<SalesContractTermsManageModalProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const itemActionRef = useRef<ActionType>();
  const groupActionRef = useRef<ActionType>();
  const [activeTab, setActiveTab] = useState('items');
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalesContractTermItem | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SalesContractTermGroup | null>(null);
  const [allItems, setAllItems] = useState<SalesContractTermItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const companySeal = useCompanySealSettings({ enabled: open });

  const loadAllItems = useCallback(async () => {
    try {
      const res = await salesContractTermApi.listItems({ limit: 1000, is_active: true });
      setAllItems(res.items || []);
    } catch {
      setAllItems([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadAllItems();
    }
  }, [open, loadAllItems]);

  const handleDeleteItem = (record: SalesContractTermItem) => {
    modal.confirm({
      title: t('app.kuaizhizao.salesContract.terms.deleteItemConfirm'),
      onOk: async () => {
        try {
          await salesContractTermApi.deleteItem(record.id!);
          message.success(t('common.deleteSuccess'));
          itemActionRef.current?.reload();
          loadAllItems();
        } catch (e: any) {
          message.error(e?.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleDeleteGroup = (record: SalesContractTermGroup) => {
    modal.confirm({
      title: t('app.kuaizhizao.salesContract.terms.deleteGroupConfirm'),
      onOk: async () => {
        try {
          await salesContractTermApi.deleteGroup(record.id!);
          message.success(t('common.deleteSuccess'));
          groupActionRef.current?.reload();
        } catch (e: any) {
          message.error(e?.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const itemColumns: ProColumns<SalesContractTermItem>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesContract.terms.colCode'),
        dataIndex: 'term_code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colName'),
        dataIndex: 'term_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colContent'),
        dataIndex: 'content',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => (
          <span title={r.content}>{r.content?.length > 80 ? `${r.content.slice(0, 80)}…` : r.content}</span>
        ),
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colPlaceholders'),
        key: 'placeholders',
        dataIndex: 'placeholders',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => {
          const manual = extractPlaceholders(r.content ?? '');
          const fields = extractFieldBindings(r.content ?? '');
          const parts = [
            ...manual.map((k) => `{${k}}`),
            ...fields.map((f) => `{@${f}}`),
          ];
          return parts.length ? parts.join('、') : '—';
        },
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colSort'),
        dataIndex: 'sort_order',
        width: 72,
        minWidth: 72,
        uniTableKeepWidth: true,
        resizable: false,
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        render: (_, r) =>
          r.is_active ? (
            <MarkerTag color="success">{t('common.enabled')}</MarkerTag>
          ) : (
            <MarkerTag color="default">{t('common.disabled')}</MarkerTag>
          ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        render: (_, record) => [
          <Button
            key="edit"
            {...rowActionKind('update')}
            onClick={() => {
              setEditingItem(record);
              setItemFormOpen(true);
            }}
          />,
          <Button
            key="delete"
            {...rowActionKind('delete')}
            onClick={() => handleDeleteItem(record)}
          />,
        ],
      },
    ],
    [t, modal, message],
  );

  const groupColumns: ProColumns<SalesContractTermGroup>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesContract.terms.colGroupCode'),
        dataIndex: 'group_code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colGroupName'),
        dataIndex: 'group_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('common.remark'),
        dataIndex: 'description',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        render: (_, r) =>
          r.is_active ? (
            <MarkerTag color="success">{t('common.enabled')}</MarkerTag>
          ) : (
            <MarkerTag color="default">{t('common.disabled')}</MarkerTag>
          ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        render: (_, record) => [
          <Button
            key="edit"
            {...rowActionKind('update')}
            onClick={async () => {
              try {
                const detail = await salesContractTermApi.getGroup(record.id!);
                setEditingGroup(detail);
                setSelectedItemIds((detail.items || []).map((it) => it.term_item_id));
                setGroupFormOpen(true);
              } catch (e: any) {
                message.error(e?.message || t('common.loadFailed'));
              }
            }}
          />,
          <Button
            key="delete"
            {...rowActionKind('delete')}
            onClick={() => handleDeleteGroup(record)}
          />,
        ],
      },
    ],
    [t, modal, message],
  );

  const transferDataSource = useMemo(
    () =>
      allItems.map((it) => ({
        key: String(it.id),
        title: it.term_name,
        description: it.term_code || it.content?.slice(0, 40),
      })),
    [allItems],
  );

  return (
    <>
      <Modal
        title={t('app.kuaizhizao.salesContract.terms.manageTitle')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        destroyOnHidden
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          styles={{ content: { paddingTop: 0, paddingBottom: 0 } }}
          items={[
            {
              key: 'items',
              label: t('app.kuaizhizao.salesContract.terms.tabItems'),
              children: (
                <UniTable<SalesContractTermItem>
                  embedded
                  columnPersistenceId="apps.kuaizhizao.sales-contracts.terms-items-width-v1"
                  actionRef={itemActionRef}
                  rowKey="id"
                  search={false}
                  showFuzzySearch={false}
                  showAdvancedSearch={false}
                  options={false}
                  viewTypes={['table']}
                  showCreateButton
                  createButtonText={t('app.kuaizhizao.salesContract.terms.newItem')}
                  onCreate={() => {
                    setEditingItem(null);
                    setItemFormOpen(true);
                  }}
                  pagination={{ pageSize: 10 }}
                  allowCustomScrollY
                  scroll={{ y: 360 }}
                  request={async (params) => {
                    const res = await salesContractTermApi.listItems({
                      skip: ((params.current || 1) - 1) * (params.pageSize || 10),
                      limit: params.pageSize || 10,
                    });
                    return { data: res.items || [], success: true, total: res.total || 0 };
                  }}
                  columns={itemColumns}
                />
              ),
            },
            {
              key: 'groups',
              label: t('app.kuaizhizao.salesContract.terms.tabGroups'),
              children: (
                <UniTable<SalesContractTermGroup>
                  embedded
                  columnPersistenceId="apps.kuaizhizao.sales-contracts.terms-groups-width-v1"
                  actionRef={groupActionRef}
                  rowKey="id"
                  search={false}
                  showFuzzySearch={false}
                  showAdvancedSearch={false}
                  options={false}
                  viewTypes={['table']}
                  showCreateButton
                  createButtonText={t('app.kuaizhizao.salesContract.terms.newGroup')}
                  onCreate={() => {
                    setEditingGroup(null);
                    setSelectedItemIds([]);
                    setGroupFormOpen(true);
                    loadAllItems();
                  }}
                  pagination={{ pageSize: 10 }}
                  allowCustomScrollY
                  scroll={{ y: 360 }}
                  request={async (params) => {
                    const res = await salesContractTermApi.listGroups({
                      skip: ((params.current || 1) - 1) * (params.pageSize || 10),
                      limit: params.pageSize || 10,
                    });
                    return { data: res.items || [], success: true, total: res.total || 0 };
                  }}
                  columns={groupColumns}
                />
              ),
            },
            {
              key: 'seal',
              label: t('app.kuaizhizao.salesContract.terms.tabSeal'),
              children: companySeal.panel,
            },
          ]}
        />
      </Modal>

      {companySeal.cropModal}

      <ModalForm<SalesContractTermItem>
        title={
          editingItem
            ? t('app.kuaizhizao.salesContract.terms.editItem')
            : t('app.kuaizhizao.salesContract.terms.newItem')
        }
        open={itemFormOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setItemFormOpen(false) }}
        initialValues={
          editingItem || { sort_order: 0, is_active: true, term_code: '', term_name: '', content: '' }
        }
        onFinish={async (values) => {
          try {
            if (editingItem?.id) {
              await salesContractTermApi.updateItem(editingItem.id, values);
            } else {
              await salesContractTermApi.createItem(values);
            }
            message.success(t('common.saveSuccess'));
            setItemFormOpen(false);
            itemActionRef.current?.reload();
            loadAllItems();
            return true;
          } catch (e: any) {
            message.error(e?.message || t('common.saveFailed'));
            return false;
          }
        }}
      >
        <ProFormText name="term_code" label={t('app.kuaizhizao.salesContract.terms.colCode')} />
        <ProFormText
          name="term_name"
          label={t('app.kuaizhizao.salesContract.terms.colName')}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ContractTermContentField />
        <ProFormDigit name="sort_order" label={t('app.kuaizhizao.salesContract.terms.colSort')} min={0} fieldProps={{ precision: 0 }} />
        <ProFormSwitch name="is_active" label={t('common.enabled')} />
      </ModalForm>

      <ModalForm
        title={
          editingGroup
            ? t('app.kuaizhizao.salesContract.terms.editGroup')
            : t('app.kuaizhizao.salesContract.terms.newGroup')
        }
        open={groupFormOpen}
        width={720}
        modalProps={{ destroyOnHidden: true, onCancel: () => setGroupFormOpen(false) }}
        initialValues={
          editingGroup || { is_active: true, group_code: '', group_name: '', description: '' }
        }
        onFinish={async (values) => {
          const items = selectedItemIds.map((id, idx) => ({
            term_item_id: id,
            sort_order: idx,
          }));
          if (!items.length) {
            message.warning(t('app.kuaizhizao.salesContract.terms.groupItemsRequired'));
            return false;
          }
          try {
            const payload = {
              group_code: values.group_code,
              group_name: values.group_name,
              description: values.description,
              is_active: values.is_active,
              items,
            };
            if (editingGroup?.id) {
              await salesContractTermApi.updateGroup(editingGroup.id, payload);
            } else {
              await salesContractTermApi.createGroup(payload);
            }
            message.success(t('common.saveSuccess'));
            setGroupFormOpen(false);
            groupActionRef.current?.reload();
            return true;
          } catch (e: any) {
            message.error(e?.message || t('common.saveFailed'));
            return false;
          }
        }}
      >
        <ProFormText name="group_code" label={t('app.kuaizhizao.salesContract.terms.colGroupCode')} />
        <ProFormText
          name="group_name"
          label={t('app.kuaizhizao.salesContract.terms.colGroupName')}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <div style={{ marginBottom: 8 }}>{t('app.kuaizhizao.salesContract.terms.selectItems')}</div>
        <Transfer
          dataSource={transferDataSource}
          titles={[
            t('app.kuaizhizao.salesContract.terms.availableItems'),
            t('app.kuaizhizao.salesContract.terms.selectedItems'),
          ]}
          targetKeys={selectedItemIds.map(String)}
          onChange={(keys) => setSelectedItemIds(keys.map(Number))}
          render={(item) => item.title}
          styles={{
            root: { width: '100%' },
            section: { flex: 1, width: 'auto', minWidth: 0, height: 280 },
          }}
          showSearch
        />
        <ProFormTextArea name="description" label={t('common.remark')} />
        <ProFormSwitch name="is_active" label={t('common.enabled')} />
      </ModalForm>
    </>
  );
};

export default SalesContractTermsManageModal;
