/**
 * 供应商管理页面
 * 
 * 提供供应商的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  DetailDrawerSection,
  DRAWER_CONFIG,
  flushDrawerOpen,
  ListPageTemplate,
} from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';

import { supplierApi, getUserOptions, getDictionaryOptions } from '../../../services/supply-chain';
import { getDictionaryLabelMapSync } from '../../../../../services/dataDictionaryCache';
import { extractProTableSort, mapSupplyChainSortField } from '../../../../../utils/tableQueryKey';
import { SupplierFormModal } from '../../../components/SupplierFormModal';
import type { Supplier, SupplierCreate } from '../../../types/supply-chain';
import {
  partnerEnterpriseTypeLabel,
  partnerInvoiceTypeLabel,
  partnerPayableRecognitionOverrideLabel,
  partnerSettlementMethodLabel,
  partnerTaxpayerTypeLabel,
} from '../../../utils/partner-static-labels';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

/**
 * 供应商管理列表页面组件
 */
const SuppliersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑供应商）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const DICT_CODES = useMemo(
    () => ['INDUSTRY_SECTOR', 'PARTNER_SOURCE_CHANNEL', 'CUSTOMER_CATEGORY', 'CONTACT_TITLE'],
    [],
  );
  const [dictLabelMaps, setDictLabelMaps] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    DICT_CODES.forEach((c) => {
      const m = getDictionaryLabelMapSync(c);
      if (m) seed[c] = m;
    });
    return seed;
  });
  const supplierDetailReqRef = useRef(0);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Supplier>({ tableName: 'master_data_suppliers' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: supplierApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const supplierImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.supplier.code' },
          { field: 'name', required: true, labelKey: 'field.supplier.name' },
          { field: 'shortName', labelKey: 'field.supplier.shortName' },
          { field: 'contactPerson', labelKey: 'field.supplier.contactPerson' },
          { field: 'phone', labelKey: 'field.supplier.phone' },
          { field: 'email', labelKey: 'field.supplier.email' },
          { field: 'address', labelKey: 'field.supplier.address' },
          { field: 'category', labelKey: 'field.supplier.category' },
        ],
        [
          t('app.master-data.suppliers.importExample.code'),
          t('app.master-data.suppliers.importExample.name'),
          t('app.master-data.suppliers.importExample.shortName'),
          t('app.master-data.suppliers.importExample.contactPerson'),
          t('app.master-data.suppliers.importExample.phone'),
          t('app.master-data.suppliers.importExample.email'),
          t('app.master-data.suppliers.importExample.address'),
          t('app.master-data.suppliers.importExample.category'),
        ],
      ),
    [t, i18n.language],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const packs = await Promise.all(DICT_CODES.map((c) => getDictionaryOptions(c)));
        if (cancelled) return;
        const maps: Record<string, Record<string, string>> = {};
        DICT_CODES.forEach((code, index) => {
          maps[code] = Object.fromEntries(packs[index].map((o) => [o.value, o.label]));
        });
        setDictLabelMaps(maps);
      } catch {
        if (!cancelled) setDictLabelMaps({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [DICT_CODES]);

  const dictLabel = (dictCode: string, value?: string) => {
    if (value == null || value === '') return '—';
    return dictLabelMaps[dictCode]?.[value] ?? '—';
  };

  /**
   * 处理新建供应商
   */
  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  /**
   * 处理编辑供应商
   */
  const handleEdit = (record: Supplier) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除供应商
   */
  const handleDelete = async (record: Supplier) => {
    try {
      await supplierApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除供应商
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of targetKeys) {
        try {
          await supplierApi.delete(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('common.deleteFailed'));
        }
      }

      if (successCount > 0) {
        messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      }
      if (failCount > 0) {
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length > 0 ? '：' + errors.join('; ') : '',
          }),
        );
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Supplier) => {
    const req = ++supplierDetailReqRef.current;
    flushDrawerOpen(() => {
      setSupplierDetail(record);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await supplierApi.get(record.uuid);
      if (supplierDetailReqRef.current !== req) return;
      setSupplierDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error: any) {
      if (supplierDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.suppliers.getDetailFailed'));
      }
    } finally {
      if (supplierDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setSupplierDetail(null);
    resetDetailFieldValues();
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理批量导入供应商（batchImport + supplierApi.create 循环）
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);

    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      return row.some((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      supplierImportTemplate.importHeaderMap,
    );

    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.supplier.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.supplier.name'), headers: headers.join(', ') }));
      return;
    }

    const importData: SupplierCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });
      if (isEmptyRow) return;

      let actualRowIndex = rowIndex + 3;
      for (let i = 2; i < data.length; i++) {
        if (data[i] === row) {
          actualRowIndex = i + 1;
          break;
        }
      }

      try {
        const codeIndex = headerIndexMap['code'];
        const nameIndex = headerIndexMap['name'];
        const shortNameIndex = headerIndexMap['shortName'];
        const contactPersonIndex = headerIndexMap['contactPerson'];
        const phoneIndex = headerIndexMap['phone'];
        const emailIndex = headerIndexMap['email'];
        const addressIndex = headerIndexMap['address'];
        const categoryIndex = headerIndexMap['category'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const codeValue = row[codeIndex] !== null && row[codeIndex] !== undefined ? String(row[codeIndex]).trim() : '';
        const nameValue = row[nameIndex] !== null && row[nameIndex] !== undefined ? String(row[nameIndex]).trim() : '';

        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.suppliers.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.suppliers.nameRequired') });
          return;
        }

        const supplierData: SupplierCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          shortName: shortNameIndex !== undefined && row[shortNameIndex] ? String(row[shortNameIndex]).trim() : undefined,
          contactPerson: contactPersonIndex !== undefined && row[contactPersonIndex] ? String(row[contactPersonIndex]).trim() : undefined,
          phone: phoneIndex !== undefined && row[phoneIndex] ? String(row[phoneIndex]).trim() : undefined,
          email: emailIndex !== undefined && row[emailIndex] ? String(row[emailIndex]).trim() : undefined,
          address: addressIndex !== undefined && row[addressIndex] ? String(row[addressIndex]).trim() : undefined,
          category: categoryIndex !== undefined && row[categoryIndex] ? String(row[categoryIndex]).trim() : undefined,
          isActive: true,
        };
        importData.push(supplierData);
      } catch (error: any) {
        errors.push({ row: actualRowIndex, message: error.message || t('app.master-data.dataParseFailed') });
      }
    });

    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: item.row, message: item.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    try {
      const result = await batchImport({
        items: importData,
        importFn: async (item: SupplierCreate) => supplierApi.create(item),
        title: t('app.master-data.suppliers.importTitle'),
        concurrency: 5,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.rowError', { row: item.row, message: item.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.suppliers.importSuccess', { count: result.successCount }));
      }

      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 处理批量导出供应商
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Supplier[]
  ) => {
    try {
      let exportData: Supplier[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.suppliers.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.suppliers.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        const exportRes = await supplierApi.list({ skip: 0, limit: 10000 });
        exportData = Array.isArray(exportRes) ? exportRes : exportRes?.data ?? [];
        filename = `${t('app.master-data.suppliers.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      const headers = [
        t('field.supplier.code'),
        t('field.supplier.name'),
        t('field.supplier.shortName'),
        t('field.supplier.category'),
        t('field.supplier.contactPerson'),
        t('field.supplier.contactTitle'),
        t('field.supplier.phone'),
        t('field.supplier.email'),
        t('field.supplier.address'),
        t('field.supplier.buyer'),
        t('app.master-data.warehouses.status'),
        t('common.createdAt'),
      ];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.shortName || '',
          item.category
            ? dictLabelMaps['CUSTOMER_CATEGORY']?.[item.category] ?? item.category
            : '',
          item.contactPerson || '',
          item.contactTitle
            ? dictLabelMaps['CONTACT_TITLE']?.[item.contactTitle] ?? item.contactTitle
            : '',
          item.phone || '',
          item.email || '',
          item.address || '',
          item.buyerName || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
        ];
        csvRows.push(row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadFile(blob, filename);
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Supplier>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('field.supplier.code'),
      dataIndex: 'code',
      copyable: true,
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.supplier.name'),
      dataIndex: 'name',
      width: 250,
      sorter: true,
    },
    {
      title: t('field.supplier.shortName'),
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.category'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    {
      title: t('field.supplier.contactPerson'),
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.contactTitle'),
      dataIndex: 'contactTitle',
      width: 120,
      hideInSearch: true,
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    {
      title: t('field.supplier.phone'),
      dataIndex: 'phone',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.email'),
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.address'),
      dataIndex: 'address',
      width: 220,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('field.supplier.buyer'),
      dataIndex: 'buyerName',
      width: 120,
      valueType: 'select',
      request: getUserOptions,
      sorter: true,
      fieldProps: {
        name: 'buyerId',
      },
    },
    {
      title: t('field.supplier.payableRecognitionOverride'),
      dataIndex: 'payableRecognitionOverride',
      width: 160,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => partnerPayableRecognitionOverrideLabel(t, r.payableRecognitionOverride),
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
      sorter: true,
    },
    ...customFieldColumns,
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.warehouses.action'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('field.customField.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.suppliers.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [customFields, t, dictLabel]);

  /** 详情列：与表单 Tab「基本信息 / 开票资料 / 业务与扩展」一致 */
  const detailColumnsBasic: ProDescriptionsItemProps<Supplier>[] = [
    { title: t('field.supplier.code'), dataIndex: 'code', copyable: true },
    { title: t('field.supplier.name'), dataIndex: 'name' },
    { title: t('field.supplier.shortName'), dataIndex: 'shortName' },
    {
      title: t('field.supplier.category'),
      dataIndex: 'category',
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    { title: t('field.supplier.contactPerson'), dataIndex: 'contactPerson' },
    {
      title: t('field.supplier.contactTitle'),
      dataIndex: 'contactTitle',
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    { title: t('field.supplier.phone'), dataIndex: 'phone' },
    { title: t('field.supplier.email'), dataIndex: 'email' },
    { title: t('field.supplier.buyer'), dataIndex: 'buyerName' },
    { title: t('field.supplier.address'), dataIndex: 'address', span: 2 },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
  ];

  const detailColumnsInvoice: ProDescriptionsItemProps<Supplier>[] = [
    { title: t('field.partner.taxRegistrationNo'), dataIndex: 'taxRegistrationNo' },
    { title: t('field.partner.invoiceTitle'), dataIndex: 'invoiceTitle' },
    { title: t('field.partner.invoiceAddress'), dataIndex: 'invoiceAddress', span: 2 },
    { title: t('field.partner.invoicePhone'), dataIndex: 'invoicePhone' },
    { title: t('field.partner.invoiceBankName'), dataIndex: 'invoiceBankName' },
    { title: t('field.partner.invoiceBankAccount'), dataIndex: 'invoiceBankAccount' },
    {
      title: t('field.partner.invoiceType'),
      dataIndex: 'invoiceTypeCode',
      render: (_, r) => partnerInvoiceTypeLabel(t, r.invoiceTypeCode),
    },
    {
      title: t('field.partner.taxpayerType'),
      dataIndex: 'taxpayerTypeCode',
      render: (_, r) => partnerTaxpayerTypeLabel(t, r.taxpayerTypeCode),
    },
  ];

  const detailColumnsExtended: ProDescriptionsItemProps<Supplier>[] = [
    {
      title: t('field.supplier.payableRecognitionOverride'),
      dataIndex: 'payableRecognitionOverride',
      render: (_, r) => partnerPayableRecognitionOverrideLabel(t, r.payableRecognitionOverride),
    },
    {
      title: t('field.supplier.industry'),
      dataIndex: 'industryCode',
      render: (_, r) => dictLabel('INDUSTRY_SECTOR', r.industryCode),
    },
    {
      title: t('field.supplier.sourceChannel'),
      dataIndex: 'sourceChannelCode',
      render: (_, r) => dictLabel('PARTNER_SOURCE_CHANNEL', r.sourceChannelCode),
    },
    {
      title: t('field.supplier.estimatedAnnualPurchase'),
      dataIndex: 'estimatedAnnualPurchase',
      render: (_, r) =>
        r.estimatedAnnualPurchase != null && r.estimatedAnnualPurchase !== ''
          ? Number(r.estimatedAnnualPurchase).toLocaleString()
          : '—',
    },
    {
      title: t('field.supplier.creditLimit'),
      dataIndex: 'creditLimit',
      render: (_, r) =>
        r.creditLimit != null && r.creditLimit !== ''
          ? Number(r.creditLimit).toLocaleString()
          : '—',
    },
    { title: t('field.partner.legalRepresentative'), dataIndex: 'legalRepresentative' },
    {
      title: t('field.partner.enterpriseType'),
      dataIndex: 'enterpriseTypeCode',
      render: (_, r) => partnerEnterpriseTypeLabel(t, r.enterpriseTypeCode),
    },
    {
      title: t('field.partner.paymentTermsDays'),
      dataIndex: 'paymentTermsDays',
      render: (_, r) =>
        r.paymentTermsDays != null && r.paymentTermsDays !== '' ? String(r.paymentTermsDays) : '—',
    },
    {
      title: t('field.partner.settlementMethod'),
      dataIndex: 'settlementMethodCode',
      render: (_, r) => partnerSettlementMethodLabel(t, r.settlementMethodCode),
    },
    { title: t('field.partner.deliveryContactName'), dataIndex: 'deliveryContactName' },
    { title: t('field.partner.deliveryContactPhone'), dataIndex: 'deliveryContactPhone' },
    { title: t('field.partner.deliveryAddress'), dataIndex: 'deliveryAddress', span: 2 },
    { title: t('app.master-data.warehouses.createTime'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('app.master-data.warehouses.updateTime'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Supplier>
        columnPersistenceId="apps.master-data.pages.supply-chain.suppliers"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, __filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };

          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }

          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          // 采购员筛选
          if (searchFormValues?.buyerId !== undefined && searchFormValues.buyerId !== '' && searchFormValues.buyerId !== null) {
            apiParams.buyerId = searchFormValues.buyerId;
          }

          // 搜索参数处理
          if (searchFormValues?.code && searchFormValues.code.trim()) {
            apiParams.code = searchFormValues.code.trim();
          }

          if (searchFormValues?.name && searchFormValues.name.trim()) {
            apiParams.name = searchFormValues.name.trim();
          }

          const fuzzyKw = String(searchFormValues?.keyword ?? '').trim();
          if (fuzzyKw) apiParams.keyword = fuzzyKw;

          const { sortBy: rawSortBy, sortOrder } = extractProTableSort(sort);
          const sortField = mapSupplyChainSortField(rawSortBy);
          if (sortField) {
            apiParams.sortBy = sortField;
            apiParams.sortOrder = sortOrder;
          }
          
          try {
            const result = await supplierApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = await enrichRecordsWithCustomFields(listData);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取供应商列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.suppliers.getListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.suppliers.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="suppliers-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={supplierImportTemplate.importHeaders}
        importExampleRow={supplierImportTemplate.importExampleRow}
        importFieldMap={supplierImportTemplate.importHeaderMap}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
      />
      </ListPageTemplate>

      {/* 详情 Drawer（uni-detail） */}
      <UniDetail
        title={t('app.master-data.suppliers.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        plainBody={
          supplierDetail ? (
            <>
              <DetailDrawerSection title={t('field.partner.tabBasic')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsBasic, supplierDetail)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('field.partner.tabInvoice')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsInvoice, supplierDetail)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('field.partner.tabExtended')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsExtended, supplierDetail)}
                />
              </DetailDrawerSection>
              {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')} marginBottom={0}>
                  <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
                </DetailDrawerSection>
              ) : null}
            </>
          ) : null
        }
      />

      {/* 创建/编辑供应商 Modal */}
      <SupplierFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default SuppliersPage;
