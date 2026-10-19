import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDigit,
  ProFormList,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Modal, Popconfirm, Select, Space, Table, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { MarkerTag } from '../../../../constants/statusBadges';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDetailDrawerEditExtra } from '../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../master-data/hooks/useMasterDataBatchSetActive';
import { MasterDataDetailDrawer } from '../../../master-data/pages/shared/masterDataDetailDrawer';
import { VISION_LIST_COL, renderVisionEnabledMarker } from '../../utils/visionListPresentation';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listModels,
  listRecipes,
  publishRecipeVersion,
  updateRecipe,
  updateRecipeVersion,
  type VisionRecipe,
} from '../../services/kuaivision';

const RecipesPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:recipe');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<VisionRecipe[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisionRecipe | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<VisionRecipe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recipeType, setRecipeType] = useState<string>('thickness_measure');
  const canPublish = Boolean(perms.canAction?.('publish'));

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: (uuid, data) => updateRecipe(uuid, { is_enabled: data.isActive }),
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const openCreate = () => {
    setEditing(null);
    setRecipeType('thickness_measure');
    setOpen(true);
  };

  const openEdit = (row: VisionRecipe) => {
    setEditing(row);
    setRecipeType(row.recipe_type);
    setOpen(true);
  };

  const openDetail = async (row: VisionRecipe) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getRecipe(row.uuid));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const type = String(values.recipe_type || recipeType);
    const params =
      type === 'step_compliance'
        ? {
            steps: values.steps || [],
            fail_if_any_missing: Boolean(values.fail_if_any_missing),
          }
        : {
            tol_min: values.tol_min,
            tol_max: values.tol_max,
            unit: values.unit || 'mm',
            channel: values.channel || 'laser',
          };
    if (editing) {
      await updateRecipe(editing.uuid, {
        name: values.name,
        review_threshold: values.review_threshold,
        default_camera_code: values.default_camera_code,
        trigger_mode: values.trigger_mode,
        trigger_interval_seconds: values.trigger_interval_seconds,
        is_enabled: values.is_enabled,
        remark: values.remark,
      });
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createRecipe({
        code: values.code,
        name: values.name,
        recipe_type: type,
        review_threshold: values.review_threshold,
        default_camera_code: values.default_camera_code,
        trigger_mode: values.trigger_mode || 'manual',
        trigger_interval_seconds: values.trigger_interval_seconds,
        version: values.version || '1.0',
        params,
        is_enabled: values.is_enabled ?? true,
        remark: values.remark,
      });
      messageApi.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<VisionRecipe>[] = alignProColumns(
    [
      { title: t('common.code'), dataIndex: 'code', ...VISION_LIST_COL.code, copyable: true },
      { title: t('common.name'), dataIndex: 'name', ...VISION_LIST_COL.name },
      {
        title: t('app.kuaivision.field.recipeType'),
        dataIndex: 'recipe_type',
        ...VISION_LIST_COL.recipe,
        render: (_, row) =>
          t(`app.kuaivision.recipeType.${row.recipe_type}`, { defaultValue: row.recipe_type }),
      },
      {
        title: t('app.kuaivision.field.publishedVersion'),
        dataIndex: 'published_version',
        ...VISION_LIST_COL.station,
        search: false,
        render: (_, row) =>
          row.published_version ? (
            <MarkerTag color="success">{row.published_version}</MarkerTag>
          ) : (
            <MarkerTag color="default">{t('app.kuaivision.status.unpublished')}</MarkerTag>
          ),
      },
      {
        title: t('app.kuaivision.field.triggerMode'),
        dataIndex: 'trigger_mode',
        ...VISION_LIST_COL.station,
        search: false,
        render: (_, row) =>
          t(`app.kuaivision.triggerMode.${row.trigger_mode || 'manual'}`, {
            defaultValue: row.trigger_mode || 'manual',
          }),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        ...VISION_LIST_COL.marker,
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
      },
      {
        title: t('common.action'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const nodes: React.ReactNode[] = [];
          if (perms.canRead) {
            nodes.push(
              <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
            );
          }
          if (perms.canUpdate) {
            nodes.push(<Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />);
          }
          if (perms.canDelete) {
            nodes.push(
              <Popconfirm
                key="delete"
                title={t('common.confirmDelete')}
                onConfirm={async () => {
                  await deleteRecipe(row.uuid);
                  messageApi.success(t('common.deleteSuccess'));
                  actionRef.current?.reload();
                }}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button type="link" size="small" {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return nodes;
        },
      },
    ],
    GLOBAL_DOC_LIST_FIELD_RANK,
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<VisionRecipe>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code', copyable: true },
      { title: t('common.name'), dataIndex: 'name' },
      {
        title: t('app.kuaivision.field.recipeType'),
        dataIndex: 'recipe_type',
        render: (_, row) =>
          t(`app.kuaivision.recipeType.${row.recipe_type}`, { defaultValue: row.recipe_type }),
      },
      { title: t('app.kuaivision.field.reviewThreshold'), dataIndex: 'review_threshold' },
      { title: t('app.kuaivision.field.defaultCamera'), dataIndex: 'default_camera_code' },
      {
        title: t('app.kuaivision.field.triggerMode'),
        dataIndex: 'trigger_mode',
        render: (_, row) =>
          t(`app.kuaivision.triggerMode.${row.trigger_mode || 'manual'}`, {
            defaultValue: row.trigger_mode || 'manual',
          }),
      },
      {
        title: t('app.kuaivision.field.triggerInterval'),
        dataIndex: 'trigger_interval_seconds',
      },
      { title: t('app.kuaivision.field.publishedVersion'), dataIndex: 'published_version' },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
      },
      { title: t('common.remark'), dataIndex: 'remark' },
    ],
    [t],
  );

  const hasSteps = !editing && recipeType === 'step_compliance';

  return (
    <ListPageTemplate>
      {contextHolder}
      <UniTable<VisionRecipe>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.recipes.list-v3"
        permissionResource="kuaivision:recipe"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaivision.action.createRecipe')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((k) => deleteRecipe(String(k))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <MasterDataBatchActiveMenuButton
                  key="recipes-batch-active"
                  menuKey="recipes-batch-active"
                  selectedRowKeys={selectedRowKeys}
                  menuItems={batchActiveMenuItems}
                />,
              ]
            : undefined
        }
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        request={async (params) => {
          const res = await listRecipes({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
            recipe_type: params.recipe_type as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.recipes')}
        open={drawerOpen}
        loading={detailLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        detail={detail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail) && perms.canUpdate, () => {
          if (!detail) return;
          setDrawerOpen(false);
          openEdit(detail);
        })}
        linesTitle={t('app.kuaivision.section.versions')}
        lines={
          detail?.versions?.length ? (
            <Table
              size="small"
              pagination={false}
              rowKey="uuid"
              dataSource={detail.versions}
              columns={[
                { title: t('app.kuaivision.field.version'), dataIndex: 'version' },
                {
                  title: t('common.status'),
                  dataIndex: 'status',
                  render: (v: string) => (
                    <MarkerTag
                      color={v === 'published' ? 'success' : v === 'draft' ? 'processing' : 'default'}
                    >
                      {t(`app.kuaivision.versionStatus.${v}`, { defaultValue: v })}
                    </MarkerTag>
                  ),
                },
                {
                  title: t('app.kuaivision.field.model'),
                  dataIndex: 'model_artifact_code',
                  render: (v: string) => v || '-',
                },
                {
                  title: t('common.action'),
                  key: 'action',
                  render: (_, ver) => {
                    if (ver.status !== 'draft') return null;
                    const nodes: React.ReactNode[] = [];
                    if (perms.canUpdate) {
                      nodes.push(
                        <Button
                          key="bind"
                          {...rowActionKind('skip')}
                          {...rowActionLabelKeep()}
                          size="small"
                          onClick={async () => {
                            const models = await listModels({ page: 1, page_size: 100 });
                            if (!models.items.length) {
                              message.warning(t('app.kuaivision.message.noModel'));
                              return;
                            }
                            let selected = models.items[0].uuid;
                            Modal.confirm({
                              title: t('app.kuaivision.action.bindModel'),
                              content: (
                                <Select
                                  style={{ width: '100%', marginTop: 12 }}
                                  defaultValue={selected}
                                  options={models.items.map((m) => ({
                                    value: m.uuid,
                                    label: `${m.code} / ${m.name}`,
                                  }))}
                                  onChange={(v) => {
                                    selected = String(v);
                                  }}
                                />
                              ),
                              onOk: async () => {
                                const updated = await updateRecipeVersion(detail.uuid, ver.uuid, {
                                  model_artifact_uuid: selected,
                                  require_model: detail.recipe_type === 'step_compliance',
                                });
                                messageApi.success(t('app.kuaivision.message.modelBound'));
                                setDetail(updated);
                              },
                            });
                          }}
                        >
                          {t('app.kuaivision.action.bindModel')}
                        </Button>,
                      );
                    }
                    if (canPublish) {
                      nodes.push(
                        <Button
                          key="publish"
                          {...rowActionKind('skip')}
                          {...rowActionLabelKeep()}
                          size="small"
                          onClick={async () => {
                            const updated = await publishRecipeVersion(detail.uuid, ver.uuid);
                            messageApi.success(t('app.kuaivision.message.published'));
                            setDetail(updated);
                            actionRef.current?.reload();
                          }}
                        >
                          {t('app.kuaivision.action.publish')}
                        </Button>,
                      );
                    }
                    return nodes;
                  },
                },
              ]}
            />
          ) : null
        }
      />

      <FormModalTemplate
        key={editing?.uuid || 'create'}
        open={open}
        title={
          editing ? t('app.kuaivision.modal.editRecipe') : t('app.kuaivision.modal.createRecipe')
        }
        onClose={() => setOpen(false)}
        onFinish={handleSubmit}
        isEdit={Boolean(editing)}
        formRef={formRef as React.RefObject<ProFormInstance>}
        grid={!hasSteps}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={
          editing
            ? {
                code: editing.code,
                name: editing.name,
                recipe_type: editing.recipe_type,
                review_threshold: editing.review_threshold,
                default_camera_code: editing.default_camera_code,
                trigger_mode: editing.trigger_mode || 'manual',
                trigger_interval_seconds: editing.trigger_interval_seconds,
                is_enabled: editing.is_enabled,
                remark: editing.remark,
              }
            : {
                recipe_type: 'thickness_measure',
                version: '1.0',
                unit: 'mm',
                channel: 'laser',
                trigger_mode: 'manual',
                is_enabled: true,
                fail_if_any_missing: true,
                steps: [{ name: '', required: true }],
              }
        }
        onValuesChange={(changed) => {
          if (changed.recipe_type) setRecipeType(String(changed.recipe_type));
        }}
      >
        <ProFormText
          name="code"
          label={t('common.code')}
          colProps={hasSteps ? undefined : { span: 12 }}
          disabled={Boolean(editing)}
          rules={editing ? [] : [{ required: true, message: t('common.required') }]}
        />
        <ProFormText
          name="name"
          label={t('common.name')}
          colProps={hasSteps ? undefined : { span: 12 }}
          rules={[{ required: true, message: t('common.required') }]}
        />
        {!editing ? (
          <ProFormSelect
            name="recipe_type"
            label={t('app.kuaivision.field.recipeType')}
            colProps={hasSteps ? undefined : { span: 12 }}
            options={[
              { value: 'thickness_measure', label: t('app.kuaivision.recipeType.thickness_measure') },
              { value: 'step_compliance', label: t('app.kuaivision.recipeType.step_compliance') },
            ]}
            fieldProps={{ onChange: (v) => setRecipeType(String(v)) }}
          />
        ) : null}
        {!editing ? (
          <ProFormText
            name="version"
            label={t('app.kuaivision.field.version')}
            colProps={hasSteps ? undefined : { span: 12 }}
          />
        ) : null}
        <ProFormDigit
          name="review_threshold"
          label={t('app.kuaivision.field.reviewThreshold')}
          colProps={hasSteps ? undefined : { span: 12 }}
          min={0}
          max={1}
          fieldProps={{ step: 0.01 }}
        />
        <ProFormText
          name="default_camera_code"
          label={t('app.kuaivision.field.defaultCamera')}
          colProps={hasSteps ? undefined : { span: 12 }}
        />
        <ProFormSelect
          name="trigger_mode"
          label={t('app.kuaivision.field.triggerMode')}
          colProps={hasSteps ? undefined : { span: 12 }}
          options={[
            { value: 'manual', label: t('app.kuaivision.triggerMode.manual') },
            { value: 'interval', label: t('app.kuaivision.triggerMode.interval') },
            { value: 'gpio', label: t('app.kuaivision.triggerMode.gpio') },
          ]}
        />
        <ProFormDigit
          name="trigger_interval_seconds"
          label={t('app.kuaivision.field.triggerInterval')}
          colProps={hasSteps ? undefined : { span: 12 }}
          min={1}
          fieldProps={{ precision: 0 }}
        />
        {!editing && recipeType === 'thickness_measure' ? (
          <>
            <ProFormDigit name="tol_min" label={t('app.kuaivision.field.tolMin')} colProps={{ span: 12 }} />
            <ProFormDigit name="tol_max" label={t('app.kuaivision.field.tolMax')} colProps={{ span: 12 }} />
            <ProFormText name="unit" label={t('app.kuaivision.field.measureUnit')} colProps={{ span: 12 }} />
            <ProFormSelect
              name="channel"
              label={t('app.kuaivision.field.channel')}
              colProps={{ span: 12 }}
              options={[
                { value: 'laser', label: t('app.kuaivision.channel.laser') },
                { value: 'vision_2d', label: t('app.kuaivision.channel.vision_2d') },
                { value: 'external', label: t('app.kuaivision.channel.external') },
              ]}
            />
          </>
        ) : null}
        {!editing && recipeType === 'step_compliance' ? (
          <Space orientation="vertical" style={{ width: '100%', marginTop: 8 }}>
            <ProFormSwitch name="fail_if_any_missing" label={t('app.kuaivision.field.failIfAnyMissing')} />
            <ProFormList
              name="steps"
              label={t('app.kuaivision.section.steps')}
              creatorButtonProps={{ creatorButtonText: t('app.kuaivision.action.addStep') }}
            >
              <ProFormText
                name="name"
                label={t('app.kuaivision.field.stepName')}
                rules={[{ required: true, message: t('common.required') }]}
              />
              <ProFormSwitch name="required" label={t('app.kuaivision.field.stepRequired')} />
            </ProFormList>
          </Space>
        ) : null}
        <ProFormTextArea
          name="remark"
          label={t('common.remark')}
          colProps={hasSteps ? undefined : { span: 24 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label={t('common.enabled')}
          colProps={hasSteps ? undefined : { span: 12 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RecipesPage;
