import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import { App, Button, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { rowActionKind } from '../../../../../components/uni-action';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  financeMiscCategoryService,
  type MiscCategory,
  type MiscCategoryKind,
} from '../../../services/finance/finance-misc-category';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

const RESOURCE = 'kuaicaiwu:finance-misc-category';
const NS = 'app.kuaicaiwu.miscCategory';

const FinanceMiscCategoriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<MiscCategory[]>([]);
  const perms = useResourcePermissions(RESOURCE);
  const [kind, setKind] = useState<MiscCategoryKind>('income');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MiscCategory | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await financeMiscCategoryService.delete(kind, Number(key));
    }
    messageApi.success(t(`${NS}.batchDeleted`, { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchSetActive = async (keys: React.Key[], isActive: boolean) => {
    for (const key of keys) {
      await financeMiscCategoryService.update(kind, Number(key), { is_active: isActive });
    }
    messageApi.success(t(isActive ? `${NS}.batchEnabled` : `${NS}.batchDisabled`, { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const columns: ProColumns<MiscCategory>[] = useMemo(
    () => [
      {
        title: t(`${NS}.col.code`),
        dataIndex: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
      },
      { title: t(`${NS}.col.name`), dataIndex: 'name', ellipsis: true },
      {
        title: t(`${NS}.col.active`),
        dataIndex: 'is_active',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.is_active ? (
            <MarkerTag color="success">{t('common.enabled')}</MarkerTag>
          ) : (
            <MarkerTag>{t('common.disabled')}</MarkerTag>
          ),
      },
      {
        title: t(`${NS}.col.glAccount`),
        dataIndex: 'default_gl_account_code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const actions: React.ReactNode[] = [];
          if (perms.canUpdate) {
            actions.push(
              <Button
                key="edit"
                type="link"
                size="small"
                {...rowActionKind('update')}
                onClick={() => {
                  setEditing(record);
                  setModalOpen(true);
                }}
              />,
            );
          }
          if (perms.canDelete) {
            actions.push(
              <Popconfirm
                key="del"
                title={t(`${NS}.confirmDelete`)}
                onConfirm={async () => {
                  try {
                    await financeMiscCategoryService.delete(kind, record.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e, t('common.deleteFailed')));
                  }
                }}
              >
                <Button type="link" size="small" {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return actions;
        },
      },
    ],
    [kind, messageApi, perms.canDelete, perms.canUpdate, t],
  );

  const kindSegment = useMemo(
    () => (
      <ThemedSegmented
        surfaceBackground
        value={kind}
        onChange={(v) => {
          setKind(v as MiscCategoryKind);
          setSelectedRowKeys([]);
        }}
        options={[
          { label: t(`${NS}.tab.income`), value: 'income' },
          { label: t(`${NS}.tab.expense`), value: 'expense' },
        ]}
      />
    ),
    [kind, t],
  );

  const modalInitialValues = useMemo(() => {
    if (!editing) {
      return { is_active: true };
    }
    return {
      name: editing.name,
      default_gl_account_code: editing.default_gl_account_code ?? undefined,
      is_active: editing.is_active,
    };
  }, [editing]);

  return (
    <ListPageTemplate>
      <UniTable<MiscCategory>
        actionRef={actionRef}
        rowKey="id"
        permissionResource={RESOURCE}
        columnPersistenceId="apps.kuaizhizao.pages.finance-management.finance-misc-categories.list-v2"
        columns={columns}
        params={{ kind }}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        beforeSearchButtons={kindSegment}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t(`${NS}.createButton`)}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t(`${NS}.batchDeleteConfirm`, { count })}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <UniBatchMenuButton
                  key="misc-category-batch-actions"
                  selectedRowKeys={selectedRowKeys}
                  buttonText={t('components.uniBatch.batchActions')}
                  menuItems={[
                    {
                      key: 'batch-enable',
                      label: t(`${NS}.batchEnable`),
                      onClick: (keys) => handleBatchSetActive(keys, true),
                    },
                    {
                      key: 'batch-disable',
                      label: t(`${NS}.batchDisable`),
                      onClick: (keys) => handleBatchSetActive(keys, false),
                    },
                  ]}
                />,
              ]
            : undefined
        }
        request={async (params) => {
          const activeKind = (params?.kind as MiscCategoryKind | undefined) ?? kind;
          const rows = await financeMiscCategoryService.list(activeKind, { ensure_defaults: true });
          const list = Array.isArray(rows) ? rows : [];
          return { data: list, success: true, total: list.length };
        }}
      />
      <FormModalTemplate
        open={modalOpen}
        title={editing ? t(`${NS}.editTitle`) : t(`${NS}.createTitle`)}
        onCancel={() => setModalOpen(false)}
        initialValues={modalInitialValues}
        modalProps={{
          destroyOnHidden: true,
        }}
        onFinish={async (values) => {
          try {
            if (editing) {
              await financeMiscCategoryService.update(kind, editing.id, values);
              messageApi.success(t('common.updateSuccess'));
            } else {
              await financeMiscCategoryService.create(kind, values);
              messageApi.success(t('common.createSuccess'));
            }
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            messageApi.error(getApiErrorMessage(e, t('common.saveFailed')));
            return false;
          }
        }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {!editing && (
          <ProFormText name="code" label={t(`${NS}.col.code`)} rules={[{ required: true }]} />
        )}
        <ProFormText name="name" label={t(`${NS}.col.name`)} rules={[{ required: true }]} />
        <ProFormText name="default_gl_account_code" label={t(`${NS}.col.glAccount`)} />
        <ProFormSwitch name="is_active" label={t(`${NS}.col.active`)} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FinanceMiscCategoriesPage;
