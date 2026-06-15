/**
 * 库存调拨管理页面
 *
 * 提供库存调拨单的管理功能，包括创建调拨单、添加明细、执行调拨等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Space, Modal, message, Card, Table, Row, Col, Typography, Tag, Form as AntForm, Input, InputNumber, Select } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { inventoryTransferApi } from '../../../services/inventory-transfer';
import { getInventoryTransferLifecycle } from '../../../utils/inventoryTransferLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { materialApi } from '../../../../master-data/services/material';
import { storageAreaApi, storageLocationApi } from '../../../../master-data/services/warehouse';
import dayjs from 'dayjs';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';

interface InventoryTransfer {
  id?: number;
  uuid?: string;
  code?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  transfer_date?: string;
  status?: string;
  total_items?: number;
  total_quantity?: number;
  total_amount?: number;
  transfer_reason?: string;
  remarks?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  created_at?: string;
  updated_at?: string;
  transfer_mode?: 'transfer' | 'bin_relocation';
  items?: InventoryTransferItem[];
}

interface InventoryTransferItem {
  id?: number;
  uuid?: string;
  transfer_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  from_warehouse_id?: number;
  from_storage_area_id?: number;
  from_storage_area_code?: string;
  from_location_id?: number;
  from_location_code?: string;
  to_warehouse_id?: number;
  to_storage_area_id?: number;
  to_storage_area_code?: string;
  to_location_id?: number;
  to_location_code?: string;
  batch_no?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  status?: string;
  remarks?: string;
}

const defaultTransferItem = {
  material_id: undefined as number | undefined,
  material_code: '',
  material_name: '',
  quantity: undefined as number | undefined,
  unit_price: 0,
  from_storage_area_id: undefined as number | undefined,
  from_location_id: undefined as number | undefined,
  to_storage_area_id: undefined as number | undefined,
  to_location_id: undefined as number | undefined,
  batch_no: '',
};

const InventoryTransferPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [createTransferMode, setCreateTransferMode] = useState<'transfer' | 'bin_relocation'>('transfer');
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<InventoryTransfer | null>(null);

  // 仓库列表状态 (交由 UniWarehouseSelect 管理)
  // 物料列表状态
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [storageAreaList, setStorageAreaList] = useState<any[]>([]);
  const [storageLocationList, setStorageLocationList] = useState<any[]>([]);
  // 当前调拨单ID（用于添加明细）
  const [currentTransferId, setCurrentTransferId] = useState<number | null>(null);
  const [currentItemTransferMode, setCurrentItemTransferMode] = useState<'transfer' | 'bin_relocation'>('transfer');
  const [selectedCreateWarehouseId, setSelectedCreateWarehouseId] = useState<number | undefined>();

  const resolveAreaMeta = (areaId?: number) => {
    const area = storageAreaList.find((a: any) => a.id === areaId);
    return { id: areaId, code: area?.code as string | undefined };
  };

  const resolveLocationMeta = (locationId?: number) => {
    const loc = storageLocationList.find((l: any) => l.id === locationId);
    return { id: locationId, code: loc?.code as string | undefined };
  };

  const buildItemPayload = (
    it: Record<string, unknown>,
    header: { from_warehouse_id: number; to_warehouse_id: number },
  ) => {
    const fromArea = resolveAreaMeta(it.from_storage_area_id as number | undefined);
    const toArea = resolveAreaMeta(it.to_storage_area_id as number | undefined);
    const fromLoc = resolveLocationMeta(it.from_location_id as number | undefined);
    const toLoc = resolveLocationMeta(it.to_location_id as number | undefined);
    return {
      material_id: it.material_id,
      material_code: it.material_code || '',
      material_name: it.material_name || '',
      from_warehouse_id: header.from_warehouse_id,
      to_warehouse_id: header.to_warehouse_id,
      from_storage_area_id: fromArea.id,
      from_storage_area_code: fromArea.code,
      from_location_id: fromLoc.id,
      from_location_code: fromLoc.code,
      to_storage_area_id: toArea.id,
      to_storage_area_code: toArea.code,
      to_location_id: toLoc.id,
      to_location_code: toLoc.code,
      batch_no: it.batch_no || undefined,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      remarks: it.remarks,
    };
  };

  const validateTransferItems = (items: Record<string, unknown>[], mode: 'transfer' | 'bin_relocation') => {
    const valid = items.filter((it) => it.material_id && (Number(it.quantity) || 0) > 0);
    if (!valid.length) {
      messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
      throw new Error('no items');
    }
    if (mode === 'bin_relocation') {
      for (const it of valid) {
        if (!it.from_storage_area_id || !it.from_location_id || !it.to_storage_area_id || !it.to_location_id) {
          messageApi.error('库内移位明细须填写调出/调入库区与库位');
          throw new Error('bin_relocation areas required');
        }
        if (it.from_location_id === it.to_location_id) {
          messageApi.error('库内移位时调出库位和调入库位不能相同');
          throw new Error('same location');
        }
      }
    }
    return valid;
  };

  // 加载仓库逻辑移除

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const { items } = await materialApi.list({ isActive: true, limit: 10000 });
        setMaterialList(items);
      } catch (error) {
        console.error('加载物料列表失败:', error);
        setMaterialList([]);
      }
    };
    loadMaterials();
  }, []);

  React.useEffect(() => {
    const loadStorageMetadata = async () => {
      try {
        const [areas, locations] = await Promise.all([
          storageAreaApi.list({ limit: 10000, is_active: true }),
          storageLocationApi.list({ limit: 10000, is_active: true }),
        ]);
        setStorageAreaList(areas?.items || []);
        setStorageLocationList(locations?.items || []);
      } catch {
        setStorageAreaList([]);
        setStorageLocationList([]);
      }
    };
    loadStorageMetadata();
  }, []);

  /**
   * 处理创建调拨单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setCreateTransferMode('transfer');
    setSelectedCreateWarehouseId(undefined);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        transfer_date: dayjs(),
        transfer_mode: 'transfer',
        items: [{ ...defaultTransferItem }],
      });
    }, 0);
  };

  /**
   * 处理提交创建调拨单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      const mode = values.transfer_mode || 'transfer';
      if (mode === 'transfer' && values.from_warehouse_id === values.to_warehouse_id) {
        messageApi.error('跨仓调拨时，调出仓库和调入仓库不能相同');
        throw new Error('跨仓调拨时，调出仓库和调入仓库不能相同');
      }
      if (mode === 'bin_relocation' && values.from_warehouse_id !== values.to_warehouse_id) {
        messageApi.error('库内移位时，调出仓库和调入仓库必须相同');
        throw new Error('库内移位时，调出仓库和调入仓库必须相同');
      }

      const transferDate = dayjs(values.transfer_date);
      const validItems = validateTransferItems(values.items || [], mode);
      const header = {
        from_warehouse_id: values.from_warehouse_id,
        to_warehouse_id: values.to_warehouse_id,
      };
      const payload = {
        from_warehouse_id: values.from_warehouse_id,
        from_warehouse_name: values._from_warehouse_name || '',
        to_warehouse_id: values.to_warehouse_id,
        to_warehouse_name: values._to_warehouse_name || '',
        transfer_date: transferDate.isValid() ? transferDate.toISOString() : new Date().toISOString(),
        transfer_reason: values.transfer_reason,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
        allow_same_warehouse: mode === 'bin_relocation',
        items: validItems.map((it) => buildItemPayload(it, header)),
      };
      if (mode === 'bin_relocation') {
        await inventoryTransferApi.createBinTransfer(payload);
        messageApi.success('库内移位单创建成功');
      } else {
        await inventoryTransferApi.create(payload);
        messageApi.success('调拨单创建成功');
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (
        error.message !== '跨仓调拨时，调出仓库和调入仓库不能相同' &&
        error.message !== '库内移位时，调出仓库和调入仓库必须相同' &&
        error.message !== 'no items' &&
        error.message !== 'bin_relocation areas required' &&
        error.message !== 'same location'
      ) {
        messageApi.error(error.message || '创建调拨单失败');
      }
      throw error;
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: InventoryTransfer) => {
    try {
      const detail = await inventoryTransferApi.get(record.id!.toString());
      setCurrentTransfer(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取调拨单详情失败');
    }
  };

  /**
   * 处理执行调拨
   */
  const handleExecute = async (record: InventoryTransfer) => {
    Modal.confirm({
      title: '执行调拨',
      content: `确定要执行调拨单 "${record.code}" 吗？执行后将更新库存。`,
      onOk: async () => {
        try {
          await inventoryTransferApi.execute(record.id!.toString());
          messageApi.success('调拨执行成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '执行调拨失败');
        }
      },
    });
  };

  /**
   * 处理添加调拨明细
   */
  const handleAddItem = (record: InventoryTransfer) => {
    setCurrentTransferId(record.id!);
    setItemModalVisible(true);
    setCurrentItemTransferMode(
      record.transfer_mode || (record.from_warehouse_id === record.to_warehouse_id ? 'bin_relocation' : 'transfer')
    );
    itemFormRef.current?.resetFields();
    // 自动填充调出和调入仓库
    itemFormRef.current?.setFieldsValue({
      from_warehouse_id: record.from_warehouse_id,
      to_warehouse_id: record.to_warehouse_id,
    });
  };

  /**
   * 处理提交添加调拨明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentTransferId) {
        messageApi.error('调拨单ID不存在');
        return;
      }

      const material = materialList.find((m: any) => m.id === values.material_id);
      if (!material) {
        messageApi.error('物料不存在');
        return;
      }

      if (currentItemTransferMode === 'bin_relocation') {
        if (!values.from_storage_area_id || !values.from_location_id || !values.to_storage_area_id || !values.to_location_id) {
          messageApi.error('库内移位必须选择调出/调入库区与库位');
          return;
        }
        if (values.from_location_id === values.to_location_id) {
          messageApi.error('库内移位时调出库位和调入库位不能相同');
          return;
        }
      }

      const fromArea = resolveAreaMeta(values.from_storage_area_id);
      const toArea = resolveAreaMeta(values.to_storage_area_id);
      const fromLocation = resolveLocationMeta(values.from_location_id);
      const toLocation = resolveLocationMeta(values.to_location_id);

      await inventoryTransferApi.createItem(currentTransferId.toString(), {
        transfer_id: currentTransferId,
        material_id: values.material_id,
        material_code: material.mainCode ?? material.code ?? '',
        material_name: material.name,
        from_warehouse_id: values.from_warehouse_id,
        from_storage_area_id: fromArea.id,
        from_storage_area_code: fromArea.code,
        from_location_id: fromLocation.id,
        from_location_code: fromLocation.code,
        to_warehouse_id: values.to_warehouse_id,
        to_storage_area_id: toArea.id,
        to_storage_area_code: toArea.code,
        to_location_id: toLocation.id,
        to_location_code: toLocation.code,
        batch_no: values.batch_no,
        quantity: values.quantity,
        unit_price: values.unit_price || 0,
        remarks: values.remarks,
      });
      messageApi.success('调拨明细添加成功');
      setItemModalVisible(false);
      setCurrentTransferId(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '添加调拨明细失败');
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InventoryTransfer>[] = [
    {
      title: '调拨单号',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '单据模式',
      dataIndex: 'transfer_mode',
      width: 110,
      valueEnum: {
        transfer: { text: '跨仓调拨', status: 'processing' },
        bin_relocation: { text: '库内移位', status: 'warning' },
      },
      render: (_, record) => (
        <Tag color={record.transfer_mode === 'bin_relocation' ? 'gold' : 'blue'}>
          {record.transfer_mode === 'bin_relocation' ? '库内移位' : '跨仓调拨'}
        </Tag>
      ),
    },
    {
      title: '调出仓库',
      dataIndex: 'from_warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '调入仓库',
      dataIndex: 'to_warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '调拨日期',
      dataIndex: 'transfer_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '调拨物料总数',
      dataIndex: 'total_items',
      width: 120,
      align: 'right',
    },
    {
      title: '调拨总数量',
      dataIndex: 'total_quantity',
      width: 120,
      align: 'right',
    },
    {
      title: '调拨总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (_, record) => `¥${record.total_amount?.toFixed(2) || '0.00'}`,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInventoryTransferLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'draft' && (
            <>
              <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
                添加明细
              </Button>
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={() => handleExecute(record)}
              >
                执行调拨
              </Button>
            </>
          )}
          {record.status === 'in_progress' && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              添加明细
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const getAreaOptions = (warehouseId?: number) =>
    storageAreaList
      .filter((a: any) => !warehouseId || a.warehouseId === warehouseId)
      .map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id }));

  const getLocationOptions = (storageAreaId?: number) =>
    storageLocationList
      .filter((l: any) => !storageAreaId || l.storageAreaId === storageAreaId)
      .map((l: any) => ({ label: `${l.code} - ${l.name}`, value: l.id }));

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="库存调拨管理"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory-transfer"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        showCreateButton={true}
        createButtonText="新建调拨单"
        onCreate={handleCreate}
        request={async (params, _sort, _filter, searchFormValues) => {
          try {
            const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
            const result = await inventoryTransferApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              code: params.code,
              from_warehouse_id: params.from_warehouse_id,
              to_warehouse_id: params.to_warehouse_id,
              status: lifecycleStage ?? params.status,
              transfer_mode: (params as any).transfer_mode,
              keyword: (params as any).keyword,
            });
            return {
              data: result.items || [],
              success: true,
              total: result.total || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await inventoryTransferApi.delete(String(id));
            }
            messageApi.success(`成功删除 ${keys.length} 条记录`);
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || '删除失败');
          }
        }}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条调拨单吗？`}
        scroll={{ x: 2000 }}
      />

      {/* 创建调拨单Modal */}
      <FormModalTemplate
        title="创建调拨单"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        grid={false}
        width={createTransferMode === 'bin_relocation' ? MODAL_CONFIG.EXTRA_LARGE_WIDTH : MODAL_CONFIG.LARGE_WIDTH}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="transfer_mode"
          label="单据模式"
          initialValue="transfer"
          rules={[{ required: true, message: '请选择单据模式' }]}
          options={[
            { label: '跨仓调拨', value: 'transfer' },
            { label: '库内移位（同仓）', value: 'bin_relocation' },
          ]}
          fieldProps={{
            onChange: (v: 'transfer' | 'bin_relocation') => {
              setCreateTransferMode(v);
              if (v === 'bin_relocation') {
                const fromId = formRef.current?.getFieldValue?.('from_warehouse_id');
                const fromName = formRef.current?.getFieldValue?.('_from_warehouse_name');
                if (fromId) {
                  formRef.current?.setFieldsValue({
                    to_warehouse_id: fromId,
                    _to_warehouse_name: fromName || '',
                  });
                }
              }
            },
          }}
        />
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="from_warehouse_id"
              label="调出仓库"
              placeholder="请选择调出仓库"
              required
              onChange={(value, option) => {
                formRef.current?.setFieldsValue({ _from_warehouse_name: option?.name });
                setSelectedCreateWarehouseId(typeof value === 'number' ? value : Number(value));
                if (createTransferMode === 'bin_relocation') {
                  formRef.current?.setFieldsValue({
                    to_warehouse_id: value,
                    _to_warehouse_name: option?.name,
                  });
                }
              }}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="to_warehouse_id"
              label={createTransferMode === 'bin_relocation' ? '所在仓库（同仓）' : '调入仓库'}
              placeholder={createTransferMode === 'bin_relocation' ? '与调出仓库相同' : '请选择调入仓库'}
              required
              disabled={createTransferMode === 'bin_relocation'}
              onChange={(_, option) => formRef.current?.setFieldsValue({ _to_warehouse_name: option?.name })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="transfer_date"
              label="调拨日期"
              rules={[{ required: true, message: '请选择调拨日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12} />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title="调拨明细" required />
          <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条有效明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const baseCols = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 240,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => {
                          const row = (getFieldValue('items') as Record<string, unknown>[] | undefined)?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder="请选择物料"
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item
                        name={[index, 'quantity']}
                        rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                ];
                const binCols = createTransferMode === 'bin_relocation'
                  ? [
                      {
                        title: '调出库区',
                        dataIndex: 'from_storage_area_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item
                            name={[index, 'from_storage_area_id']}
                            rules={[{ required: true, message: '必选' }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              options={getAreaOptions(selectedCreateWarehouseId)}
                              placeholder="调出库区"
                              size="small"
                              showSearch
                              optionFilterProp="label"
                              onChange={() => {
                                const items = formRef.current?.getFieldValue('items') || [];
                                items[index] = { ...items[index], from_location_id: undefined };
                                formRef.current?.setFieldsValue({ items });
                              }}
                            />
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: '调出库位',
                        dataIndex: 'from_location_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item noStyle shouldUpdate>
                            {({ getFieldValue }: { getFieldValue: (name: (string | number)[]) => unknown }) => (
                              <AntForm.Item
                                name={[index, 'from_location_id']}
                                rules={[{ required: true, message: '必选' }]}
                                style={{ margin: 0 }}
                              >
                                <Select
                                  options={getLocationOptions(getFieldValue(['items', index, 'from_storage_area_id']) as number | undefined)}
                                  placeholder="调出库位"
                                  size="small"
                                  showSearch
                                  optionFilterProp="label"
                                />
                              </AntForm.Item>
                            )}
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: '调入库区',
                        dataIndex: 'to_storage_area_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item
                            name={[index, 'to_storage_area_id']}
                            rules={[{ required: true, message: '必选' }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              options={getAreaOptions(selectedCreateWarehouseId)}
                              placeholder="调入库区"
                              size="small"
                              showSearch
                              optionFilterProp="label"
                              onChange={() => {
                                const items = formRef.current?.getFieldValue('items') || [];
                                items[index] = { ...items[index], to_location_id: undefined };
                                formRef.current?.setFieldsValue({ items });
                              }}
                            />
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: '调入库位',
                        dataIndex: 'to_location_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item noStyle shouldUpdate>
                            {({ getFieldValue }: { getFieldValue: (name: (string | number)[]) => unknown }) => (
                              <AntForm.Item
                                name={[index, 'to_location_id']}
                                rules={[{ required: true, message: '必选' }]}
                                style={{ margin: 0 }}
                              >
                                <Select
                                  options={getLocationOptions(getFieldValue(['items', index, 'to_storage_area_id']) as number | undefined)}
                                  placeholder="调入库位"
                                  size="small"
                                  showSearch
                                  optionFilterProp="label"
                                />
                              </AntForm.Item>
                            )}
                          </AntForm.Item>
                        ),
                      },
                    ]
                  : [];
                const tailCols = [
                  {
                    title: '批次号',
                    dataIndex: 'batch_no',
                    width: 120,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item name={[index, 'batch_no']} style={{ margin: 0 }}>
                        <Input placeholder="可选" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 60,
                    render: (_: unknown, __: unknown, index: number) => (
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                      />
                    ),
                  },
                ];
                const cols = [...baseCols, ...binCols, ...tailCols];
                const totalWidth = cols.reduce((s, c) => s + ((c.width as number) || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            block
                            onClick={() => add({ ...defaultTransferItem })}
                          >
                            添加明细
                          </Button>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </AntForm.Item>
        </div>
        <ProFormTextArea
          name="transfer_reason"
          label="调拨原因"
          placeholder="请输入调拨原因"
          fieldProps={{ rows: 3 }}
        />
        <DocumentAttachmentsField category="inventory_transfer_attachments" />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加调拨明细Modal */}
      <FormModalTemplate
        title="添加调拨明细"
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentTransferId(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={handleAddItemSubmit}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materialList.map((m: any) => ({
            label: `${m.mainCode ?? m.code ?? ''} - ${m.name}`,
            value: m.id,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="quantity"
          label="调拨数量"
          placeholder="请输入调拨数量"
          rules={[{ required: true, message: '请输入调拨数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unit_price"
          label="单价"
          placeholder="请输入单价"
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <Row gutter={16}>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate>
              {() => (
                <ProFormSelect
                  name="from_storage_area_id"
                  label="调出库区"
                  placeholder="请选择调出库区"
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: '库内移位必须选择调出库区' }]
                      : undefined
                  }
                  options={getAreaOptions(itemFormRef.current?.getFieldValue?.('from_warehouse_id'))}
                  fieldProps={{
                    showSearch: true,
                    onChange: () => {
                      itemFormRef.current?.setFieldsValue({ from_location_id: undefined });
                    },
                  }}
                />
              )}
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev.from_storage_area_id !== curr.from_storage_area_id}>
              {() => (
                <ProFormSelect
                  name="from_location_id"
                  label="调出库位"
                  placeholder="请选择调出库位"
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: '库内移位必须选择调出库位' }]
                      : undefined
                  }
                  options={getLocationOptions(itemFormRef.current?.getFieldValue?.('from_storage_area_id'))}
                  fieldProps={{ showSearch: true }}
                />
              )}
            </AntForm.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate>
              {() => (
                <ProFormSelect
                  name="to_storage_area_id"
                  label="调入库区"
                  placeholder="请选择调入库区"
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: '库内移位必须选择调入库区' }]
                      : undefined
                  }
                  options={getAreaOptions(itemFormRef.current?.getFieldValue?.('to_warehouse_id'))}
                  fieldProps={{
                    showSearch: true,
                    onChange: () => {
                      itemFormRef.current?.setFieldsValue({ to_location_id: undefined });
                    },
                  }}
                />
              )}
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev.to_storage_area_id !== curr.to_storage_area_id}>
              {() => (
                <ProFormSelect
                  name="to_location_id"
                  label="调入库位"
                  placeholder="请选择调入库位"
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: '库内移位必须选择调入库位' }]
                      : undefined
                  }
                  options={getLocationOptions(itemFormRef.current?.getFieldValue?.('to_storage_area_id'))}
                  fieldProps={{ showSearch: true }}
                />
              )}
            </AntForm.Item>
          </Col>
        </Row>
        <ProFormText name="from_location_code" hidden />
        <ProFormText name="to_location_code" hidden />
        <ProFormText
          name="batch_no"
          label="批次号（可选）"
          placeholder="请输入批次号"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="调拨单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTransfer(null);
        }}
        dataSource={currentTransfer || {}}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[
          {
            title: '调拨单号',
            dataIndex: 'code',
          },
          {
            title: '调出仓库',
            dataIndex: 'from_warehouse_name',
          },
          {
            title: '调入仓库',
            dataIndex: 'to_warehouse_name',
          },
          {
            title: '调拨日期',
            dataIndex: 'transfer_date',
            valueType: 'date',
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              draft: { text: '草稿', status: 'default' },
              in_progress: { text: '调拨中', status: 'processing' },
              completed: { text: '已完成', status: 'success' },
              cancelled: { text: '已取消', status: 'error' },
            },
          },
          {
            title: '调拨物料总数',
            dataIndex: 'total_items',
          },
          {
            title: '调拨总数量',
            dataIndex: 'total_quantity',
          },
          {
            title: '调拨总金额',
            dataIndex: 'total_amount',
            render: (dom: React.ReactNode, entity: InventoryTransfer) => `¥${entity.total_amount?.toFixed(2) || '0.00'}`,
          },
          {
            title: '调拨原因',
            dataIndex: 'transfer_reason',
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
      >
        {currentTransfer && currentTransfer.items && currentTransfer.items.length > 0 && (
          <Card title="调拨明细" style={{ marginTop: 16 }}>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <Table
              className="warehouse-detail-table"
              columns={[
                {
                  title: '物料编号',
                  dataIndex: 'material_code',
                  width: 120,
                },
                {
                  title: '物料名称',
                  dataIndex: 'material_name',
                  width: 150,
                },
                {
                  title: '调拨数量',
                  dataIndex: 'quantity',
                  width: 100,
                  align: 'right',
                },
                {
                  title: '调出库区/库位',
                  width: 160,
                  render: (_: unknown, row: InventoryTransferItem) =>
                    [row.from_storage_area_code, row.from_location_code].filter(Boolean).join(' / ') || '-',
                },
                {
                  title: '调入库区/库位',
                  width: 160,
                  render: (_: unknown, row: InventoryTransferItem) =>
                    [row.to_storage_area_code, row.to_location_code].filter(Boolean).join(' / ') || '-',
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right',
                  render: (value: number) => `¥${value?.toFixed(2) || '0.00'}`,
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  width: 100,
                  align: 'right',
                  render: (value: number) => `¥${value?.toFixed(2) || '0.00'}`,
                },
                {
                  title: '批次号',
                  dataIndex: 'batch_no',
                  width: 100,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (status: string) => {
                    const statusMap: Record<string, { text: string; color: string }> = {
                      pending: { text: '待调拨', color: 'default' },
                      transferred: { text: '已调拨', color: 'success' },
                    };
                    const statusInfo = statusMap[status] || { text: status, color: 'default' };
                    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                  },
                },
              ]}
              dataSource={currentTransfer.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        )}
      </DetailDrawerTemplate>
    </ListPageTemplate>
  );
};

export default InventoryTransferPage;
