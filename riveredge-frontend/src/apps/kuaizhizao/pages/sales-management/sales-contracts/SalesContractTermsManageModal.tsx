/**
 * 销售合同条款管理弹窗（条款项 + 条款组）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSwitch,
  ProFormDigit,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tabs, Tag, Transfer } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { extractPlaceholders } from './contract-term-placeholders';
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
      { title: t('app.kuaizhizao.salesContract.terms.colCode'), dataIndex: 'term_code', width: 120 },
      { title: t('app.kuaizhizao.salesContract.terms.colName'), dataIndex: 'term_name', width: 180 },
      {
        title: t('app.kuaizhizao.salesContract.terms.colContent'),
        dataIndex: 'content',
        ellipsis: true,
        render: (_, r) => (
          <span title={r.content}>{r.content?.length > 80 ? `${r.content.slice(0, 80)}…` : r.content}</span>
        ),
      },
      {
        title: t('app.kuaizhizao.salesContract.terms.colPlaceholders'),
        width: 140,
        ellipsis: true,
        render: (_, r) => {
          const keys = extractPlaceholders(r.content ?? '');
          return keys.length ? keys.map((k) => `{${k}}`).join('、') : '—';
        },
      },
      { title: t('app.kuaizhizao.salesContract.terms.colSort'), dataIndex: 'sort_order', width: 72 },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        width: 88,
        render: (_, r) =>
          r.is_active ? (
            <Tag color="success">{t('common.enabled')}</Tag>
          ) : (
            <Tag>{t('common.disabled')}</Tag>
          ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 140,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button key="edit" {...rowActionKind('update')}
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingItem(record);
                setItemFormOpen(true);
              }}
            >
              {t('common.edit')}
            </Button>
            <Button key="delete" {...rowActionKind('delete')}
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteItem(record)}
            >
              {t('common.delete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, modal, message],
  );

  const groupColumns: ProColumns<SalesContractTermGroup>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.salesContract.terms.colGroupCode'), dataIndex: 'group_code', width: 120 },
      { title: t('app.kuaizhizao.salesContract.terms.colGroupName'), dataIndex: 'group_name', width: 180 },
      {
        title: t('app.kuaizhizao.salesContract.terms.colDescription'),
        dataIndex: 'description',
        ellipsis: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        width: 88,
        render: (_, r) =>
          r.is_active ? (
            <Tag color="success">{t('common.enabled')}</Tag>
          ) : (
            <Tag>{t('common.disabled')}</Tag>
          ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 140,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button key="edit" {...rowActionKind('update')}
              size="small"
              icon={<EditOutlined />}
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
            >
              {t('common.edit')}
            </Button>
            <Button key="delete" {...rowActionKind('delete')}
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteGroup(record)}
            >
              {t('common.delete')}
            </Button>
          </Space>
        ),
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
        width={960}
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
                  scroll={{ x: 'max-content', y: 360 }}
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
                  scroll={{ x: 'max-content', y: 360 }}
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
          ]}
        />
      </Modal>

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
            message.success(t('app.kuaizhizao.salesContract.terms.saved'));
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
        <ProFormTextArea
          name="content"
          label={t('app.kuaizhizao.salesContract.terms.colContent')}
          rules={[{ required: true, message: t('common.required') }]}
          fieldProps={{ rows: 6 }}
          extra={t('app.kuaizhizao.salesContract.terms.contentPlaceholderHint')}
        />
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
            message.success(t('app.kuaizhizao.salesContract.terms.saved'));
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
        <ProFormTextArea name="description" label={t('app.kuaizhizao.salesContract.terms.colDescription')} />
        <ProFormSwitch name="is_active" label={t('common.enabled')} />
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
          listStyle={{ width: 280, height: 280 }}
          showSearch
        />
      </ModalForm>
    </>
  );
};

export default SalesContractTermsManageModal;
