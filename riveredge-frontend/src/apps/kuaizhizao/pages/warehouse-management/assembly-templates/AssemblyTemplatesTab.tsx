import React, { useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Card, Form as AntForm, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  DRAWER_CONFIG,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { assemblyTemplateApi } from '../../../services/assembly-template';

const ASSEMBLY_ORDERS_RESOURCE = 'kuaizhizao:warehouse-management-assembly-orders';

type TemplateItem = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity_per_base?: number;
  unit_price?: number;
  sequence?: number;
  remarks?: string;
};

type AssemblyTemplate = {
  id?: number;
  template_code?: string;
  template_name?: string;
  product_material_id?: number;
  product_material_code?: string;
  product_material_name?: string;
  base_quantity?: number;
  source_type?: string;
  is_active?: boolean;
  total_items?: number;
  remarks?: string;
  updated_at?: string;
  items?: TemplateItem[];
};

const sourceTypeMap: Record<string, string> = {
  manual: '手工维护',
  bom: 'BOM 导入',
};

export const AssemblyTemplatesTab: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(ASSEMBLY_ORDERS_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AssemblyTemplate | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<AssemblyTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<TemplateItem | null>(null);
  const [bomPreviewLines, setBomPreviewLines] = useState<TemplateItem[]>([]);
  const [bomPreviewVisible, setBomPreviewVisible] = useState(false);

  const reloadList = () => actionRef.current?.reload();

  const refreshCurrentTemplate = async (templateId?: number) => {
    const targetId = templateId ?? currentTemplate?.id;
    if (!targetId) return;
    try {
      const detail = await assemblyTemplateApi.get(String(targetId));
      setCurrentTemplate(detail as AssemblyTemplate);
    } catch {
      // keep drawer content
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ base_quantity: 1, is_active: true });
    }, 0);
  };

  const openEditModal = async (record: AssemblyTemplate) => {
    try {
      const detail = await assemblyTemplateApi.get(String(record.id));
      setEditingTemplate(detail as AssemblyTemplate);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          template_name: detail.template_name,
          product_material_id: detail.product_material_id,
          product_material_code: detail.product_material_code,
          product_material_name: detail.product_material_name,
          base_quantity: detail.base_quantity ?? 1,
          is_active: detail.is_active ?? true,
          remarks: detail.remarks,
        });
      }, 0);
    } catch (error: any) {
      messageApi.error(error?.message || '加载模板失败');
    }
  };

  const openDetailDrawer = async (record: AssemblyTemplate) => {
    try {
      const detail = await assemblyTemplateApi.get(String(record.id));
      setCurrentTemplate(detail as AssemblyTemplate);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || '加载模板详情失败');
    }
  };

  const submitTemplate = async (values: any) => {
    try {
      const payload = {
        template_name: values.template_name,
        product_material_id: values.product_material_id,
        product_material_code: values.product_material_code || '',
        product_material_name: values.product_material_name || '',
        base_quantity: Number(values.base_quantity || 1),
        is_active: values.is_active ?? true,
        remarks: values.remarks,
      };
      if (editingTemplate?.id) {
        await assemblyTemplateApi.update(String(editingTemplate.id), payload);
        messageApi.success('组装模板更新成功');
      } else {
        await assemblyTemplateApi.create(payload);
        messageApi.success('组装模板创建成功');
      }
      setModalVisible(false);
      setEditingTemplate(null);
      formRef.current?.resetFields();
      reloadList();
      if (currentTemplate?.id && editingTemplate?.id === currentTemplate.id) {
        await refreshCurrentTemplate(currentTemplate.id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '保存组装模板失败');
      throw error;
    }
  };

  const confirmDeleteTemplate = (record: AssemblyTemplate) => {
    Modal.confirm({
      title: '删除组装模板',
      content: `确定删除模板 "${record.template_code}" 吗？`,
      onOk: async () => {
        try {
          await assemblyTemplateApi.delete(String(record.id));
          messageApi.success('删除组装模板成功');
          if (currentTemplate?.id === record.id) {
            setDrawerVisible(false);
            setCurrentTemplate(null);
          }
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || '删除组装模板失败');
        }
      },
    });
  };

  const openItemModal = (template: AssemblyTemplate, item?: TemplateItem) => {
    setCurrentTemplate(template);
    setEditingItem(item ?? null);
    setItemModalVisible(true);
    setTimeout(() => {
      itemFormRef.current?.resetFields();
      if (item) {
        itemFormRef.current?.setFieldsValue({
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          quantity_per_base: item.quantity_per_base,
          unit_price: item.unit_price,
          remarks: item.remarks,
        });
      }
    }, 0);
  };

  const submitItem = async (values: any) => {
    if (!currentTemplate?.id) return;
    try {
      if (editingItem?.id) {
        await assemblyTemplateApi.updateItem(String(currentTemplate.id), String(editingItem.id), {
          quantity_per_base: Number(values.quantity_per_base || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success('模板明细更新成功');
      } else {
        await assemblyTemplateApi.createItem(String(currentTemplate.id), {
          material_id: values.material_id,
          material_code: values.material_code || '',
          material_name: values.material_name || '',
          quantity_per_base: Number(values.quantity_per_base || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success('模板明细添加成功');
      }
      setItemModalVisible(false);
      setEditingItem(null);
      itemFormRef.current?.resetFields();
      reloadList();
      await refreshCurrentTemplate(currentTemplate.id);
    } catch (error: any) {
      messageApi.error(error?.message || '保存模板明细失败');
      throw error;
    }
  };

  const confirmDeleteItem = (template: AssemblyTemplate, item: TemplateItem) => {
    Modal.confirm({
      title: '删除模板明细',
      content: `确定删除明细 "${item.material_code || item.material_name}" 吗？`,
      onOk: async () => {
        try {
          if (!template.id || !item.id) return;
          await assemblyTemplateApi.deleteItem(String(template.id), String(item.id));
          messageApi.success('模板明细删除成功');
          reloadList();
          await refreshCurrentTemplate(template.id);
        } catch (error: any) {
          messageApi.error(error?.message || '删除模板明细失败');
        }
      },
    });
  };

  const previewBom = async (template: AssemblyTemplate) => {
    if (!template.product_material_id) {
      messageApi.warning('请先设置成品物料');
      return;
    }
    try {
      const preview = await assemblyTemplateApi.bomPreview({
        product_material_id: template.product_material_id,
        base_quantity: template.base_quantity ?? 1,
        product_material_code: template.product_material_code,
        product_material_name: template.product_material_name,
      });
      setBomPreviewLines((preview.lines || []) as TemplateItem[]);
      setCurrentTemplate(template);
      setBomPreviewVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || 'BOM 预览失败');
    }
  };

  const confirmImportFromBom = (template: AssemblyTemplate) => {
    Modal.confirm({
      title: '从 BOM 读取',
      content: '将替换模板全部明细，是否继续？',
      onOk: async () => {
        try {
          const updated = await assemblyTemplateApi.importFromBom(String(template.id));
          messageApi.success('已从 BOM 导入模板明细');
          setCurrentTemplate(updated as AssemblyTemplate);
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || 'BOM 导入失败');
        }
      },
    });
  };

  const columns: ProColumns<AssemblyTemplate>[] = [
    {
      title: '模板编码',
      dataIndex: 'template_code',
      width: 140,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.template_code ?? '') }} ellipsis>
          {r.template_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '模板名称', dataIndex: 'template_name', width: 160, ellipsis: true },
    { title: '成品物料', dataIndex: 'product_material_name', width: 160, ellipsis: true },
    { title: '基准数量', dataIndex: 'base_quantity', width: 100, align: 'right', hideInSearch: true },
    { title: '行数', dataIndex: 'total_items', width: 80, align: 'right', hideInSearch: true },
    {
      title: '来源',
      dataIndex: 'source_type',
      width: 100,
      hideInSearch: true,
      render: (_, r) => sourceTypeMap[String(r.source_type ?? 'manual')] || r.source_type,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 90,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '停用', status: 'Default' },
      },
      render: (_, r) => (
        <Tag color={r.is_active ? 'success' : 'default'}>{r.is_active ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => openDetailDrawer(record)} />
          {canUpdate && <Button {...rowActionKind('update')} onClick={() => openEditModal(record)} />}
          {canUpdate && (
            <Button {...rowActionKind('import')} {...rowActionLabelKeep()} onClick={() => previewBom(record)}>
              预览 BOM
            </Button>
          )}
          {canDelete && <Button {...rowActionKind('delete')} onClick={() => confirmDeleteTemplate(record)} />}
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<AssemblyTemplate>[] = [
    { title: '模板编码', dataIndex: 'template_code' },
    { title: '模板名称', dataIndex: 'template_name' },
    { title: '成品物料', dataIndex: 'product_material_name' },
    { title: '基准数量', dataIndex: 'base_quantity' },
    {
      title: '来源',
      dataIndex: 'source_type',
      render: (value) => sourceTypeMap[String(value ?? 'manual')] || String(value ?? '-'),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (value) => (value ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    { title: '行数', dataIndex: 'total_items' },
    { title: '备注', dataIndex: 'remarks', span: 2 },
  ];

  const draftActions = currentTemplate ? (
    <Space>
      {canUpdate && (
        <Button size="small" onClick={() => openEditModal(currentTemplate)}>
          编辑主单
        </Button>
      )}
      {canCreate && (
        <Button size="small" icon={<PlusOutlined />} onClick={() => openItemModal(currentTemplate)}>
          添加明细
        </Button>
      )}
      {canUpdate && (
        <>
          <Button size="small" icon={<ImportOutlined />} onClick={() => previewBom(currentTemplate)}>
            预览 BOM
          </Button>
          <Button size="small" type="primary" icon={<ImportOutlined />} onClick={() => confirmImportFromBom(currentTemplate)}>
            从 BOM 读取
          </Button>
        </>
      )}
    </Space>
  ) : undefined;

  return (
    <ListPageTemplate>
      <UniTable<AssemblyTemplate>
        headerTitle="组装模板"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.assembly-templates"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        showCreateButton={canCreate}
        createButtonText="新建模板"
        onCreate={openCreateModal}
        request={async (params) => {
          const result = await assemblyTemplateApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            keyword: (params as any).keyword,
            is_active:
              params.is_active === 'true' ? true : params.is_active === 'false' ? false : undefined,
          });
          return {
            data: result.items || [],
            success: true,
            total: result.total || 0,
          };
        }}
        locale={{ emptyText: '暂无组装模板。' }}
        scroll={{ x: 1400 }}
      />

      <FormModalTemplate
        title={editingTemplate ? '编辑组装模板' : '新建组装模板'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingTemplate(null);
          formRef.current?.resetFields();
        }}
        onFinish={submitTemplate}
        formRef={formRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="template_name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <UniMaterialSelect
          name="product_material_id"
          label="成品/半成品物料"
          placeholder="请选择成品或半成品"
          required
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            product_material_code: 'mainCode',
            product_material_name: 'name',
          }}
        />
        <ProFormDigit
          name="base_quantity"
          label="基准数量"
          rules={[{ required: true, message: '请输入基准数量' }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSwitch name="is_active" label="启用" />
        <ProFormTextArea name="remarks" label="备注" fieldProps={{ rows: 3 }} />
        <AntForm.Item name="product_material_code" hidden />
        <AntForm.Item name="product_material_name" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingItem ? '编辑模板明细' : '添加模板明细'}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setEditingItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={submitItem}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label="组件物料"
          required
          disabled={!!editingItem}
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
          }}
        />
        <ProFormDigit
          name="quantity_per_base"
          label="单位用量"
          rules={[{ required: true, message: '请输入单位用量' }]}
          min={0.0001}
          fieldProps={{ precision: 4 }}
        />
        <ProFormDigit name="unit_price" label="默认单价" min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remarks" label="备注" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`组装模板${currentTemplate?.template_code ? ` - ${currentTemplate.template_code}` : ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setCurrentTemplate(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentTemplate || {}}
        columns={detailColumns}
        customContent={
          <Card title="组件明细" extra={draftActions}>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            {currentTemplate?.items && currentTemplate.items.length > 0 ? (
              <Table<TemplateItem>
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={currentTemplate.items}
                columns={[
                  { title: '组件编码', dataIndex: 'material_code', width: 120 },
                  { title: '组件名称', dataIndex: 'material_name', width: 150 },
                  {
                    title: '单位用量',
                    dataIndex: 'quantity_per_base',
                    width: 100,
                    align: 'right',
                    render: (v) => Number(v || 0).toFixed(4),
                  },
                  {
                    title: '默认单价',
                    dataIndex: 'unit_price',
                    width: 90,
                    align: 'right',
                    render: (v) => Number(v || 0).toFixed(2),
                  },
                  { title: '备注', dataIndex: 'remarks' },
                  {
                    title: '操作',
                    width: 140,
                    render: (_, item) =>
                      canUpdate || canDelete ? (
                        <Space size={0}>
                          {canUpdate && (
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemModal(currentTemplate!, item)}>
                              编辑
                            </Button>
                          )}
                          {canDelete && (
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteItem(currentTemplate!, item)}>
                              删除
                            </Button>
                          )}
                        </Space>
                      ) : null,
                  },
                ]}
              />
            ) : (
              <Typography.Text type="secondary">暂无明细，可手工添加或从 BOM 读取。</Typography.Text>
            )}
          </Card>
        }
      />

      <Modal
        title="BOM 预览"
        open={bomPreviewVisible}
        onCancel={() => setBomPreviewVisible(false)}
        footer={
          currentTemplate && canUpdate
            ? [
                <Button key="cancel" onClick={() => setBomPreviewVisible(false)}>
                  关闭
                </Button>,
                <Button
                  key="import"
                  type="primary"
                  onClick={() => {
                    setBomPreviewVisible(false);
                    confirmImportFromBom(currentTemplate);
                  }}
                >
                  确认导入
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setBomPreviewVisible(false)}>
                  关闭
                </Button>,
              ]
        }
        width={720}
      >
        <Table<TemplateItem>
          size="small"
          rowKey={(row, idx) => `${row.material_id}-${idx}`}
          pagination={false}
          dataSource={bomPreviewLines}
          columns={[
            { title: '组件编码', dataIndex: 'material_code', width: 120 },
            { title: '组件名称', dataIndex: 'material_name' },
            {
              title: '单位用量',
              dataIndex: 'quantity_per_base',
              width: 100,
              align: 'right',
              render: (v) => Number(v || 0).toFixed(4),
            },
          ]}
        />
      </Modal>
    </ListPageTemplate>
  );
};
