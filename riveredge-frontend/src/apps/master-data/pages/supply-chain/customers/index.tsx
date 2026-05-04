/**
 * 客户管理页面
 * 
 * 提供客户的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { flushDrawerOpen, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';

import { customerApi, getUserOptions, getDictionaryOptions } from '../../../services/supply-chain';
import { CustomerFormModal } from '../../../components/CustomerFormModal';
import type { Customer, CustomerCreate } from '../../../types/supply-chain';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';

/**
 * 客户管理列表页面组件
 */
const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑客户）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [dictLabelMaps, setDictLabelMaps] = useState<Record<string, Record<string, string>>>({});
  const customerDetailReqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const codes = [
          'INDUSTRY_SECTOR',
          'CUSTOMER_LEVEL',
          'PARTNER_SOURCE_CHANNEL',
          'CUSTOMER_CATEGORY',
          'CONTACT_TITLE',
        ];
        const packs = await Promise.all(codes.map((c) => getDictionaryOptions(c)));
        if (cancelled) return;
        const maps: Record<string, Record<string, string>> = {};
        codes.forEach((code, index) => {
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
  }, []);

  const dictLabel = (dictCode: string, value?: string) => {
    if (value == null || value === '') return '—';
    return dictLabelMaps[dictCode]?.[value] ?? value;
  };

  /**
   * 处理新建客户
   */
  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  /**
   * 处理编辑客户
   */
  const handleEdit = (record: Customer) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除客户
   */
  const handleDelete = async (record: Customer) => {
    try {
      await customerApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除客户
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
              await customerApi.delete(key.toString());
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

  const handleOpenDetail = async (record: Customer) => {
    const req = ++customerDetailReqRef.current;
    flushDrawerOpen(() => {
      setCustomerDetail(record);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await customerApi.get(record.uuid);
      if (customerDetailReqRef.current !== req) return;
      setCustomerDetail(detail);
    } catch (error: any) {
      if (customerDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.customers.getDetailFailed'));
      }
    } finally {
      if (customerDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCustomerDetail(null);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditUuid(null);
  };

  /**
   * 处理批量导入客户（batchImport + customerApi.create 循环）
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
      [t('field.customer.code')]: 'code',
      [`*${t('field.customer.code')}`]: 'code',
      [t('field.customer.name')]: 'name',
      [`*${t('field.customer.name')}`]: 'name',
      [t('field.customer.shortName')]: 'shortName',
      [t('field.customer.contactPerson')]: 'contactPerson',
      [t('field.customer.phone')]: 'phone',
      [t('field.customer.email')]: 'email',
      [t('field.customer.address')]: 'address',
      [t('field.customer.category')]: 'category',
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
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.customer.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.customer.name'), headers: headers.join(', ') }));
      return;
    }

    const importData: CustomerCreate[] = [];
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
          errors.push({ row: actualRowIndex, message: t('app.master-data.customers.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.customers.nameRequired') });
          return;
        }

        const customerData: CustomerCreate = {
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
        importData.push(customerData);
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
        importFn: async (item: CustomerCreate) => customerApi.create(item),
        title: t('app.master-data.customers.importTitle'),
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
        messageApi.success(t('app.master-data.customers.importSuccess', { count: result.successCount }));
      }

      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 处理批量导出客户
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Customer[]
  ) => {
    try {
      let exportData: Customer[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.customers.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.customers.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        exportData = await customerApi.list({ skip: 0, limit: 10000 });
        filename = `${t('app.master-data.customers.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      const headers = [
        t('field.customer.code'),
        t('field.customer.name'),
        t('field.customer.shortName'),
        t('field.customer.contactPerson'),
        t('field.customer.contactTitle'),
        t('field.customer.phone'),
        t('field.customer.email'),
        t('field.customer.address'),
        t('field.customer.category'),
        t('field.customer.industry'),
        t('field.customer.level'),
        t('field.customer.leadSource'),
        t('field.customer.estimatedAnnualPurchase'),
        t('field.customer.creditLimit'),
        t('field.customer.salesman'),
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
          item.contactTitle
            ? dictLabelMaps['CONTACT_TITLE']?.[item.contactTitle] ?? item.contactTitle
            : '',
          item.phone || '',
          item.email || '',
          item.address || '',
          item.category
            ? dictLabelMaps['CUSTOMER_CATEGORY']?.[item.category] ?? item.category
            : '',
          item.industryCode
            ? dictLabelMaps['INDUSTRY_SECTOR']?.[item.industryCode] ?? item.industryCode
            : '',
          item.customerLevelCode
            ? dictLabelMaps['CUSTOMER_LEVEL']?.[item.customerLevelCode] ?? item.customerLevelCode
            : '',
          item.leadSourceCode
            ? dictLabelMaps['PARTNER_SOURCE_CHANNEL']?.[item.leadSourceCode] ?? item.leadSourceCode
            : '',
          item.estimatedAnnualPurchase != null && item.estimatedAnnualPurchase !== ''
            ? String(item.estimatedAnnualPurchase)
            : '',
          item.creditLimit != null && item.creditLimit !== '' ? String(item.creditLimit) : '',
          item.salesmanName || '',
          (item.isActive ?? (item as any)?.is_active) ? t('common.enabled') : t('common.disabled'),
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
  const columns: ProColumns<Customer>[] = [
    {
      title: t('field.customer.code'),
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
    },
    {
      title: t('field.customer.name'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('field.customer.shortName'),
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.customer.contactPerson'),
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('field.customer.contactTitle'),
      dataIndex: 'contactTitle',
      width: 120,
      hideInSearch: true,
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    {
      title: t('field.customer.phone'),
      dataIndex: 'phone',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.customer.email'),
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: t('field.customer.category'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    {
      title: t('field.customer.industry'),
      dataIndex: 'industryCode',
      width: 110,
      hideInSearch: true,
      render: (_, r) => dictLabel('INDUSTRY_SECTOR', r.industryCode),
    },
    {
      title: t('field.customer.level'),
      dataIndex: 'customerLevelCode',
      width: 100,
      hideInSearch: true,
      render: (_, r) => dictLabel('CUSTOMER_LEVEL', r.customerLevelCode),
    },
    {
      title: t('field.customer.leadSource'),
      dataIndex: 'leadSourceCode',
      width: 110,
      hideInSearch: true,
      render: (_, r) => dictLabel('PARTNER_SOURCE_CHANNEL', r.leadSourceCode),
    },
    {
      title: t('field.customer.estimatedAnnualPurchase'),
      dataIndex: 'estimatedAnnualPurchase',
      width: 120,
      hideInSearch: true,
      render: (_, r) =>
        r.estimatedAnnualPurchase != null && r.estimatedAnnualPurchase !== ''
          ? Number(r.estimatedAnnualPurchase).toLocaleString()
          : '—',
    },
    {
      title: t('field.customer.creditLimit'),
      dataIndex: 'creditLimit',
      width: 110,
      hideInSearch: true,
      render: (_, r) =>
        r.creditLimit != null && r.creditLimit !== ''
          ? Number(r.creditLimit).toLocaleString()
          : '—',
    },
    {
      title: t('field.customer.salesman'),
      dataIndex: 'salesmanName',
      width: 120,
      valueType: 'select',
      request: getUserOptions,
      // 使用 salesmanId 进行搜索
      fieldProps: {
        name: 'salesmanId',
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
        <Tag color={(record?.isActive ?? (record as any)?.is_active) ? 'success' : 'default'}>
          {(record?.isActive ?? (record as any)?.is_active) ? t('common.enabled') : t('common.disabled')}
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
            title={t('app.master-data.customers.deleteConfirm')}
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

  // 详情列定义
  const detailColumns: ProDescriptionsItemProps<Customer>[] = [
    {
      title: t('field.customer.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('field.customer.name'),
      dataIndex: 'name',
    },
    {
      title: t('field.customer.shortName'),
      dataIndex: 'shortName',
    },
    {
      title: t('field.customer.contactPerson'),
      dataIndex: 'contactPerson',
    },
    {
      title: t('field.customer.contactTitle'),
      dataIndex: 'contactTitle',
    },
    {
      title: t('field.customer.phone'),
      dataIndex: 'phone',
    },
    {
      title: t('field.customer.email'),
      dataIndex: 'email',
    },
    {
      title: t('field.customer.address'),
      dataIndex: 'address',
      span: 2,
    },
    {
      title: t('field.customer.category'),
      dataIndex: 'category',
    },
    {
      title: t('field.customer.industry'),
      dataIndex: 'industryCode',
      render: (_, r) => dictLabel('INDUSTRY_SECTOR', r.industryCode),
    },
    {
      title: t('field.customer.level'),
      dataIndex: 'customerLevelCode',
      render: (_, r) => dictLabel('CUSTOMER_LEVEL', r.customerLevelCode),
    },
    {
      title: t('field.customer.leadSource'),
      dataIndex: 'leadSourceCode',
      render: (_, r) => dictLabel('PARTNER_SOURCE_CHANNEL', r.leadSourceCode),
    },
    {
      title: t('field.customer.estimatedAnnualPurchase'),
      dataIndex: 'estimatedAnnualPurchase',
      render: (_, r) =>
        r.estimatedAnnualPurchase != null && r.estimatedAnnualPurchase !== ''
          ? Number(r.estimatedAnnualPurchase).toLocaleString()
          : '—',
    },
    {
      title: t('field.customer.creditLimit'),
      dataIndex: 'creditLimit',
      render: (_, r) =>
        r.creditLimit != null && r.creditLimit !== ''
          ? Number(r.creditLimit).toLocaleString()
          : '—',
    },
    {
      title: t('field.customer.salesman'),
      dataIndex: 'salesmanName',
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={(record?.isActive ?? (record as any)?.is_active) ? 'success' : 'default'}>
          {(record?.isActive ?? (record as any)?.is_active) ? t('common.enabled') : t('common.disabled')}
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
      <UniTable<Customer>
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
          
          // 业务员筛选
          if (searchFormValues?.salesmanId !== undefined && searchFormValues.salesmanId !== '' && searchFormValues.salesmanId !== null) {
            apiParams.salesmanId = searchFormValues.salesmanId;
          }
          
          try {
            const result = await customerApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取客户列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.customers.getListFailed'));
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
            {t('app.master-data.customers.create') + NEW_SHORTCUT_HINT}
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
          `*${t('field.customer.code')}`,
          `*${t('field.customer.name')}`,
          t('field.customer.shortName'),
          t('field.customer.contactPerson'),
          t('field.customer.phone'),
          t('field.customer.email'),
          t('field.customer.address'),
          t('field.customer.category'),
        ]}
        importExampleRow={['CUST-WX-001', '无锡盛世高新装备有限公司', '盛世高新', '张经理', '0510-81110001', 'contact@shengshi-wx.com', '无锡市新吴区机电五支路1000号', '制造业']}
        importFieldMap={{
          [t('field.customer.code')]: 'code',
          [`*${t('field.customer.code')}`]: 'code',
          [t('field.customer.name')]: 'name',
          [`*${t('field.customer.name')}`]: 'name',
          [t('field.customer.shortName')]: 'shortName',
          [t('field.customer.contactPerson')]: 'contactPerson',
          [t('field.customer.phone')]: 'phone',
          [t('field.customer.email')]: 'email',
          [t('field.customer.address')]: 'address',
          [t('field.customer.category')]: 'category',
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

      {/* 详情 Drawer（uni-detail） */}
      <UniDetail
        title={t('app.master-data.customers.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          customerDetail ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, customerDetail)} />
          ) : null
        }
      />

      {/* 创建/编辑客户 Modal */}
      <CustomerFormModal
        open={modalVisible}
        onClose={handleCloseModal}
        editUuid={editUuid}
        onSuccess={() => actionRef.current?.reload()}
      />
    </>
  );
};

export default CustomersPage;
