/**
 * 借料单管理页面
 *
 * 提供借料单的创建、查看、确认和管理功能（无工单借料：工具间、研发等）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Descriptions, Dropdown, Form as AntForm, Input, InputNumber, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined, ShoppingOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import CodeField from '../../../../../components/code-field';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getMaterialBorrowLifecycle } from '../../../utils/materialBorrowLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { useTranslation } from 'react-i18next';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { openPrintHtmlWindow, escapeHtml } from '../../../../../utils/printResponseHelpers';

interface MaterialBorrow {
  id?: number;
  tenant_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  borrower_id?: number;
  borrower_name?: string;
  department?: string;
  expected_return_date?: string;
  borrow_time?: string;
  status?: string;
  total_quantity?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialBorrowDetail extends MaterialBorrow {
  items?: MaterialBorrowItem[];
}

interface MaterialBorrowItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  borrow_quantity?: number;
  returned_quantity?: number;
  status?: string;
}

function buildMaterialBorrowPrintHtml(d: MaterialBorrowDetail): string {
  const esc = escapeHtml;
  const rows = (d.items || [])
    .map(
      (it) =>
        `<tr><td>${esc(it.material_code)}</td><td>${esc(it.material_name)}</td><td>${esc(it.material_unit)}</td><td style="text-align:right">${esc(it.borrow_quantity)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>借料单 ${esc(d.borrow_code)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f0f0f0;text-align:left}</style></head><body>
<h2>借料单</h2>
<p><strong>单号</strong> ${esc(d.borrow_code)} &nbsp; <strong>仓库</strong> ${esc(d.warehouse_name)} &nbsp; <strong>借料人</strong> ${esc(d.borrower_name)}</p>
<p><strong>预计归还</strong> ${esc(d.expected_return_date)} &nbsp; <strong>借出时间</strong> ${esc(d.borrow_time)}</p>
<p><strong>备注</strong> ${esc(d.notes)}</p>
<table><thead><tr><th>物料编码</th><th>物料名称</th><th>单位</th><th>借料数量</th></tr></thead><tbody>${rows || '<tr><td colspan="4">无明细</td></tr>'}</tbody></table>
<p style="margin-top:16px;color:#666;font-size:12px">未配置打印模板时的系统兜底</p>
</body></html>`;
}

const MaterialBorrowsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [borrowDetail, setBorrowDetail] = useState<MaterialBorrowDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const defaultBorrowItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '', borrow_quantity: 1 };

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, is_active: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<MaterialBorrow>[] = [
    {
      title: '借料单号',
      dataIndex: 'borrow_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
          {r.borrow_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: '借料人', dataIndex: 'borrower_name', width: 100 },
    { title: '部门', dataIndex: 'department', width: 100 },
    { title: '预计归还日期', dataIndex: 'expected_return_date', valueType: 'date', width: 120 },
    { title: '借出时间', dataIndex: 'borrow_time', valueType: 'dateTime', width: 160 },
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
        const lifecycle = getMaterialBorrowLifecycle(record as Record<string, unknown>);
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
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const showPrint = record.status === '待借出' || record.status === '已借出';
        const printInMore = record.status === '待借出';
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
              详情
            </Button>
            {record.status === '待借出' && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleConfirm(record)}
                  style={{ color: '#52c41a' }}
                >
                  确认借出
                </Button>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                  删除
                </Button>
              </>
            )}
            {printInMore ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'print',
                      icon: <PrinterOutlined />,
                      label: '打印',
                      onClick: () => handlePrint(record),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button type="link" size="small" icon={<MoreOutlined />}>
                  更多
                </Button>
              </Dropdown>
            ) : (
              showPrint && (
                <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>
                  打印
                </Button>
              )
            )}
          </Space>
        );
      },
    },
  ];

  const handleDetail = async (record: MaterialBorrow) => {
    try {
      const detail = await warehouseApi.materialBorrow.get(record.id!.toString());
      setBorrowDetail(detail as MaterialBorrowDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取借料单详情失败');
    }
  };

  const handleConfirm = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: '确认借出',
      content: `确定要确认借料单 "${record.borrow_code}" 吗？确认后将扣减库存。`,
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.confirm(record.id!.toString());
          messageApi.success('借出确认成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '借出确认失败');
        }
      },
    });
  };

  const handleDelete = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: '删除借料单',
      content: `确定要删除借料单 "${record.borrow_code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.delete(record.id!.toString());
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条借料单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await warehouseApi.materialBorrow.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条借料单`);
          setSelectedRowKeys([]);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          warehouse_id: row.warehouse_id ?? row.warehouseId,
          warehouse_name: row.warehouse_name || row.warehouseName,
          borrower_name: row.borrower_name || row.borrowerName,
          status: row.status || '待借出',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await warehouseApi.materialBorrow.create(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条借料单`);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handlePrint = async (record: MaterialBorrow) => {
    try {
      const result = (await warehouseApi.materialBorrow.print(record.id!.toString())) as DocumentPrintApiResult;
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        const detail = (await warehouseApi.materialBorrow.get(record.id!.toString())) as MaterialBorrowDetail;
        const w = openPrintHtmlWindow(buildMaterialBorrowPrintHtml(detail), `借料单 ${detail.borrow_code || ''}`);
        if (!w) {
          messageApi.warning(result?.message || '无法打开打印窗口，请检查浏览器拦截设置');
        }
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  const appendBorrowItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultBorrowItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setCreateModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.borrow_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      await warehouseApi.materialBorrow.create({
        borrow_code: values.borrow_code,
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        borrower_name: values.borrower_name,
        department: values.department,
        expected_return_date: values.expected_return_date ? dayjs(values.expected_return_date).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          borrow_quantity: Number(it.borrow_quantity) || 0,
          warehouse_id: values.warehouse_id,
          warehouse_name: warehouseName,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '请至少添加一条有效明细') messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<MaterialBorrowDetail>[] = [
    { title: '借料单号', dataIndex: 'borrow_code' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    { title: '借料人', dataIndex: 'borrower_name' },
    { title: '部门', dataIndex: 'department' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待借出': { text: '待借出', color: 'default' },
          '已借出': { text: '已借出', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '预计归还日期', dataIndex: 'expected_return_date', valueType: 'date' },
    { title: '借出时间', dataIndex: 'borrow_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="借料单"
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-borrows"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建借料单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await warehouseApi.materialBorrow.list({ skip: 0, limit: 10000 });
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: MaterialBorrow) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `material-borrows-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await warehouseApi.materialBorrow.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                warehouse_id: params.warehouse_id,
                keyword: (params as any).keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取借料单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`借料单详情${borrowDetail?.borrow_code ? ` - ${borrowDetail.borrow_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setBorrowDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          borrowDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, borrowDetail)} />
          ) : undefined
        }
        lines={
          borrowDetail?.items && borrowDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '借出数量', dataIndex: 'borrow_quantity', width: 100, align: 'right' },
                  { title: '已归还数量', dataIndex: 'returned_quantity', width: 100, align: 'right' },
                  { title: '状态', dataIndex: 'status', width: 80 },
                ]}
                dataSource={borrowDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title="新建借料单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-borrow"
              name="borrow_code"
              label="借料单编号"
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="仓库"
              placeholder="请选择仓库"
              required
              onChange={(val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
            />
          </Col>
        </Row>
        <AntForm.Item name="warehouse_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="borrower_name" label="借料人">
              <Input placeholder="借料人姓名" />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormItem name="department" label="部门">
              <Input placeholder="部门" />
            </ProFormItem>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="expected_return_date" label="预计归还日期">
              <DatePicker style={{ width: '100%' }} />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title="明细" required />
          <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条有效明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
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
                                  material_unit: 'baseUnit',
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
                    title: '单位',
                    dataIndex: 'material_unit',
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                        <Input placeholder="单位" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'borrow_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'borrow_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
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
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultBorrowItem)}>
                              添加明细
                            </Button>
                            <Button
                              type="default"
                              icon={<ShoppingOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </AntForm.Item>
        </div>
        <ProFormTextArea name="notes" label="备注" placeholder="可选" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步借料单"
      />

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendBorrowItemsFromMaterials}
      />
    </>
  );
};

export default MaterialBorrowsPage;
