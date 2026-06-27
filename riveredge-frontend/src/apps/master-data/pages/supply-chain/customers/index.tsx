/**
 * 客户管理页面
 * 
 * 提供客户的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

import { customerApi, getUserOptions, getDictionaryOptions } from '../../../services/supply-chain';
import { getDictionaryLabelMapSync } from '../../../../../services/dataDictionaryCache';
import { extractProTableSort, mapSupplyChainSortField } from '../../../../../utils/tableQueryKey';
import { CustomerFormModal } from '../../../components/CustomerFormModal';
import type { Customer, CustomerCreate } from '../../../types/supply-chain';
import {
  partnerEnterpriseTypeLabel,
  partnerInvoiceTypeLabel,
  partnerRevenueRecognitionOverrideLabel,
  partnerSettlementMethodLabel,
  partnerTaxpayerTypeLabel,
} from '../../../utils/partner-static-labels';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';
import {
  CustomerFollowUpFormModal,
  type CustomerFollowUpPreset,
} from '../../../../kuaizhizao/components/CustomerFollowUpFormModal';
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
 * 客户管理列表页面组件
 */
const CustomersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑客户）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const DICT_CODES = useMemo(
    () => ['INDUSTRY_SECTOR', 'CUSTOMER_LEVEL', 'PARTNER_SOURCE_CHANNEL', 'CUSTOMER_CATEGORY', 'CONTACT_TITLE'],
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
  const customerDetailReqRef = useRef(0);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Customer>({ tableName: 'master_data_customers' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: customerApi.update,
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

  const renderPoolStatus = useCallback(
    (status?: string) => {
      if (status === 'pool') return <Tag color="blue">{t('field.customer.poolStatusPool')}</Tag>;
      if (status === 'owned') return <Tag color="green">{t('field.customer.poolStatusOwned')}</Tag>;
      return '—';
    },
    [t],
  );

  const openDetailByUuid = useCallback(
    async (uuid: string) => {
      const req = ++customerDetailReqRef.current;
      flushDrawerOpen(() => {
        setCustomerDetail(null);
        setDrawerVisible(true);
        setDetailLoading(true);
      });
      try {
        const detail = await customerApi.get(uuid);
        if (customerDetailReqRef.current !== req) return;
        setCustomerDetail(detail);
        if (detail.id != null) {
          await loadFieldValuesForDetail(detail.id);
        }
        if (detail.id != null) {
          await loadFieldValuesForDetail(detail.id);
        }
      } catch (error: any) {
        if (customerDetailReqRef.current === req) {
          messageApi.error(error.message || t('app.master-data.customers.getDetailFailed'));
        }
      } finally {
        if (customerDetailReqRef.current === req) {
          setDetailLoading(false);
        }
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    const uuid = searchParams.get('uuid');
    if (!uuid) return;
    void openDetailByUuid(uuid);
    const next = new URLSearchParams(searchParams);
    next.delete('uuid');
    setSearchParams(next, { replace: true });
  }, [openDetailByUuid, searchParams, setSearchParams]);

  const customerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.customer.code' },
          { field: 'name', required: true, labelKey: 'field.customer.name' },
          { field: 'shortName', labelKey: 'field.customer.shortName' },
          { field: 'contactPerson', labelKey: 'field.customer.contactPerson' },
          { field: 'phone', labelKey: 'field.customer.phone' },
          { field: 'email', labelKey: 'field.customer.email' },
          { field: 'address', labelKey: 'field.customer.address' },
          { field: 'category', labelKey: 'field.customer.category' },
        ],
        [
          t('app.master-data.customers.importExample.code'),
          t('app.master-data.customers.importExample.name'),
          t('app.master-data.customers.importExample.shortName'),
          t('app.master-data.customers.importExample.contactPerson'),
          t('app.master-data.customers.importExample.phone'),
          t('app.master-data.customers.importExample.email'),
          t('app.master-data.customers.importExample.address'),
          t('app.master-data.customers.importExample.category'),
        ],
      ),
    [t, i18n.language],
  );

  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpPreset, setFollowUpPreset] = useState<CustomerFollowUpPreset | null>(null);
  const [salesmanOptions, setSalesmanOptions] = useState<Array<{ label: string; value: string | number }>>([]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await getUserOptions();
        if (!cancelled) {
          setSalesmanOptions(options);
        }
      } catch {
        if (!cancelled) {
          setSalesmanOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesmanValueEnum = useMemo(
    () =>
      Object.fromEntries(
        salesmanOptions.map((option) => [String(option.value), { text: option.label }]),
      ),
    [salesmanOptions],
  );

  const dictLabel = (dictCode: string, value?: string) => {
    if (value == null || value === '') return '—';
    return dictLabelMaps[dictCode]?.[value] ?? '—';
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
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
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
    resetDetailFieldValues();
  };

  const handleOpenFollowUp = () => {
    if (!customerDetail?.id) return;
    setFollowUpPreset({ customer_id: customerDetail.id });
    setFollowUpModalOpen(true);
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

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      customerImportTemplate.importHeaderMap,
    );

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
        const exportRes = await customerApi.list({ skip: 0, limit: 10000 });
        exportData = Array.isArray(exportRes) ? exportRes : exportRes?.data ?? [];
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
        t('field.customer.category'),
        t('field.customer.contactPerson'),
        t('field.customer.contactTitle'),
        t('field.customer.phone'),
        t('field.customer.email'),
        t('field.customer.address'),
        t('field.customer.salesman'),
        t('field.customer.poolStatus'),
        t('field.customer.recycleAt'),
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
          item.salesmanName || '',
          item.poolStatus === 'owned'
            ? t('field.customer.poolStatusOwned')
            : item.poolStatus === 'pool'
              ? t('field.customer.poolStatusPool')
              : '',
          item.recycleAt ? new Date(item.recycleAt).toLocaleString() : '',
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
  const columns: ProColumns<Customer>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('field.customer.code'),
      dataIndex: 'code',
      copyable: true,
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.customer.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      title: t('field.customer.shortName'),
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.customer.category'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
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
      title: t('field.customer.address'),
      dataIndex: 'address',
      width: 220,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('field.customer.salesman'),
      dataIndex: 'salesmanName',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.customer.salesman'),
      dataIndex: 'salesmanId',
      hideInTable: true,
      valueType: 'select',
      valueEnum: salesmanValueEnum,
      fieldProps: {
        options: salesmanOptions,
        showSearch: true,
        optionFilterProp: 'label',
        filterOption: (input: string, option?: { label?: React.ReactNode }) =>
          String(option?.label ?? '')
            .toLowerCase()
            .includes(input.toLowerCase()),
        allowClear: true,
        placeholder: t('field.customer.salesmanPlaceholder'),
      },
    },
    {
      title: t('field.customer.poolStatus'),
      dataIndex: 'poolStatus',
      width: 100,
      hideInSearch: true,
      render: (_, r) => renderPoolStatus(r.poolStatus),
    },
    {
      title: t('field.customer.recycleAt'),
      dataIndex: 'recycleAt',
      width: 165,
      hideInSearch: true,
      valueType: 'dateTime',
    },
    {
      title: t('field.customer.revenueRecognitionOverride'),
      dataIndex: 'revenueRecognitionOverride',
      width: 160,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => partnerRevenueRecognitionOverrideLabel(t, r.revenueRecognitionOverride),
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.customers.deleteConfirm')}
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
  }, [customFields, t, dictLabel, salesmanValueEnum, salesmanOptions, renderPoolStatus]);

  /** 详情列：与表单 Tab「基本信息 / 开票资料 / 业务与扩展」一致 */
  const detailColumnsBasic: ProDescriptionsItemProps<Customer>[] = [
    { title: t('field.customer.code'), dataIndex: 'code', copyable: true },
    { title: t('field.customer.name'), dataIndex: 'name' },
    { title: t('field.customer.shortName'), dataIndex: 'shortName' },
    {
      title: t('field.customer.category'),
      dataIndex: 'category',
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    { title: t('field.customer.contactPerson'), dataIndex: 'contactPerson' },
    {
      title: t('field.customer.contactTitle'),
      dataIndex: 'contactTitle',
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    { title: t('field.customer.phone'), dataIndex: 'phone' },
    { title: t('field.customer.email'), dataIndex: 'email' },
    { title: t('field.customer.salesman'), dataIndex: 'salesmanName' },
    {
      title: t('field.customer.poolStatus'),
      dataIndex: 'poolStatus',
      render: (_, r) =>
        r.poolStatus === 'owned'
          ? t('field.customer.poolStatusOwned')
          : r.poolStatus === 'pool'
            ? t('field.customer.poolStatusPool')
            : '—',
    },
    {
      title: t('field.customer.recycleAt'),
      dataIndex: 'recycleAt',
      valueType: 'dateTime',
    },
    {
      title: t('field.customer.assignedAt'),
      dataIndex: 'assignedAt',
      valueType: 'dateTime',
    },
    {
      title: t('field.customer.lastFollowUpAt'),
      dataIndex: 'lastFollowUpAt',
      valueType: 'dateTime',
    },
    { title: t('field.customer.address'), dataIndex: 'address', span: 2 },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={(record?.isActive ?? (record as any)?.is_active) ? 'success' : 'default'}>
          {(record?.isActive ?? (record as any)?.is_active) ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
  ];

  const detailColumnsInvoice: ProDescriptionsItemProps<Customer>[] = [
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

  const detailColumnsExtended: ProDescriptionsItemProps<Customer>[] = [
    {
      title: t('field.customer.revenueRecognitionOverride'),
      dataIndex: 'revenueRecognitionOverride',
      render: (_, r) => partnerRevenueRecognitionOverrideLabel(t, r.revenueRecognitionOverride),
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
      <UniTable<Customer>
        columnPersistenceId="apps.master-data.pages.supply-chain.customers"
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
          
          // 业务员筛选
          if (searchFormValues?.salesmanId !== undefined && searchFormValues.salesmanId !== '' && searchFormValues.salesmanId !== null) {
            apiParams.salesmanId = searchFormValues.salesmanId;
          }

          const fuzzyKw = String(searchFormValues?.keyword ?? '').trim();
          const fallbackKw =
            fuzzyKw ||
            String(searchFormValues?.code ?? '').trim() ||
            String(searchFormValues?.name ?? '').trim();
          if (fallbackKw) apiParams.keyword = fallbackKw;

          const { sortBy: rawSortBy, sortOrder } = extractProTableSort(sort);
          const sortField = mapSupplyChainSortField(rawSortBy);
          if (sortField) {
            apiParams.sortBy = sortField;
            apiParams.sortOrder = sortOrder;
          } else {
            // 默认按创建时间倒序（最新创建的客户优先）
            apiParams.sortBy = 'created_at';
            apiParams.sortOrder = 'desc';
          }
          
          try {
            const result = await customerApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = await enrichRecordsWithCustomFields(listData);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
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
        showCreateButton
        createButtonText={t('app.master-data.customers.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="customers-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={customerImportTemplate.importHeaders}
        importExampleRow={customerImportTemplate.importExampleRow}
        importFieldMap={customerImportTemplate.importHeaderMap}
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
        plainBody={
          customerDetail ? (
            <>
              <DetailDrawerSection title={t('field.partner.tabBasic')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsBasic, customerDetail)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('field.partner.tabInvoice')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsInvoice, customerDetail)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('field.partner.tabExtended')}>
                <Descriptions
                  column={2}
                  items={detailDrawerDescriptionItems(detailColumnsExtended, customerDetail)}
                />
              </DetailDrawerSection>
              {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')} marginBottom={0}>
                  <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.kuaizhizao.customerFollowUp.new')} marginBottom={0}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  {t('app.kuaizhizao.quotationStage.detailHint')}
                </Typography.Text>
                <Space wrap>
                  <Button type="primary" size="small" onClick={handleOpenFollowUp}>
                    {t('app.kuaizhizao.customerFollowUp.new')}
                  </Button>
                  {customerDetail.id ? (
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(
                          `/apps/kuaizhizao/sales-management/customer-pool?customerId=${customerDetail.id}`,
                        )
                      }
                    >
                      {t('field.customer.viewInPool')}
                    </Button>
                  ) : null}
                </Space>
              </DetailDrawerSection>
            </>
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

      <CustomerFollowUpFormModal
        open={followUpModalOpen}
        preset={followUpPreset}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpPreset(null);
        }}
      />
    </>
  );
};

export default CustomersPage;
