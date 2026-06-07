/**
 * 客户/供应商价格本（共用列表页）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Switch,
  Tag,
  Typography,
  Row,
  Col,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, flushDrawerOpen } from '../../../../../components/layout-templates';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { PartnerPriceVariantPricesEditor } from '../../../components/PartnerPriceVariantPricesEditor';
import { PartnerPriceVariantPricesTable } from '../../../components/PartnerPriceVariantPricesTable';
import { createPartnerPriceBookApi } from '../../../services/partner-price-book';
import { materialApi } from '../../../services/material';
import { customerApi, supplierApi, unwrapSupplyPagedList } from '../../../services/supply-chain';
import type {
  PartnerPriceBook,
  PartnerPriceBookCreate,
  PartnerPriceBookType,
  PartnerPriceVariantLine,
} from '../../../types/partner-price-book';

function normalizeVariantPricesForSubmit(rows: unknown): PartnerPriceVariantLine[] | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const result: PartnerPriceVariantLine[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const attrsRaw = (row as { variantAttributes?: Record<string, unknown> }).variantAttributes ?? {};
    const variantAttributes = Object.fromEntries(
      Object.entries(attrsRaw).filter(
        ([, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0),
      ),
    );
    const unitPrice = Number((row as { unitPrice?: number }).unitPrice);
    if (Object.keys(variantAttributes).length === 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      continue;
    }
    result.push({ variantAttributes, unitPrice });
  }
  return result.length > 0 ? result : undefined;
}

export interface PartnerPriceBooksPageProps {
  partnerType: PartnerPriceBookType;
}

const PartnerPriceBooksPage: React.FC<PartnerPriceBooksPageProps> = ({ partnerType }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const priceBookApi = useMemo(() => createPartnerPriceBookApi(partnerType), [partnerType]);
  const isCustomer = partnerType === 'customer';

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<PartnerPriceBook | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [aliasPreview, setAliasPreview] = useState<{ code?: string; name?: string }>({});
  const [aliasLocked, setAliasLocked] = useState(false);
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const detailReqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = isCustomer
          ? await customerApi.list({ limit: 1000, isActive: true })
          : await supplierApi.list({ limit: 1000, isActive: true });
        if (cancelled) return;
        setPartnerOptions(
          unwrapSupplyPagedList(res).map((p: any) => ({
            label: `${p.code} - ${p.name}`,
            value: p.id,
          })),
        );
      } catch {
        if (!cancelled) setPartnerOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCustomer]);

  const pageTitle = isCustomer
    ? t('app.master-data.menu.supply-chain.customer-price-books', '客户价格本')
    : t('app.master-data.menu.supply-chain.supplier-price-books', '供应商价格本');

  const handleCreate = () => {
    setEditUuid(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, syncPartnerAlias: true, variantPrices: [], _masterMaterialUuid: undefined });
    setAliasPreview({});
    setAliasLocked(false);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: PartnerPriceBook) => {
    setEditUuid(record.uuid);
    form.setFieldsValue({
      partnerId: record.partnerId,
      materialId: record.materialId,
      unitPrice: record.unitPrice != null ? Number(record.unitPrice) : undefined,
      variantPrices: (record.variantPrices ?? []).map((line) => ({
        unitPrice: Number(line.unitPrice),
        variantAttributes: { ...line.variantAttributes },
        _rowMode: 'sku' as const,
      })),
      taxRate: record.taxRate != null ? Number(record.taxRate) : undefined,
      unit: record.unit,
      currencyCode: record.currencyCode,
      effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : undefined,
      effectiveTo: record.effectiveTo ? dayjs(record.effectiveTo) : undefined,
      remark: record.remark,
      isActive: record.isActive,
    });
    setAliasPreview({
      code: record.partnerMaterialCode,
      name: record.partnerMaterialName,
    });
    setAliasLocked(Boolean(record.partnerMaterialCode));
    form.setFieldsValue({
      partnerMaterialCode: record.partnerMaterialCode,
      partnerMaterialName: record.partnerMaterialName,
      syncPartnerAlias: !record.partnerMaterialCode,
    });
    if (record.materialCode) {
      try {
        const mRes = await materialApi.list({ code: record.materialCode, mastersOnly: true, limit: 1 });
        const master = mRes.items?.[0];
        if (master?.uuid) {
          form.setFieldValue('_masterMaterialUuid', master.uuid);
        }
      } catch {
        /* 编辑时无法解析主物料 UUID 时仍可手工维护单价行 */
      }
    }
    setModalVisible(true);
  };

  const refreshAliasPreview = async (partnerId?: number, materialId?: number) => {
    if (!partnerId || !materialId) {
      setAliasPreview({});
      setAliasLocked(false);
      form.setFieldsValue({ partnerMaterialCode: undefined, partnerMaterialName: undefined, syncPartnerAlias: true });
      return;
    }
    try {
      const res = await priceBookApi.resolve({ partnerId, materialId });
      const hasCode = Boolean(res.partnerMaterialCode);
      setAliasPreview({
        code: res.partnerMaterialCode,
        name: res.partnerMaterialName,
      });
      setAliasLocked(hasCode);
      form.setFieldsValue({
        partnerMaterialCode: res.partnerMaterialCode,
        partnerMaterialName: res.partnerMaterialName,
        syncPartnerAlias: !hasCode,
      });
    } catch {
      setAliasPreview({});
      setAliasLocked(false);
      form.setFieldsValue({ partnerMaterialCode: undefined, partnerMaterialName: undefined, syncPartnerAlias: true });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const variantPrices = normalizeVariantPricesForSubmit(values.variantPrices);
      if ((!values.unitPrice || values.unitPrice <= 0) && !variantPrices?.length) {
        messageApi.warning(t('app.master-data.priceBook.priceRequired'));
        return;
      }
      const payload: PartnerPriceBookCreate = {
        partnerId: values.partnerId,
        materialId: values.materialId,
        unitPrice: values.unitPrice > 0 ? values.unitPrice : undefined,
        variantPrices,
        taxRate: values.taxRate,
        unit: values.unit,
        currencyCode: values.currencyCode,
        effectiveFrom: values.effectiveFrom ? dayjs(values.effectiveFrom).format('YYYY-MM-DD') : undefined,
        effectiveTo: values.effectiveTo ? dayjs(values.effectiveTo).format('YYYY-MM-DD') : undefined,
        remark: values.remark,
        isActive: values.isActive ?? true,
      };
      if (!aliasLocked) {
        payload.partnerMaterialCode = values.partnerMaterialCode?.trim() || undefined;
        payload.partnerMaterialName = values.partnerMaterialName?.trim() || undefined;
        payload.syncPartnerAlias = values.syncPartnerAlias ?? true;
      }
      if (editUuid) {
        await priceBookApi.update(editUuid, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await priceBookApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || t('common.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: PartnerPriceBook) => {
    try {
      await priceBookApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.deleteFailed'));
    }
  };

  const openDetail = async (record: PartnerPriceBook) => {
    const reqId = ++detailReqRef.current;
    setDrawerVisible(true);
    setDetailLoading(true);
    setDetail(null);
    flushDrawerOpen();
    try {
      const data = await priceBookApi.get(record.uuid);
      if (reqId === detailReqRef.current) setDetail(data);
    } catch (error: any) {
      messageApi.error(error?.message || t('common.loadFailed'));
      if (reqId === detailReqRef.current) setDrawerVisible(false);
    } finally {
      if (reqId === detailReqRef.current) setDetailLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<PartnerPriceBook>[] = useMemo(
    () => [
      {
        title: isCustomer ? t('field.customer.code', '客户') : t('field.supplier.code', '供应商'),
        render: () => (detail ? `${detail.partnerCode ?? ''} - ${detail.partnerName ?? ''}`.trim() || '—' : '—'),
      },
      {
        title: t('app.master-data.materialForm.mainCode', '物料'),
        render: () => (detail ? `${detail.materialCode ?? ''} - ${detail.materialName ?? ''}`.trim() || '—' : '—'),
      },
      { title: t('app.master-data.codeMapping.customerCode', '伙伴料号'), dataIndex: 'partnerMaterialCode' },
      { title: t('app.master-data.codeMapping.name', '伙伴品名'), dataIndex: 'partnerMaterialName' },
      { title: t('app.master-data.priceBook.standardUnitPrice', '标准价'), dataIndex: 'unitPrice' },
      { title: t('app.master-data.defaults.defaultTaxRate', '税率'), dataIndex: 'taxRate' },
      { title: t('app.master-data.materialForm.baseUnit', '单位'), dataIndex: 'unit' },
      { title: t('app.master-data.priceBook.effectiveFrom', '生效起始'), dataIndex: 'effectiveFrom' },
      { title: t('app.master-data.priceBook.effectiveTo', '生效截止'), dataIndex: 'effectiveTo' },
      { title: t('app.master-data.materialForm.description', '备注'), dataIndex: 'remark' },
      {
        title: t('field.defectType.isActive', '状态'),
        dataIndex: 'isActive',
        render: (_, r) => (
          <Tag color={r?.isActive ? 'success' : 'default'}>
            {r?.isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
          </Tag>
        ),
      },
    ],
    [detail, isCustomer, t],
  );

  const columns: ProColumns<PartnerPriceBook>[] = useMemo(
    () => [
      {
        title: isCustomer ? t('field.customer.code', '客户') : t('field.supplier.code', '供应商'),
        dataIndex: 'partnerName',
        width: 160,
        ellipsis: true,
        render: (_, r) => `${r.partnerCode ?? ''} ${r.partnerName ?? ''}`.trim() || '—',
      },
      {
        title: t('app.master-data.materialForm.mainCode', '内部物料'),
        dataIndex: 'materialName',
        width: 180,
        ellipsis: true,
        render: (_, r) => `${r.materialCode ?? ''} ${r.materialName ?? ''}`.trim() || '—',
      },
      {
        title: t('app.master-data.codeMapping.customerCode', '伙伴料号'),
        dataIndex: 'partnerMaterialCode',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('app.master-data.codeMapping.name', '伙伴品名'),
        dataIndex: 'partnerMaterialName',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('app.master-data.priceBook.standardUnitPrice', '标准价'),
        dataIndex: 'unitPrice',
        width: 100,
        align: 'right',
        search: false,
        render: (_, r) => (r.unitPrice != null ? Number(r.unitPrice).toFixed(4) : '—'),
      },
      {
        title: t('app.master-data.priceBook.variantPricesSection', 'SKU 价'),
        dataIndex: 'variantPrices',
        width: 90,
        search: false,
        render: (_, r) =>
          r.variantPrices?.length ? (
            <Tag color="purple">
              {t('app.master-data.priceBook.variantPriceCount', { count: r.variantPrices.length })}
            </Tag>
          ) : (
            '—'
          ),
      },
      {
        title: t('app.master-data.priceBook.effectiveFrom', '生效起始'),
        dataIndex: 'effectiveFrom',
        width: 110,
        search: false,
      },
      {
        title: t('app.master-data.priceBook.effectiveTo', '生效截止'),
        dataIndex: 'effectiveTo',
        width: 110,
        search: false,
      },
      {
        title: t('field.defectType.isActive', '状态'),
        dataIndex: 'isActive',
        width: 80,
        search: false,
        render: (_, r) => (
          <Tag color={r.isActive ? 'success' : 'default'}>
            {r.isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
          </Tag>
        ),
      },
      {
        title: t('common.actions', '操作'),
        valueType: 'option',
        width: 140,
        fixed: 'right',
        render: (_, record) => [
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>,
          <Popconfirm key="delete" title={t('common.confirmDelete')} onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [handleDelete, handleEdit, isCustomer, t],
  );

  const createButtonLabel = isCustomer
    ? t('app.master-data.priceBook.createCustomer', '新建客户价格本')
    : t('app.master-data.priceBook.createSupplier', '新建供应商价格本');

  return (
    <>
      <ListPageTemplate>
        <UniTable<PartnerPriceBook>
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          headerTitle={pageTitle}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              {createButtonLabel + NEW_SHORTCUT_HINT}
            </Button>,
          ]}
          request={async (params) => {
            const res = await priceBookApi.list({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              keyword: params.keyword as string | undefined,
              activeOnly: params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined,
            });
            return { data: res.data ?? [], success: true, total: res.total ?? 0 };
          }}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <UniDetail
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title={pageTitle}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        loading={detailLoading}
        basic={
          detail ? (
            <Descriptions
              column={1}
              bordered
              size="small"
              items={detailDrawerDescriptionItems(detailColumns, detail)}
            />
          ) : null
        }
        lines={
          detail?.variantPrices?.length ? (
            <PartnerPriceVariantPricesTable rows={detail.variantPrices} />
          ) : null
        }
        linesTitle={t('app.master-data.priceBook.variantPricesSection', '属性 SKU 单价')}
        linesVisible={!!detail?.variantPrices?.length}
      />

      <Modal
        title={editUuid ? t('common.edit') : t('common.create')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={960}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="_masterMaterialUuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="partnerId"
            label={isCustomer ? t('app.master-data.codeMapping.customerLabel', '客户') : t('app.master-data.codeMapping.supplierLabel', '供应商')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <UniDropdown
              placeholder={isCustomer ? t('app.master-data.codeMapping.selectCustomer') : t('app.master-data.codeMapping.selectSupplier')}
              showSearch
              optionFilterProp="label"
              options={partnerOptions}
              onChange={(v) => {
                const materialId = form.getFieldValue('materialId');
                refreshAliasPreview(v as number, materialId);
              }}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={aliasLocked ? 24 : 8}>
              <UniMaterialSelect
                name="materialId"
                label={t('app.master-data.materialForm.mainCode', '内部物料')}
                placeholder={t('app.master-data.materialForm.mainCodePlaceholder', '请选择物料')}
                required
                onChange={(materialId, material) => {
                  const partnerId = form.getFieldValue('partnerId');
                  form.setFieldsValue({
                    _masterMaterialUuid: material?.uuid,
                    variantPrices: [],
                  });
                  refreshAliasPreview(partnerId, materialId);
                }}
              />
            </Col>
            {!aliasLocked && (
              <>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name="partnerMaterialCode"
                    label={
                      isCustomer
                        ? t('app.master-data.codeMapping.customerCode', '客户编号')
                        : t('app.master-data.codeMapping.supplierCode', '供应商编号')
                    }
                    rules={[
                      {
                        validator: async (_, value) => {
                          const sync = form.getFieldValue('syncPartnerAlias');
                          if (sync && !value?.trim()) {
                            throw new Error(
                              t('app.master-data.priceBook.partnerCodeRequiredWhenSync', '开启同步时请填写伙伴料号'),
                            );
                          }
                        },
                      },
                    ]}
                  >
                    <Input placeholder={t('app.master-data.codeMapping.codePlaceholder', '编号')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name="partnerMaterialName"
                    label={t('app.master-data.codeMapping.nameOptional', '名称（可选）')}
                  >
                    <Input placeholder={t('app.master-data.codeMapping.nameOptional', '名称（可选）')} />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
          {aliasLocked ? (
            <Form.Item label={t('app.master-data.materialForm.codeMapping', '编号映射')}>
              <Typography.Text type="secondary">
                {[aliasPreview.code, aliasPreview.name].filter(Boolean).join(' / ') || '—'}
              </Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('app.master-data.priceBook.aliasReadonlyHint', '已在物料主数据维护，此处只读')}
                </Typography.Text>
              </div>
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="syncPartnerAlias"
                label={t('app.master-data.priceBook.syncPartnerAlias', '同步到物料编号映射')}
                valuePropName="checked"
              >
                <Switch checkedChildren={t('common.yes', '是')} unCheckedChildren={t('common.no', '否')} />
              </Form.Item>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
                {t(
                  'app.master-data.priceBook.syncPartnerAliasHint',
                  '保存价格本时写入物料「编号映射」，仅在该客户/供应商尚无映射时生效',
                )}
              </Typography.Paragraph>
            </>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              columnGap: 16,
              width: '100%',
            }}
          >
            <Form.Item
              name="unitPrice"
              label={t('app.master-data.priceBook.standardUnitPrice', '标准价')}
              tooltip={t('app.master-data.priceBook.standardUnitPriceHint')}
            >
              <InputNumber min={0.0001} precision={4} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="taxRate" label={t('app.master-data.defaults.defaultTaxRate', '默认税率')}>
              <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label={t('app.master-data.materialForm.baseUnit', '基础单位')}>
              <Input style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ marginBottom: 24 }}>
            <PartnerPriceVariantPricesEditor />
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="effectiveFrom" label={t('app.master-data.priceBook.effectiveFrom', '生效起始')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="effectiveTo" label={t('app.master-data.priceBook.effectiveTo', '生效截止')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label={t('app.master-data.materialForm.description', '备注')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isActive" label={t('field.defectType.isActive', '启用')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PartnerPriceBooksPage;
