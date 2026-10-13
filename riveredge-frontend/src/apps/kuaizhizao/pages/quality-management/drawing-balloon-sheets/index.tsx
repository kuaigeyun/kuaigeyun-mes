import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Result, Spin } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CodeField from '../../../../../components/code-field';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { checkProFeatureAccess } from '../../../../../services/businessConfig';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
} from '../components/qualityTableColumns';
import { MaterialStackedCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  drawingBalloonSheetApi,
  DrawingBalloonSheet,
} from '../../../services/drawing-balloon-sheet';
import { pickListSearchKeyword } from '../../../../../utils/tableQueryKey';

const RESOURCE = 'kuaizhizao:quality-management-drawing-balloon-sheets';
const EDITOR_PATH = '/apps/kuaizhizao/quality-management/drawing-balloon-sheets';

function renderSheetStatusTag(status: string, t: (k: string) => string) {
  if (status === 'confirmed') {
    return <MarkerTag color="success">{t('app.kuaizhizao.quality.drawingBalloon.status.confirmed')}</MarkerTag>;
  }
  return <MarkerTag>{t('app.kuaizhizao.quality.drawingBalloon.status.draft')}</MarkerTag>;
}

const DrawingBalloonSheetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<DrawingBalloonSheet[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DrawingBalloonSheet | null>(null);
  const [proLoading, setProLoading] = useState(true);
  const [proOk, setProOk] = useState(false);
  const [proMessage, setProMessage] = useState<string | undefined>();
  const { canCreate, canUpdate, canDelete, canRead } = useResourcePermissions(RESOURCE);

  useEffect(() => {
    let cancelled = false;
    checkProFeatureAccess('modules', 'drawing_balloon_annotation')
      .then((res) => {
        if (!cancelled) {
          setProOk(res.has_access);
          setProMessage(res.upgrade_message);
          setProLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProOk(false);
          setProLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openEditor = useCallback(
    (row: DrawingBalloonSheet) => {
      navigate(`${EDITOR_PATH}/${row.id}/editor`);
    },
    [navigate],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  useNewShortcut(openCreate, canCreate && proOk);

  const resolveSelectedRows = useCallback(() => {
    const keySet = new Set(selectedRowKeys.map(String));
    return tableRowsRef.current.filter((row) => keySet.has(String(row.id)));
  }, [selectedRowKeys]);

  const columns = useMemo(() => {
    const base: ProColumns<DrawingBalloonSheet>[] = [
      {
        title: t('app.kuaizhizao.quality.drawingBalloon.sheetCode'),
        dataIndex: 'sheet_code',
        key: 'sheet_code',
        hideInTable: true,
        search: { order: 30 },
      },
      {
        title: t('common.title'),
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        uniTableRemainderFlex: true,
      },
      buildQualityInspectionListMaterialColumn(t),
      ...buildQualityInspectionListMaterialHiddenColumns(t),
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        width: 100,
        uniTableKeepWidth: true,
        render: (_, row) => renderSheetStatusTag(row.status, t),
      },
      {
        title: t('common.actions'),
        key: 'actions',
        fixed: 'right',
        width: 176,
        render: (_, row) => {
          const editable = row.status === 'draft';
          return [
            canRead || canUpdate ? (
              <Button
                {...rowActionKind('read')}
                key="open"
                type="link"
                size="small"
                onClick={() => openEditor(row)}
              >
                {t('app.kuaizhizao.quality.drawingBalloon.openEditor')}
              </Button>
            ) : null,
            canUpdate && editable ? (
              <Button
                {...rowActionKind('update')}
                key="edit"
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(row);
                  setOpen(true);
                }}
              >
                {t('common.edit')}
              </Button>
            ) : null,
            canDelete && editable ? (
              <Button
                {...rowActionKind('delete')}
                key="delete"
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={async () => {
                  try {
                    await drawingBalloonSheetApi.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload?.();
                  } catch (e: any) {
                    messageApi.error(e?.message || t('common.deleteFailed'));
                  }
                }}
              >
                {t('common.delete')}
              </Button>
            ) : null,
          ];
        },
      },
    ];
    return alignProColumns(base, GLOBAL_DOC_LIST_FIELD_RANK);
  }, [canDelete, canRead, canUpdate, messageApi, openEditor, t]);

  const createLabel = t('app.kuaizhizao.quality.drawingBalloon.createButton');

  if (proLoading) {
    return (
      <ListPageTemplate fillMain>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      </ListPageTemplate>
    );
  }

  if (!proOk) {
    return (
      <PermissionGuard permission={`${RESOURCE}:read`}>
        <ListPageTemplate fillMain>
          <Result
            status="403"
            title={t('app.kuaizhizao.quality.drawingBalloon.proRequiredTitle')}
            subTitle={proMessage || t('app.kuaizhizao.quality.drawingBalloon.proRequiredHint')}
          />
        </ListPageTemplate>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission={`${RESOURCE}:read`}>
      <ListPageTemplate fillMain>
        <UniTable<DrawingBalloonSheet>
          actionRef={actionRef}
          rowKey="id"
          permissionResource={RESOURCE}
          columnPersistenceId="kuaizhizao-drawing-balloon-sheets-v2"
          columns={columns}
          search={{ labelWidth: 'auto' }}
          form={{ syncToUrl: false }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          showCreateButton
          createButtonText={withSingleNewShortcutHint(createLabel)}
          onCreate={openCreate}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={!!canDelete}
          onDelete={async () => {
            const deletable = resolveSelectedRows().filter((row) => row.status === 'draft');
            if (!deletable.length) {
              messageApi.warning(t('app.kuaizhizao.quality.drawingBalloon.batchDeleteEmpty'));
              return;
            }
            try {
              for (const row of deletable) {
                await drawingBalloonSheetApi.delete(row.id);
              }
              messageApi.success(
                t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: deletable.length }),
              );
              setSelectedRowKeys([]);
              actionRef.current?.reload?.();
            } catch (e: any) {
              messageApi.error(e?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.quality.drawingBalloon.batchDeleteConfirm', { count })
          }
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params) => {
            const keyword = pickListSearchKeyword(params);
            const res = await drawingBalloonSheetApi.list({
              keyword,
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            });
            return { data: res.items, success: true, total: res.total };
          }}
          stackedPrimaryColumn={{
            title: t('app.kuaizhizao.quality.drawingBalloon.sheetCode'),
            render: (_, row) => (
              <MaterialStackedCell
                primary={row.sheet_code}
                secondary={row.title}
                onPrimaryClick={() => openEditor(row)}
              />
            ),
          }}
        />

        <FormModalTemplate
          title={
            editing
              ? t('app.kuaizhizao.quality.drawingBalloon.editModalTitle')
              : t('app.kuaizhizao.quality.drawingBalloon.createModalTitle')
          }
          open={open}
          onOpenChange={setOpen}
          width={MODAL_CONFIG.STANDARD_WIDTH}
          modalProps={{ destroyOnHidden: true }}
          onFinish={async (values) => {
            try {
              if (editing?.id) {
                await drawingBalloonSheetApi.update(editing.id, values);
                messageApi.success(t('common.saveSuccess'));
              } else {
                const created = await drawingBalloonSheetApi.create(values);
                messageApi.success(t('common.createSuccess'));
                setOpen(false);
                actionRef.current?.reload?.();
                openEditor(created);
                return true;
              }
              setOpen(false);
              actionRef.current?.reload?.();
              return true;
            } catch (e: any) {
              messageApi.error(e?.message || t('common.saveFailed'));
              return false;
            }
          }}
          initialValues={editing || { title: '' }}
        >
          <CodeField
            name="sheet_code"
            label={t('app.kuaizhizao.quality.drawingBalloon.sheetCode')}
            pageCode="kuaizhizao-quality-drawing-balloon-sheet"
            disabled={!!editing?.id}
          />
          <ProFormText
            name="title"
            label={t('common.title')}
            rules={[{ required: true, message: t('common.required') }]}
          />
          <ProFormText name="drawing_no" label={t('app.kuaizhizao.quality.fai.drawingNo')} />
          <ProFormText name="drawing_revision" label={t('app.kuaizhizao.quality.fai.drawingRevision')} />
          <ProFormTextArea
            name="remarks"
            label={t('common.remark')}
            fieldProps={{ rows: 3 }}
          />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default DrawingBalloonSheetsPage;
