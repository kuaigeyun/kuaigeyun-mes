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
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  DetailDrawerActions,
  DetailDrawerSection,
  ListPageTemplate,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { PartnerMasterDetailDrawer } from '../../shared/PartnerMasterDetailDrawer';
import {
  alignDescriptionColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

import { customerApi, getUserOptions, getDictionaryOptions } from '../../../services/supply-chain';
import { getDictionaryLabelMapSync } from '../../../../../services/dataDictionaryCache';
import {
  buildMasterCrudActiveValueEnum,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
  resolveCustomerListParams,
} from '../../../utils/supplyChainListCore';
import { CustomerFormModal } from '../../../components/CustomerFormModal';
import type { Customer, CustomerCreate } from '../../../types/supply-chain';
import {
  partnerEnterpriseTypeLabel,
  partnerInvoiceTypeLabel,
  partnerRevenueRecognitionOverrideLabel,
  partnerSettlementMethodLabel,
  partnerTaxpayerTypeLabel,
} from '../../../utils/partner-static-labels';
import { importInChunks } from '../../../../../utils/chunkedBulkImport';
import { downloadFile } from '../../../../../utils';
import {
  CustomerFollowUpFormModal,
  type CustomerFollowUpPreset,
} from '../../../../kuaizhizao/components/CustomerFollowUpFormModal';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import {
  buildPartnerEnterpriseTypeImportOptions,
  buildPartnerInvoiceTypeImportOptions,
  buildPartnerSettlementMethodImportOptions,
  buildPartnerTaxpayerTypeImportOptions,
  parsePartnerEnterpriseTypeImport,
  parsePartnerInvoiceTypeImport,
  parsePartnerSettlementMethodImport,
  parsePartnerTaxpayerTypeImport,
} from '../../../utils/partner-static-labels';
import {
  IMPORT_YES_NO_OPTIONS,
  importDropdownLabelsFromCodeLabelMap,
  parseImportCodedCell,
  resolveDictionaryDisplayLabel,
} from '../../../../../utils/loadImportDictionaryValues';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  renderMasterActiveTag,
} from '../../../utils/masterListPresentation';
import { UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 客户管理列表页面组件
 */
const CustomersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const customerActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
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
  const loadDetail = useCallback(async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await customerApi.get(uuid);
      setCustomerDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setCustomerDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.customers.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [loadFieldValuesForDetail, t]);

  const openDetailByUuid = useCallback(
    (uuid: string) => {
      detailRetryUuidRef.current = uuid;
      setDrawerVisible(true);
      setCustomerDetail(null);
      setDetailError(null);
      void loadDetail(uuid);
    },
    [loadDetail],
  );

  useEffect(() => {
    const uuid = searchParams.get('uuid');
    if (!uuid) return;
    void openDetailByUuid(uuid);
    const next = new URLSearchParams(searchParams);
    next.delete('uuid');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 uuid 入参，避免 searchParams 对象引用变化重复 replace
  }, [openDetailByUuid, searchParams.get('uuid')]);

  const customerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.customer.code' },
          { field: 'name', required: true, labelKey: 'field.customer.name' },
          { field: 'shortName', labelKey: 'field.customer.shortName' },
          { field: 'category', labelKey: 'field.customer.category' , options: importDropdownLabelsFromCodeLabelMap(dictLabelMaps.CUSTOMER_CATEGORY ?? {}) },
          { field: 'contactPerson', labelKey: 'field.customer.contactPerson' },
          { field: 'contactTitle', labelKey: 'field.customer.contactTitle' , options: importDropdownLabelsFromCodeLabelMap(dictLabelMaps.CONTACT_TITLE ?? {}) },
          { field: 'phone', labelKey: 'field.customer.phone' },
          { field: 'email', labelKey: 'field.customer.email' },
          { field: 'isActive', labelKey: 'common.enabled' , options: [...IMPORT_YES_NO_OPTIONS] },
          { field: 'taxRegistrationNo', labelKey: 'field.partner.taxRegistrationNo' },
          { field: 'invoiceTitle', labelKey: 'field.partner.invoiceTitle' },
          { field: 'invoiceAddress', labelKey: 'field.partner.invoiceAddress' },
          { field: 'invoicePhone', labelKey: 'field.partner.invoicePhone' },
          { field: 'invoiceBankName', labelKey: 'field.partner.invoiceBankName' },
          { field: 'invoiceBankAccount', labelKey: 'field.partner.invoiceBankAccount' },
          { field: 'invoiceTypeCode', labelKey: 'field.partner.invoiceType' , options: buildPartnerInvoiceTypeImportOptions(t) },
          { field: 'taxpayerTypeCode', labelKey: 'field.partner.taxpayerType' , options: buildPartnerTaxpayerTypeImportOptions(t) },
          { field: 'industryCode', labelKey: 'field.customer.industry' , options: importDropdownLabelsFromCodeLabelMap(dictLabelMaps.INDUSTRY_SECTOR ?? {}) },
          { field: 'customerLevelCode', labelKey: 'field.customer.level' , options: importDropdownLabelsFromCodeLabelMap(dictLabelMaps.CUSTOMER_LEVEL ?? {}) },
          { field: 'leadSourceCode', labelKey: 'field.customer.leadSource' , options: importDropdownLabelsFromCodeLabelMap(dictLabelMaps.PARTNER_SOURCE_CHANNEL ?? {}) },
          { field: 'estimatedAnnualPurchase', labelKey: 'field.customer.estimatedAnnualPurchase' },
          { field: 'creditLimit', labelKey: 'field.customer.creditLimit' },
          { field: 'legalRepresentative', labelKey: 'field.partner.legalRepresentative' },
          { field: 'enterpriseTypeCode', labelKey: 'field.partner.enterpriseType' , options: buildPartnerEnterpriseTypeImportOptions(t) },
          { field: 'paymentTermsDays', labelKey: 'field.partner.paymentTermsDays' },
          { field: 'settlementMethodCode', labelKey: 'field.partner.settlementMethod' , options: buildPartnerSettlementMethodImportOptions(t) },
          { field: 'deliveryContactName', labelKey: 'field.partner.deliveryContactName' },
          { field: 'deliveryContactPhone', labelKey: 'field.partner.deliveryContactPhone' },
          { field: 'deliveryAddress', labelKey: 'field.partner.deliveryAddress' },
        ],
        [
          t('app.master-data.customers.importExample.code'),
          t('app.master-data.customers.importExample.name'),
          t('app.master-data.customers.importExample.shortName'),
          t('app.master-data.customers.importExample.category'),
          t('app.master-data.customers.importExample.contactPerson'),
          '',
          t('app.master-data.customers.importExample.phone'),
          t('app.master-data.customers.importExample.email'),
          '是',
          '', '', '', '', '', '', '', '',
          '', '', '', '', '', '', '', '', '', '', '', '',
        ],
      ),
    [t, i18n.language, dictLabelMaps],
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
        const options = await getUserOptions('master-data:supply-chain:customer');
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

  const dictLabel = (dictCode: string, value?: string) =>
    resolveDictionaryDisplayLabel(dictLabelMaps[dictCode], value);

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

  const handleOpenDetail = (record: Customer) => {
    openDetailByUuid(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCustomerDetail(null);
    setDetailError(null);
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
   * 处理批量导入客户（分片 bulkCreate）
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
        if (headerIndexMap.code === undefined || headerIndexMap.name === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const cellAt = (field: string): string => {
          const idx = headerIndexMap[field];
          if (idx === undefined) return '';
          return String(row[idx] ?? '').trim();
        };
        const parseNum = (raw: string): number | undefined => {
          if (!raw) return undefined;
          const n = Number(raw);
          return Number.isFinite(n) ? n : undefined;
        };
        const parseActive = (raw: string): boolean => {
          if (!raw) return true;
          const v = raw.toLowerCase();
          if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
          return true;
        };

        const codeValue = cellAt('code');
        const nameValue = cellAt('name');
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.customers.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.customers.nameRequired') });
          return;
        }

        const contactPerson = cellAt('contactPerson') || undefined;
        const contactTitle =
          parseImportCodedCell(cellAt('contactTitle'), dictLabelMaps.CONTACT_TITLE) || undefined;
        const phone = cellAt('phone') || undefined;
        const email = cellAt('email') || undefined;
        const contacts =
          contactPerson || contactTitle || phone || email
            ? [{ contactPerson, contactTitle, phone, email }]
            : undefined;

        const customerData: CustomerCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          shortName: cellAt('shortName') || undefined,
          category: parseImportCodedCell(cellAt('category'), dictLabelMaps.CUSTOMER_CATEGORY),
          contacts,
          isActive: parseActive(cellAt('isActive')),
          taxRegistrationNo: cellAt('taxRegistrationNo') || undefined,
          invoiceTitle: cellAt('invoiceTitle') || undefined,
          invoiceAddress: cellAt('invoiceAddress') || undefined,
          invoicePhone: cellAt('invoicePhone') || undefined,
          invoiceBankName: cellAt('invoiceBankName') || undefined,
          invoiceBankAccount: cellAt('invoiceBankAccount') || undefined,
          invoiceTypeCode: parsePartnerInvoiceTypeImport(cellAt('invoiceTypeCode'), t),
          taxpayerTypeCode: parsePartnerTaxpayerTypeImport(cellAt('taxpayerTypeCode'), t),
          industryCode: parseImportCodedCell(cellAt('industryCode'), dictLabelMaps.INDUSTRY_SECTOR),
          customerLevelCode: parseImportCodedCell(
            cellAt('customerLevelCode'),
            dictLabelMaps.CUSTOMER_LEVEL,
          ),
          leadSourceCode: parseImportCodedCell(
            cellAt('leadSourceCode'),
            dictLabelMaps.PARTNER_SOURCE_CHANNEL,
          ),
          estimatedAnnualPurchase: parseNum(cellAt('estimatedAnnualPurchase')),
          creditLimit: parseNum(cellAt('creditLimit')),
          legalRepresentative: cellAt('legalRepresentative') || undefined,
          enterpriseTypeCode: parsePartnerEnterpriseTypeImport(cellAt('enterpriseTypeCode'), t),
          paymentTermsDays: parseNum(cellAt('paymentTermsDays')),
          settlementMethodCode: parsePartnerSettlementMethodImport(cellAt('settlementMethodCode'), t),
          deliveryContactName: cellAt('deliveryContactName') || undefined,
          deliveryContactPhone: cellAt('deliveryContactPhone') || undefined,
          deliveryAddress: cellAt('deliveryAddress') || undefined,
        };
        importData.push(customerData);
      } catch (error: any) {
        errors.push({ row: actualRowIndex, message: error.message || t('app.master-data.dataParseFailed') });
      }
    });

    if (errors.length > 0) {
      getAntdModal().warning({
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
      const CHUNK = 100;
      const result = await importInChunks({
        items: importData,
        chunkSize: CHUNK,
        title: t('app.master-data.customers.importTitle'),
        showResultModal: false,
        importChunk: async (chunk) => {
          const res = await customerApi.bulkCreate(chunk);
          return {
            createdCount: res.createdCount,
            failedItems: res.failedItems,
          };
        },
      });

      if (result.failureCount > 0) {
        getAntdModal().warning({
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
        filename = `${t('app.master-data.customers.exportFilenameSelected', { date: todaySiteDateString() })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.customers.exportFilenameCurrentPage', { date: todaySiteDateString() })}.csv`;
      } else {
        exportData = await fetchAllListItems((p) => customerApi.list({ ...p, ...lastListParamsRef.current }));
        filename = `${t('app.master-data.customers.exportFilenameAll', { date: todaySiteDateString() })}.csv`;
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
        t('field.partner.deliveryAddress'),
        t('field.customer.salesman'),
        t('common.status'),
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
          item.deliveryAddress || '',
          item.salesmanName || '',
          (item.isActive ?? (item as any)?.is_active) ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? formatDateTimeBySiteSetting(item.createdAt) : '',
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
      messageApi.error(error.message || t('common.exportFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Customer>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    ...masterCrudCodeNameSearchColumns({
      code: t('field.customer.code'),
      name: t('field.customer.name'),
    }),
    {
      title: t('field.customer.code'),
      dataIndex: 'code',
      copyable: true,
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('field.customer.name'),
      dataIndex: 'name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      // 主数据名单行：可省略，禁止撑破单元格导致右固定错位
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('field.customer.shortName'),
      dataIndex: 'shortName',
      width: 96,
      minWidth: 96,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      // @ts-expect-error UniTable defaultShow：列设置可再打开
      defaultShow: false,
    },
    {
      title: t('field.customer.category'),
      dataIndex: 'category',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      ellipsis: true,
      render: (_, r) => dictLabel('CUSTOMER_CATEGORY', r.category),
    },
    {
      title: t('field.customer.salesman'),
      dataIndex: 'salesmanName',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      ellipsis: true,
    },
    {
      title: t('field.customer.contactPerson'),
      dataIndex: 'contactPerson',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('field.customer.contactTitle'),
      dataIndex: 'contactTitle',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      // @ts-expect-error UniTable defaultShow：列设置可再打开
      defaultShow: false,
      render: (_, r) => dictLabel('CONTACT_TITLE', r.contactTitle),
    },
    {
      title: t('field.customer.phone'),
      dataIndex: 'phone',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
    },
    {
      title: t('field.customer.email'),
      dataIndex: 'email',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      // @ts-expect-error UniTable defaultShow：列设置可再打开
      defaultShow: false,
    },
    {
      title: t('field.partner.deliveryAddress'),
      dataIndex: 'deliveryAddress',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
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
      title: t('common.status'),
      dataIndex: 'isActive',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: customerActiveValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      valueEnum: customerActiveValueEnum,
      render: (_, record) => renderMasterActiveTag(t, record?.isActive ?? (record as any)?.is_active, 'common.enabled', 'common.disabled'),
      sorter: true,
    },
    ...customFieldColumns,
    ...masterCrudCreatedUpdatedColumns<Customer>(t),
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('common.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
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
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [customFields, t, dictLabel, salesmanValueEnum, salesmanOptions, customerActiveValueEnum]);

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
      title: t('field.customer.assignedAt'),
      dataIndex: 'assignedAt',
      valueType: 'dateTime',
    },
    {
      title: t('field.customer.lastFollowUpAt'),
      dataIndex: 'lastFollowUpAt',
      valueType: 'dateTime',
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      render: (_, record) => renderMasterActiveTag(t, record?.isActive ?? (record as any)?.is_active, 'common.enabled', 'common.disabled'),
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
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Customer>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.customers')}
        columnPersistenceId="apps.master-data.pages.supply-chain.customers.list-v2"
        actionRef={actionRef}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        request={async (params, sort, __filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const listParams = resolveCustomerListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const apiParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            isActive: listParams.isActive as boolean | undefined,
            category: listParams.category as string | undefined,
            salesmanId: listParams.salesmanId as number | undefined,
            keyword: listParams.keyword as string | undefined,
            code: listParams.code as string | undefined,
            name: listParams.name as string | undefined,
            created_start_date: listParams.created_start_date as string | undefined,
            created_end_date: listParams.created_end_date as string | undefined,
            updated_start_date: listParams.updated_start_date as string | undefined,
            updated_end_date: listParams.updated_end_date as string | undefined,
            sortBy: listParams.sortBy as string | undefined,
            sortOrder: listParams.sortOrder as 'asc' | 'desc' | undefined,
          };

          try {
            const result = await customerApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = meta?.purpose === 'prefetch'
              ? listData
              : await enrichRecordsWithCustomFields(listData);
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
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
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
        importColumnOptions={customerImportTemplate.importColumnOptions}
        importFieldMap={customerImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
      />
      </ListPageTemplate>

      {/* 详情 Drawer（uni-detail） */}
      <PartnerMasterDetailDrawer
        title={t('app.master-data.customers.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        extra={
          customerDetail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'followUp',
                  visible: Boolean(customerDetail.id),
                  render: (
                    <Button onClick={handleOpenFollowUp}>
                      {t('app.kuaizhizao.customerFollowUp.new')}
                    </Button>
                  ),
                },
                {
                  key: 'pool',
                  visible: Boolean(customerDetail.id),
                  render: (
                    <Button
                      onClick={() =>
                        navigate(
                          `/apps/kuaizhizao/sales-management/customer-pool?customerId=${customerDetail.id}`,
                        )
                      }
                    >
                      {t('field.customer.viewInPool')}
                    </Button>
                  ),
                },
                {
                  key: 'edit',
                  render: (
                    <Button {...rowActionKind('update')} onClick={() => handleEdit(customerDetail)}>
                      {t('common.edit')}
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
      >
        {customerDetail ? (
          <>
            <DetailDrawerSection title={t('field.partner.tabBasic')}>
              <Descriptions
                column={2}
                size="small"
                items={detailDrawerDescriptionItems(
                  alignDescriptionColumns(detailColumnsBasic, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                  customerDetail,
                )}
              />
            </DetailDrawerSection>
            <DetailDrawerSection title={t('field.partner.tabInvoice')}>
              <Descriptions
                column={2}
                size="small"
                items={detailDrawerDescriptionItems(
                  alignDescriptionColumns(detailColumnsInvoice, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                  customerDetail,
                )}
              />
            </DetailDrawerSection>
            <DetailDrawerSection title={t('field.partner.tabExtended')}>
              <Descriptions
                column={2}
                size="small"
                items={detailDrawerDescriptionItems(
                  alignDescriptionColumns(detailColumnsExtended, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                  customerDetail,
                )}
              />
            </DetailDrawerSection>
            {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
              <DetailDrawerSection title={t('app.master-data.customFields')} marginBottom={0}>
                <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
              </DetailDrawerSection>
            ) : null}
          </>
        ) : null}
      </PartnerMasterDetailDrawer>

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
