/**
 * 供应商管理页面
 * 
 * 提供供应商的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { supplierApi, getUserOptions, getDictionaryOptions } from '../../../services/supply-chain';
import { SupplierFormModal } from '../../../components/SupplierFormModal';
import type { Supplier, SupplierCreate } from '../../../types/supply-chain';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';
import { SupplierPerformanceTag } from '../../../../kuaizhizao/pages/purchase-management/purchase-orders/ProcurementEmpowermentComponents';

/**
 * 供应商管理列表页面组件
 */
const SuppliersPage: React.FC = () => {
  const { t } = useTranslation();
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

  const [dictLabelMaps, setDictLabelMaps] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const packs = await Promise.all([
          getDictionaryOptions('INDUSTRY_SECTOR'),
          getDictionaryOptions('SUPPLIER_LEVEL'),
          getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
          getDictionaryOptions('CUSTOMER_CATEGORY'),
          getDictionaryOptions('CONTACT_TITLE'),
        ]);
        if (cancelled) return;
        setDictLabelMaps({
          INDUSTRY_SECTOR: Object.fromEntries(packs[0].map((o) => [o.value, o.label])),
          SUPPLIER_LEVEL: Object.fromEntries(packs[1].map((o) => [o.value, o.label])),
          PARTNER_SOURCE_CHANNEL: Object.fromEntries(packs[2].map((o) => [o.value, o.label])),
          CUSTOMER_CATEGORY: Object.fromEntries(packs[3].map((o) => [o.value, o.label])),
          CONTACT_TITLE: Object.fromEntries(packs[4].map((o) => [o.value, o.label])),
        });
      } catch {
        if (!cancelled) setDictLabelMaps({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dictLabel = (dictCode: string, value?: string) => {
    if (value == null || value === '') return '—';
    return dictLabelMaps[dictCode]?.[value] ?? value;
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
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
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
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Supplier) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await supplierApi.get(record.uuid);
      setSupplierDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.suppliers.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setSupplierDetail(null);
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

    const headerMap: Record<string, string> = {
      [t('field.supplier.code')]: 'code',
      [`*${t('field.supplier.code')}`]: 'code',
      [t('field.supplier.name')]: 'name',
      [`*${t('field.supplier.name')}`]: 'name',
      [t('field.supplier.shortName')]: 'shortName',
      [t('field.supplier.contactPerson')]: 'contactPerson',
      [t('field.supplier.phone')]: 'phone',
      [t('field.supplier.email')]: 'email',
      [t('field.supplier.address')]: 'address',
      [t('field.supplier.category')]: 'category',
      '编号': 'code', '*编号': 'code', 'code': 'code', '*code': 'code',
      '名称': 'name', '*名称': 'name', 'name': 'name', '*name': 'name',
      '简称': 'shortName', '联系人': 'contactPerson', '电话': 'phone',
      '邮箱': 'email', '地址': 'address', '分类': 'category',
    };

    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = String(header || '').trim();
      if (headerMap[normalizedHeader]) {
        headerIndexMap[headerMap[normalizedHeader]] = index;
      } else {
        const withoutStar = normalizedHeader.replace(/^\*+/, '').trim();
        if (headerMap[withoutStar]) {
          headerIndexMap[headerMap[withoutStar]] = index;
        }
      }
    });

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
        exportData = await supplierApi.list({ skip: 0, limit: 10000 });
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
        t('field.supplier.contactPerson'),
        t('field.supplier.contactTitle'),
        t('field.supplier.phone'),
        t('field.supplier.email'),
        t('field.supplier.address'),
        t('field.supplier.category'),
        t('field.supplier.industry'),
        t('field.supplier.level'),
        t('field.supplier.sourceChannel'),
        t('field.supplier.estimatedAnnualPurchase'),
        t('field.supplier.creditLimit'),
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
          item.contactPerson || '',
          item.contactTitle || '',
          item.phone || '',
          item.email || '',
          item.address || '',
          item.category || '',
          item.industryCode ? dictLabelMaps['INDUSTRY_SECTOR']?.[item.industryCode] ?? item.industryCode : '',
          item.supplierLevelCode
            ? dictLabelMaps['SUPPLIER_LEVEL']?.[item.supplierLevelCode] ?? item.supplierLevelCode
            : '',
          item.sourceChannelCode
            ? dictLabelMaps['PARTNER_SOURCE_CHANNEL']?.[item.sourceChannelCode] ?? item.sourceChannelCode
            : '',
          item.estimatedAnnualPurchase != null && item.estimatedAnnualPurchase !== ''
            ? String(item.estimatedAnnualPurchase)
            : '',
          item.creditLimit != null && item.creditLimit !== '' ? String(item.creditLimit) : '',
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
  const columns: ProColumns<Supplier>[] = [
    {
      title: t('field.supplier.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('field.supplier.name'),
      dataIndex: 'name',
      width: 250,
      render: (name: React.ReactNode, record: Supplier) => (
        <Space>
          {name}
          {record.id && <SupplierPerformanceTag supplierId={record.id} />}
        </Space>
      ),
    },
    {
      title: t('field.supplier.shortName'),
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.contactPerson'),
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
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
      title: t('field.supplier.category'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    {
      title: t('field.supplier.industry'),
      dataIndex: 'industryCode',
      width: 110,
      hideInSearch: true,
      render: (_, r) => dictLabel('INDUSTRY_SECTOR', r.industryCode),
    },
    {
      title: t('field.supplier.level'),
      dataIndex: 'supplierLevelCode',
      width: 100,
      hideInSearch: true,
      render: (_, r) => dictLabel('SUPPLIER_LEVEL', r.supplierLevelCode),
    },
    {
      title: t('field.supplier.sourceChannel'),
      dataIndex: 'sourceChannelCode',
      width: 110,
      hideInSearch: true,
      render: (_, r) => dictLabel('PARTNER_SOURCE_CHANNEL', r.sourceChannelCode),
    },
    {
      title: t('field.supplier.estimatedAnnualPurchase'),
      dataIndex: 'estimatedAnnualPurchase',
      width: 120,
      hideInSearch: true,
      render: (_, r) =>
        r.estimatedAnnualPurchase != null && r.estimatedAnnualPurchase !== ''
          ? Number(r.estimatedAnnualPurchase).toLocaleString()
          : '—',
    },
    {
      title: t('field.supplier.creditLimit'),
      dataIndex: 'creditLimit',
      width: 110,
      hideInSearch: true,
      render: (_, r) =>
        r.creditLimit != null && r.creditLimit !== ''
          ? Number(r.creditLimit).toLocaleString()
          : '—',
    },
    {
      title: t('field.supplier.buyer'),
      dataIndex: 'buyerName',
      width: 120,
      valueType: 'select',
      request: getUserOptions,
      fieldProps: {
        name: 'buyerId',
      },
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
    },
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
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('field.customField.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
            title={t('app.master-data.suppliers.deleteConfirm')}
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

  const detailColumns: ProDescriptionsItemProps<Supplier>[] = [
    {
      title: t('field.supplier.code'),
      dataIndex: 'code',
    },
    {
      title: t('field.supplier.name'),
      dataIndex: 'name',
      render: (name: React.ReactNode, record: Supplier) => (
        <Space>
          {name}
          {record.id && <SupplierPerformanceTag supplierId={record.id} />}
        </Space>
      ),
    },
    {
      title: t('field.supplier.shortName'),
      dataIndex: 'shortName',
    },
    {
      title: t('field.supplier.contactPerson'),
      dataIndex: 'contactPerson',
    },
    {
      title: t('field.supplier.contactTitle'),
      dataIndex: 'contactTitle',
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    {
      title: t('field.supplier.phone'),
      dataIndex: 'phone',
    },
    {
      title: t('field.supplier.email'),
      dataIndex: 'email',
    },
    {
      title: t('field.supplier.address'),
      dataIndex: 'address',
      span: 2,
    },
    {
      title: t('field.supplier.category'),
      dataIndex: 'category',
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    {
      title: t('field.supplier.industry'),
      dataIndex: 'industryCode',
      render: (_, r) => dictLabel('INDUSTRY_SECTOR', r.industryCode),
    },
    {
      title: t('field.supplier.level'),
      dataIndex: 'supplierLevelCode',
      render: (_, r) => dictLabel('SUPPLIER_LEVEL', r.supplierLevelCode),
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
    {
      title: t('field.supplier.buyer'),
      dataIndex: 'buyerName',
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.warehouses.updateTime'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Supplier>
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, __filter, searchFormValues) => {
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

          // 如果有关键词搜索，传递给后端
          if (searchFormValues?.keyword && searchFormValues.keyword.trim()) {
            apiParams.keyword = searchFormValues.keyword.trim();
          }
          
          try {
            const result = await supplierApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
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
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('app.master-data.suppliers.create') + NEW_SHORTCUT_HINT}
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            {t('common.batchDelete')}
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={[
          `*${t('field.supplier.code')}`,
          `*${t('field.supplier.name')}`,
          t('field.supplier.shortName'),
          t('field.supplier.contactPerson'),
          t('field.supplier.phone'),
          t('field.supplier.email'),
          t('field.supplier.address'),
          t('field.supplier.category'),
        ]}
        importExampleRow={['SUPP-WX-001', '无锡德力精密零件有限公司', '德力精密', '王经理', '0510-82220002', 'contact@deli-wx.com', '无锡市锡山经济技术开发区二号路88号', '原材料']}
        importFieldMap={{
          [t('field.supplier.code')]: 'code',
          [`*${t('field.supplier.code')}`]: 'code',
          [t('field.supplier.name')]: 'name',
          [`*${t('field.supplier.name')}`]: 'name',
          [t('field.supplier.shortName')]: 'shortName',
          [t('field.supplier.contactPerson')]: 'contactPerson',
          [t('field.supplier.phone')]: 'phone',
          [t('field.supplier.email')]: 'email',
          [t('field.supplier.address')]: 'address',
          [t('field.supplier.category')]: 'category',
          'code': 'code', '*code': 'code', 'name': 'name', '*name': 'name',
          'shortName': 'shortName', 'contactPerson': 'contactPerson', 'phone': 'phone',
          'email': 'email', 'address': 'address', 'category': 'category',
        }}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Supplier>
        title={t('app.master-data.suppliers.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={supplierDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
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
