/**
 * 单位管理：单位目录 + 全局换算关系
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormInstance,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, List, Modal, Popconfirm, Space, Typography } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  FormModalTemplate,
  MODAL_CONFIG,
  MultiTabListPageTemplate,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { batchImportParsedRows } from '../../../../../utils/import';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { materialUnitApi } from '../../../services/material-unit';
import type { MaterialUnit, MaterialUnitConversion } from '../../../types/material-unit';
import { masterCrudCreatedUpdatedSnakeColumns } from '../../../utils/materialListCore';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { MASTER_DATA_LIST_FIELD_RANK } from '../../../utils/masterListCore';
import {
  renderMasterActiveTag,
  renderMasterYesNoTag,
  renderMasterTypeMarker,
} from '../../../utils/masterListPresentation';
import { invalidateMaterialUnitDisplayMapCache } from '../../../../../utils/materialUnitDisplay';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';

type TabKey = 'units' | 'conversions';

function parseImportActive(raw: string | undefined, defaultActive = true): boolean {
  const v = String(raw ?? '').trim();
  if (!v) return defaultActive;
  return !['0', 'false', 'no', 'n', '否', '停用', 'inactive', 'disabled'].includes(v.toLowerCase());
}

const UnitsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('master-data:material-unit');
  const unitActionRef = useRef<ActionType>(null);
  const convActionRef = useRef<ActionType>(null);
  const unitFormRef = useRef<ProFormInstance>(null);
  const convFormRef = useRef<ProFormInstance>(null);
  const lastUnitListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const lastConvListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  const [activeTabKey, setActiveTabKey] = useState<TabKey>('units');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitEditingUuid, setUnitEditingUuid] = useState<string | null>(null);
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [convEditingUuid, setConvEditingUuid] = useState<string | null>(null);
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);

  const loadUnitOptions = useCallback(async () => {
    const res = await materialUnitApi.list({ skip: 0, limit: 500, is_active: true });
    setUnitOptions(res.items.map((u) => ({ label: `${u.name}（${u.code}）`, value: u.code })));
  }, []);

  const handleLoadPreset = async () => {
    setPresetLoading(true);
    try {
      const res = await materialUnitApi.ensurePresets();
      messageApi.success(
        t('app.master-data.units.loadPresetSuccess', {
          units: res.units_created,
          backfill: res.units_backfilled,
          conversions: res.conversions_created,
        }),
      );
      invalidateMaterialUnitDisplayMapCache();
      unitActionRef.current?.reload();
      convActionRef.current?.reload();
      void loadUnitOptions();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'));
    } finally {
      setPresetLoading(false);
    }
  };

  const openCreateUnit = () => {
    setUnitEditingUuid(null);
    setUnitModalOpen(true);
    unitFormRef.current?.resetFields();
    unitFormRef.current?.setFieldsValue({ is_active: true, sort_order: 0 });
  };

  const openCreateConversion = async () => {
    await loadUnitOptions();
    setConvEditingUuid(null);
    setConvModalOpen(true);
    convFormRef.current?.resetFields();
    convFormRef.current?.setFieldsValue({
      numerator: 1,
      denominator: 1,
      is_active: true,
    });
  };

  useNewShortcut(() => {
    if (!perms.canCreate) return;
    if (activeTabKey === 'units') openCreateUnit();
    else void openCreateConversion();
  });

  const unitImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'name',
            required: true,
            labelKey: 'app.master-data.units.name',
            aliases: ['单位名称', '名称'],
          },
          {
            field: 'code',
            labelKey: 'app.master-data.units.code',
            aliases: ['单位编码', '编码'],
          },
          {
            field: 'sort_order',
            labelKey: 'app.master-data.units.sortOrder',
            aliases: ['排序'],
          },
          {
            field: 'is_active',
            labelKey: 'app.master-data.units.status',
            aliases: ['是否启用', '启用', '状态'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'description',
            labelKey: 'app.master-data.units.description',
            aliases: ['备注', '描述'],
          },
        ],
        ['件', '件', '2', '是', '件数'],
      ),
    [t, i18n.language],
  );

  const conversionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'from_unit_code',
            required: true,
            labelKey: 'app.master-data.units.fromUnit',
            aliases: ['源单位', '从单位'],
          },
          {
            field: 'to_unit_code',
            required: true,
            labelKey: 'app.master-data.units.toUnit',
            aliases: ['目标单位', '到单位'],
          },
          {
            field: 'numerator',
            required: true,
            labelKey: 'app.master-data.units.numerator',
            aliases: ['分子'],
          },
          {
            field: 'denominator',
            required: true,
            labelKey: 'app.master-data.units.denominator',
            aliases: ['分母'],
          },
          {
            field: 'is_active',
            labelKey: 'app.master-data.units.status',
            aliases: ['是否启用', '启用', '状态'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'description',
            labelKey: 'app.master-data.units.description',
            aliases: ['备注', '描述'],
          },
        ],
        ['千克', '克', '1000', '1', '是', '1千克=1000克'],
      ),
    [t, i18n.language],
  );

  const showImportErrors = useCallback(
    (errors: Array<{ row: number; message: string }>) => {
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
    },
    [t],
  );

  const handleUnitImport = async (data: any[][]) => {
    if (!data?.length) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);
    const nonEmptyRows = rows.filter(
      (row) => Array.isArray(row) && row.some((c) => String(c ?? '').trim() !== ''),
    );
    if (!nonEmptyRows.length) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(headers, unitImportTemplate.importHeaderMap);
    if (headerIndexMap.name === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.units.name'),
          headers: headers.join(', '),
        }),
      );
      return;
    }

    const importData: Array<{
      code: string;
      name: string;
      sort_order?: number;
      is_active?: boolean;
      description?: string | null;
    }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row, rowIndex) => {
      const actualRow = rowIndex + 3;
      const name = String(row[headerIndexMap.name] ?? '').trim();
      const codeRaw =
        headerIndexMap.code !== undefined ? String(row[headerIndexMap.code] ?? '').trim() : '';
      if (!name) {
        errors.push({ row: actualRow, message: t('app.master-data.units.nameRequired') });
        return;
      }
      const sortRaw =
        headerIndexMap.sort_order !== undefined
          ? String(row[headerIndexMap.sort_order] ?? '').trim()
          : '';
      let sort_order = 0;
      if (sortRaw) {
        const n = Number(sortRaw);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          errors.push({ row: actualRow, message: t('app.master-data.units.sortOrderInvalid') });
          return;
        }
        sort_order = n;
      }
      const isActiveRaw =
        headerIndexMap.is_active !== undefined
          ? String(row[headerIndexMap.is_active] ?? '').trim()
          : '';
      const description =
        headerIndexMap.description !== undefined
          ? String(row[headerIndexMap.description] ?? '').trim() || null
          : null;
      importData.push({
        code: codeRaw || name,
        name,
        sort_order,
        is_active: parseImportActive(isActiveRaw),
        description,
      });
    });

    if (errors.length) {
      showImportErrors(errors);
      return;
    }
    if (!importData.length) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    try {
      const result = await batchImportParsedRows(
        importData.map((item, i) => ({ data: item, rowIndex: i + 3, rawRow: [] })),
        async (item) => materialUnitApi.create(item),
        { title: t('app.master-data.units.importTitle') },
      );
      const successCount = result.filter((r) => r.success).length;
      const failureCount = result.filter((r) => !r.success).length;
      if (failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.master-data.importPartialResultIntro', {
                    success: successCount,
                    failure: failureCount,
                  })}
                </strong>
              </p>
              <List
                size="small"
                dataSource={result.filter((r) => !r.success)}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      {t('app.master-data.rowError', {
                        row: item.rowIndex,
                        message: item.error?.message ?? item.message,
                      })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.units.importSuccess', { count: successCount }));
      }
      invalidateMaterialUnitDisplayMapCache();
      unitActionRef.current?.reload();
      void loadUnitOptions();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.importFailed'));
    }
  };

  const handleConversionImport = async (data: any[][]) => {
    if (!data?.length) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);
    const nonEmptyRows = rows.filter(
      (row) => Array.isArray(row) && row.some((c) => String(c ?? '').trim() !== ''),
    );
    if (!nonEmptyRows.length) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      conversionImportTemplate.importHeaderMap,
    );
    for (const field of ['from_unit_code', 'to_unit_code', 'numerator', 'denominator'] as const) {
      if (headerIndexMap[field] === undefined) {
        messageApi.error(
          t('app.master-data.importMissingField', {
            field: t(`app.master-data.units.${field === 'from_unit_code' ? 'fromUnit' : field === 'to_unit_code' ? 'toUnit' : field === 'numerator' ? 'numerator' : 'denominator'}`),
            headers: headers.join(', '),
          }),
        );
        return;
      }
    }

    const importData: Array<{
      from_unit_code: string;
      to_unit_code: string;
      numerator: number;
      denominator: number;
      is_active?: boolean;
      description?: string | null;
    }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row, rowIndex) => {
      const actualRow = rowIndex + 3;
      const from_unit_code = String(row[headerIndexMap.from_unit_code] ?? '').trim();
      const to_unit_code = String(row[headerIndexMap.to_unit_code] ?? '').trim();
      const numerator = Number(String(row[headerIndexMap.numerator] ?? '').trim());
      const denominator = Number(String(row[headerIndexMap.denominator] ?? '').trim());
      if (!from_unit_code) {
        errors.push({ row: actualRow, message: t('app.master-data.units.fromRequired') });
        return;
      }
      if (!to_unit_code) {
        errors.push({ row: actualRow, message: t('app.master-data.units.toRequired') });
        return;
      }
      if (!Number.isInteger(numerator) || numerator <= 0 || !Number.isInteger(denominator) || denominator <= 0) {
        errors.push({ row: actualRow, message: t('app.master-data.units.factorRequired') });
        return;
      }
      const isActiveRaw =
        headerIndexMap.is_active !== undefined
          ? String(row[headerIndexMap.is_active] ?? '').trim()
          : '';
      const description =
        headerIndexMap.description !== undefined
          ? String(row[headerIndexMap.description] ?? '').trim() || null
          : null;
      importData.push({
        from_unit_code,
        to_unit_code,
        numerator,
        denominator,
        is_active: parseImportActive(isActiveRaw),
        description,
      });
    });

    if (errors.length) {
      showImportErrors(errors);
      return;
    }
    if (!importData.length) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    try {
      const result = await batchImportParsedRows(
        importData.map((item, i) => ({ data: item, rowIndex: i + 3, rawRow: [] })),
        async (item) => materialUnitApi.createConversion(item),
        { title: t('app.master-data.units.conversionImportTitle') },
      );
      const successCount = result.filter((r) => r.success).length;
      const failureCount = result.filter((r) => !r.success).length;
      if (failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.master-data.importPartialResultIntro', {
                    success: successCount,
                    failure: failureCount,
                  })}
                </strong>
              </p>
              <List
                size="small"
                dataSource={result.filter((r) => !r.success)}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      {t('app.master-data.rowError', {
                        row: item.rowIndex,
                        message: item.error?.message ?? item.message,
                      })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          ),
        });
      } else {
        messageApi.success(
          t('app.master-data.units.conversionImportSuccess', { count: successCount }),
        );
      }
      convActionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.importFailed'));
    }
  };

  const handleUnitExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedKeys?: React.Key[],
    pageData?: MaterialUnit[],
  ) => {
    try {
      let exportData: MaterialUnit[] = [];
      if (type === 'selected' && selectedKeys?.length && pageData) {
        exportData = pageData.filter((item) => selectedKeys.includes(item.uuid));
      } else if (type === 'currentPage' && pageData) {
        exportData = pageData;
      } else {
        exportData = await fetchAllListItems((p) =>
          materialUnitApi.list({ ...p, ...lastUnitListParamsRef.current }),
        );
      }
      if (!exportData.length) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      await downloadRecordsAsXlsx(
        exportData.map((r) => ({
          code: r.code,
          name: r.name,
          sort_order: r.sort_order,
          is_active: r.is_active ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled'),
          is_system: r.is_system ? t('app.master-data.units.isSystem') : '',
          description: r.description ?? '',
          updated_at: r.updated_at ?? '',
        })),
        `${t('app.master-data.units.exportFilename', {
          date: new Date().toISOString().slice(0, 10),
        })}.xlsx`,
        {
          columns: [
            { key: 'code', title: t('app.master-data.units.code') },
            { key: 'name', title: t('app.master-data.units.name') },
            { key: 'sort_order', title: t('app.master-data.units.sortOrder') },
            { key: 'is_active', title: t('app.master-data.units.status') },
            { key: 'is_system', title: t('app.master-data.units.isSystem') },
            { key: 'description', title: t('app.master-data.units.description') },
            { key: 'updated_at', title: t('common.updatedAt') },
          ],
        },
      );
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.exportFailed'));
    }
  };

  const handleConversionExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedKeys?: React.Key[],
    pageData?: MaterialUnitConversion[],
  ) => {
    try {
      let exportData: MaterialUnitConversion[] = [];
      if (type === 'selected' && selectedKeys?.length && pageData) {
        exportData = pageData.filter((item) => selectedKeys.includes(item.uuid));
      } else if (type === 'currentPage' && pageData) {
        exportData = pageData;
      } else {
        exportData = await fetchAllListItems((p) =>
          materialUnitApi.listConversions({ ...p, ...lastConvListParamsRef.current }),
        );
      }
      if (!exportData.length) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      await downloadRecordsAsXlsx(
        exportData.map((r) => ({
          from_unit_code: r.from_unit_code,
          to_unit_code: r.to_unit_code,
          numerator: r.numerator,
          denominator: r.denominator,
          formula: `1 ${r.from_unit_code} = ${r.numerator}/${r.denominator} ${r.to_unit_code}`,
          is_active: r.is_active ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled'),
          is_system: r.is_system ? t('app.master-data.units.isSystem') : '',
          description: r.description ?? '',
          updated_at: r.updated_at ?? '',
        })),
        `${t('app.master-data.units.conversionExportFilename', {
          date: new Date().toISOString().slice(0, 10),
        })}.xlsx`,
        {
          columns: [
            { key: 'from_unit_code', title: t('app.master-data.units.fromUnit') },
            { key: 'to_unit_code', title: t('app.master-data.units.toUnit') },
            { key: 'numerator', title: t('app.master-data.units.numerator') },
            { key: 'denominator', title: t('app.master-data.units.denominator') },
            { key: 'formula', title: t('app.master-data.units.formula') },
            { key: 'is_active', title: t('app.master-data.units.status') },
            { key: 'is_system', title: t('app.master-data.units.isSystem') },
            { key: 'description', title: t('app.master-data.units.description') },
            { key: 'updated_at', title: t('common.updatedAt') },
          ],
        },
      );
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.exportFailed'));
    }
  };

  const unitColumns: ProColumns<MaterialUnit>[] = useMemo(
    () => [
      {
        title: t('app.master-data.units.code'),
        dataIndex: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        // @ts-expect-error UniTable defaultShow：列设置可再打开
        defaultShow: false,
      },
      {
        title: t('app.master-data.units.name'),
        dataIndex: 'name',
        width: 150,
        minWidth: 150,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        fixed: 'left',
      },
      {
        title: t('app.master-data.units.sortOrder'),
        dataIndex: 'sort_order',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.master-data.units.isSystem'),
        dataIndex: 'is_system',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.is_system ? renderMasterTypeMarker(t('app.master-data.units.isSystem')) : '-',
      },
      {
        title: t('app.master-data.units.status'),
        dataIndex: 'is_active',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        valueEnum: {
          true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
          false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
        },
        render: (_, r) => renderMasterActiveTag(t, r.is_active, 'app.master-data.plants.enabled', 'app.master-data.plants.disabled'),
      },
      {
        title: t('app.master-data.units.description'),
        dataIndex: 'description',
        ellipsis: true,
        hideInSearch: true,
      },
      ...masterCrudCreatedUpdatedSnakeColumns<MaterialUnit>(t),
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        width: 160,
        render: (_, record) => (
          <Space>
            {perms.canUpdate ? (
              <Button
                key="edit"
                {...rowActionKind('update')}
                size="small"
                icon={<EditOutlined />}
                onClick={async () => {
                  setUnitEditingUuid(record.uuid);
                  setUnitModalOpen(true);
                  const detail = await materialUnitApi.get(record.uuid);
                  unitFormRef.current?.setFieldsValue(detail);
                }}
              >
                {t('field.customField.edit')}
              </Button>
            ) : null}
            {perms.canDelete ? (
              <Popconfirm
                key="delete"
                {...rowActionKind('delete')}
                title={
                  record.is_system
                    ? t('app.master-data.units.systemCannotDelete')
                    : t('common.confirmDelete')
                }
                disabled={record.is_system}
                onConfirm={async () => {
                  if (record.is_system) return;
                  await materialUnitApi.delete(record.uuid);
                  invalidateMaterialUnitDisplayMapCache();
                  messageApi.success(t('common.deleteSuccess'));
                  unitActionRef.current?.reload();
                }}
              >
                <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={record.is_system}>
                  {t('field.customField.delete')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [t, perms.canUpdate, perms.canDelete, messageApi],
  );

  const convColumns: ProColumns<MaterialUnitConversion>[] = useMemo(
    () => [
      {
        title: t('app.master-data.units.formula'),
        dataIndex: 'from_unit_code',
        hideInSearch: true,
        render: (_, r) =>
          `1 ${r.from_unit_code} = ${r.numerator}/${r.denominator} ${r.to_unit_code}`,
      },
      {
        title: t('app.master-data.units.fromUnit'),
        dataIndex: 'from_unit_code',
        width: 120,
        hideInTable: true,
      },
      {
        title: t('app.master-data.units.toUnit'),
        dataIndex: 'to_unit_code',
        width: 120,
        hideInTable: true,
      },
      {
        title: t('app.master-data.units.isSystem'),
        dataIndex: 'is_system',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.is_system ? renderMasterTypeMarker(t('app.master-data.units.isSystem')) : '-',
      },
      {
        title: t('app.master-data.units.status'),
        dataIndex: 'is_active',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        valueEnum: {
          true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
          false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
        },
        render: (_, r) => renderMasterActiveTag(t, r.is_active, 'app.master-data.plants.enabled', 'app.master-data.plants.disabled'),
      },
      {
        title: t('app.master-data.units.description'),
        dataIndex: 'description',
        ellipsis: true,
        hideInSearch: true,
      },
      ...masterCrudCreatedUpdatedSnakeColumns<MaterialUnitConversion>(t),
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        width: 160,
        render: (_, record) => (
          <Space>
            {perms.canUpdate ? (
              <Button
                key="edit"
                {...rowActionKind('update')}
                size="small"
                icon={<EditOutlined />}
                onClick={async () => {
                  await loadUnitOptions();
                  setConvEditingUuid(record.uuid);
                  setConvModalOpen(true);
                  convFormRef.current?.setFieldsValue(record);
                }}
              >
                {t('field.customField.edit')}
              </Button>
            ) : null}
            {perms.canDelete ? (
              <Popconfirm
                key="delete"
                {...rowActionKind('delete')}
                title={
                  record.is_system
                    ? t('app.master-data.units.systemCannotDelete')
                    : t('common.confirmDelete')
                }
                disabled={record.is_system}
                onConfirm={async () => {
                  if (record.is_system) return;
                  await materialUnitApi.deleteConversion(record.uuid);
                  messageApi.success(t('common.deleteSuccess'));
                  convActionRef.current?.reload();
                }}
              >
                <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={record.is_system}>
                  {t('field.customField.delete')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [t, perms.canUpdate, perms.canDelete, messageApi, loadUnitOptions],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={(key) => setActiveTabKey(key as TabKey)}
        preserveMounted
        tabBarExtraContent={
          perms.canCreate ? (
            <Button type="default" loading={presetLoading} onClick={() => void handleLoadPreset()}>
              {t('app.master-data.units.loadPreset')}
            </Button>
          ) : null
        }
        tabs={[
          {
            key: 'units',
            label: t('app.master-data.units.tabUnits'),
            children: (
              <UniTable<MaterialUnit>
                columnPersistenceId="apps.master-data.pages.materials.units.catalog.list-v1"
                permissionResource="master-data:material-unit"
                actionRef={unitActionRef}
                rowKey="uuid"
                columns={alignProColumns(unitColumns, MASTER_DATA_LIST_FIELD_RANK)}
                headerTitle={t('app.master-data.units.tabUnits')}
                showCreateButton={perms.canCreate}
                createButtonText={withSingleNewShortcutHint(t('app.master-data.units.createTitle'))}
                onCreate={openCreateUnit}
                showImportButton
                onImport={handleUnitImport}
                importHeaders={unitImportTemplate.importHeaders}
                importExampleRow={unitImportTemplate.importExampleRow}
                importColumnOptions={unitImportTemplate.importColumnOptions}
                importFieldMap={unitImportTemplate.importHeaderMap}
                importTemplateName={t('app.master-data.units.tabUnits')}
                showExportButton
                onExport={handleUnitExport}
                request={async (params, sort) => {
                  try {
                    const sortKey = sort ? Object.keys(sort)[0] : undefined;
                    const listParams = {
                      keyword: params.keyword || params.code || params.name,
                      is_active:
                        params.is_active === true || params.is_active === false
                          ? params.is_active
                          : params.is_active === 'true'
                            ? true
                            : params.is_active === 'false'
                              ? false
                              : undefined,
                      sort_by: sortKey,
                      sort_order: sortKey
                        ? sort[sortKey] === 'ascend'
                          ? 'asc'
                          : 'desc'
                        : undefined,
                    };
                    lastUnitListParamsRef.current = listParams as Record<
                      string,
                      string | number | boolean | undefined
                    >;
                    const res = await materialUnitApi.list({
                      skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                      limit: params.pageSize || 20,
                      ...listParams,
                    });
                    return { data: res.items, success: true, total: res.total };
                  } catch (e: any) {
                    messageApi.error(e?.message || t('app.master-data.units.listFailed'));
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
          {
            key: 'conversions',
            label: t('app.master-data.units.tabConversions'),
            children: (
              <UniTable<MaterialUnitConversion>
                columnPersistenceId="apps.master-data.pages.materials.units.conversions.list-v1"
                permissionResource="master-data:material-unit"
                actionRef={convActionRef}
                rowKey="uuid"
                columns={alignProColumns(convColumns, MASTER_DATA_LIST_FIELD_RANK)}
                headerTitle={t('app.master-data.units.tabConversions')}
                showCreateButton={perms.canCreate}
                createButtonText={withSingleNewShortcutHint(
                  t('app.master-data.units.createConversionTitle'),
                )}
                onCreate={() => void openCreateConversion()}
                showImportButton
                onImport={handleConversionImport}
                importHeaders={conversionImportTemplate.importHeaders}
                importExampleRow={conversionImportTemplate.importExampleRow}
                importColumnOptions={conversionImportTemplate.importColumnOptions}
                importFieldMap={conversionImportTemplate.importHeaderMap}
                importTemplateName={t('app.master-data.units.tabConversions')}
                showExportButton
                onExport={handleConversionExport}
                request={async (params) => {
                  try {
                    const listParams = {
                      keyword: params.keyword || params.from_unit_code || params.to_unit_code,
                      is_active:
                        params.is_active === true || params.is_active === false
                          ? params.is_active
                          : params.is_active === 'true'
                            ? true
                            : params.is_active === 'false'
                              ? false
                              : undefined,
                    };
                    lastConvListParamsRef.current = listParams as Record<
                      string,
                      string | number | boolean | undefined
                    >;
                    const res = await materialUnitApi.listConversions({
                      skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                      limit: params.pageSize || 20,
                      ...listParams,
                    });
                    return { data: res.items, success: true, total: res.total };
                  } catch (e: any) {
                    messageApi.error(e?.message || t('app.master-data.units.conversionListFailed'));
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
        ]}
      />

      <FormModalTemplate
        title={
          unitEditingUuid
            ? t('app.master-data.units.editTitle')
            : t('app.master-data.units.createTitle')
        }
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        formRef={unitFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
        onFinish={async (values) => {
          try {
            const name = String(values.name ?? '').trim();
            if (!name) {
              messageApi.error(t('app.master-data.units.nameRequired'));
              return false;
            }
            if (unitEditingUuid) {
              await materialUnitApi.update(unitEditingUuid, {
                name,
                is_active: values.is_active,
                sort_order: values.sort_order,
                description: values.description,
              });
            } else {
              await materialUnitApi.create({
                code: name,
                name,
                is_active: values.is_active ?? true,
                sort_order: values.sort_order ?? 0,
                description: values.description,
              });
            }
            messageApi.success(t('common.saveSuccess'));
            invalidateMaterialUnitDisplayMapCache();
            setUnitModalOpen(false);
            unitActionRef.current?.reload();
            void loadUnitOptions();
            return true;
          } catch (e: any) {
            messageApi.error(e?.message || t('common.saveFailed'));
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label={t('app.master-data.units.name')}
          rules={[{ required: true, message: t('app.master-data.units.nameRequired') }]}
          extra={
            unitEditingUuid ? undefined : t('app.master-data.units.codeFollowsNameHint')
          }
        />
        <ProFormDigit name="sort_order" label={t('app.master-data.units.sortOrder')} min={0} />
        <ProFormSwitch name="is_active" label={t('app.master-data.units.status')} />
        <ProFormTextArea name="description" label={t('app.master-data.units.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={
          convEditingUuid
            ? t('app.master-data.units.editConversionTitle')
            : t('app.master-data.units.createConversionTitle')
        }
        open={convModalOpen}
        onClose={() => setConvModalOpen(false)}
        formRef={convFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
        onFinish={async (values) => {
          try {
            if (convEditingUuid) {
              await materialUnitApi.updateConversion(convEditingUuid, {
                numerator: values.numerator,
                denominator: values.denominator,
                is_active: values.is_active,
                description: values.description,
              });
            } else {
              await materialUnitApi.createConversion({
                from_unit_code: values.from_unit_code,
                to_unit_code: values.to_unit_code,
                numerator: values.numerator,
                denominator: values.denominator,
                is_active: values.is_active ?? true,
                description: values.description,
              });
            }
            messageApi.success(t('common.saveSuccess'));
            setConvModalOpen(false);
            convActionRef.current?.reload();
            return true;
          } catch (e: any) {
            messageApi.error(e?.message || t('common.saveFailed'));
            return false;
          }
        }}
      >
        {!convEditingUuid ? (
          <>
            <SafeProFormSelect
              name="from_unit_code"
              label={t('app.master-data.units.fromUnit')}
              options={unitOptions}
              rules={[{ required: true, message: t('app.master-data.units.fromRequired') }]}
              fieldProps={{ showSearch: true }}
            />
            <SafeProFormSelect
              name="to_unit_code"
              label={t('app.master-data.units.toUnit')}
              options={unitOptions}
              rules={[{ required: true, message: t('app.master-data.units.toRequired') }]}
              fieldProps={{ showSearch: true }}
              extra={t('app.master-data.units.formulaHint')}
            />
          </>
        ) : null}
        <ProFormDigit
          name="numerator"
          label={t('app.master-data.units.numerator')}
          min={1}
          rules={[{ required: true, message: t('app.master-data.units.factorRequired') }]}
        />
        <ProFormDigit
          name="denominator"
          label={t('app.master-data.units.denominator')}
          min={1}
          rules={[{ required: true, message: t('app.master-data.units.factorRequired') }]}
        />
        <ProFormSwitch name="is_active" label={t('app.master-data.units.status')} />
        <ProFormTextArea name="description" label={t('app.master-data.units.description')} />
      </FormModalTemplate>
    </>
  );
};

export default UnitsPage;
