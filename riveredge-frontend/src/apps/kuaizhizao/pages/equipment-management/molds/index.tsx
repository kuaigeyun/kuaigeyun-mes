/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Space, message, Modal, Tabs, Table, Form, Input, InputNumber, Descriptions, DatePicker, Select, Row, Col, Typography, Spin, theme as AntdTheme, Empty } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getMoldAssetLifecycle } from '../../../utils/equipmentLifecycle';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

const MOLD_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_molds';

interface Mold {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  status?: string;
  is_active?: boolean;
  description?: string;
  total_usage_count?: number;
  cavity_count?: number;
  design_lifetime?: number;
  maintenance_interval?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface MoldUsage {
  uuid?: string;
  usage_no?: string;
  source_type?: string;
  source_no?: string;
  usage_date?: string;
  usage_count?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
}

interface MoldCalibration {
  uuid?: string;
  mold_uuid?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
}

const MoldsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const moldImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.mold.import.code', aliases: ['模具编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.mold.import.name', aliases: ['模具名称', '名称'] },
          { field: 'type', labelKey: 'app.kuaizhizao.mold.import.type', aliases: ['模具类型', '类型'] },
          { field: 'category', labelKey: 'app.kuaizhizao.mold.import.category', aliases: ['模具分类', '分类'] },
          { field: 'brand', labelKey: 'app.kuaizhizao.mold.import.brand', aliases: ['品牌'] },
          { field: 'model', labelKey: 'app.kuaizhizao.mold.import.model', aliases: ['型号'] },
        ],
        [
          t('app.kuaizhizao.mold.importExample.code'),
          t('app.kuaizhizao.mold.importExample.name'),
          t('app.kuaizhizao.mold.importExample.type'),
          t('app.kuaizhizao.mold.importExample.category'),
          t('app.kuaizhizao.mold.importExample.brand'),
          t('app.kuaizhizao.mold.importExample.model'),
        ],
      ),
    [t, i18n.language],
  );
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const moldDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [moldDetail, setMoldDetail] = useState<Mold | null>(null);

  const [moldTrackingRefreshKey, setMoldTrackingRefreshKey] = useState(0);

  const moldTracking = useDocumentTracking(
    drawerVisible && moldDetail?.id ? 'mold' : undefined,
    moldDetail?.id,
    moldTrackingRefreshKey,
  );

  // 使用记录相关状态
  const [usages, setUsages] = useState<MoldUsage[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [usageForm] = Form.useForm();

  // 校验记录相关状态
  const [calibrations, setCalibrations] = useState<MoldCalibration[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const {
    customFields: moldFormCustomFields,
    customFieldValues: moldFormCustomFieldValues,
    loadFieldValues: loadMoldFormFieldValues,
    extractFormValues: extractMoldFormValues,
    saveCustomFieldValues: saveMoldCustomFieldValues,
    resetFieldValues: resetMoldFormFieldValues,
  } = useCustomFields({ tableName: MOLD_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: moldListCustomFields,
    generateCustomFieldColumns: generateMoldCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichMoldRecordsWithCustomFields,
    customFieldValues: moldDetailCustomFieldValues,
    loadFieldValuesForDetail: loadMoldFieldValuesForDetail,
    resetDetailFieldValues: resetMoldDetailFieldValues,
  } = useCustomFieldsForList<Mold>({ tableName: MOLD_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (moldListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [moldListCustomFields.length]);

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMold(null);
    setFormInitialValues(undefined);
    resetMoldFormFieldValues();
    setModalVisible(true);
  };

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setIsEdit(true);
      setCurrentMold(detail);
      const fieldFormValues =
        detail.id != null ? await loadMoldFormFieldValues(detail.id) : {};
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
        installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
        warranty_period: detail.warranty_period,
        status: detail.status,
        is_active: detail.is_active,
        cavity_count: detail.cavity_count,
        design_lifetime: detail.design_lifetime,
        description: detail.description,
        ...fieldFormValues,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 加载模具使用记录
   */
  const loadUsages = async (moldUuid: string) => {
    setUsagesLoading(true);
    try {
      const res = await moldApi.listUsages({ mold_uuid: moldUuid, limit: 100 });
      setUsages(res.items || []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };

  /**
   * 加载模具校验记录
   */
  const loadCalibrations = async (moldUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await moldApi.listCalibrations({ mold_uuid: moldUuid, limit: 100 });
      setCalibrations(res.items || []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setMoldDetail(detail);
      setDrawerVisible(true);
      loadUsages(record.uuid);
      loadCalibrations(record.uuid);
      setMoldTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadMoldFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 新建使用记录
   */
  const handleCreateUsage = () => {
    if (!moldDetail?.uuid) return;
    usageForm.resetFields();
    usageForm.setFieldsValue({
      mold_uuid: moldDetail.uuid,
      usage_date: dayjs(),
      usage_count: 1,
      status: '使用中',
    });
    setUsageModalVisible(true);
  };

  /**
   * 新建校验记录
   */
  const handleRecordCalibration = () => {
    if (!moldDetail?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ mold_uuid: moldDetail.uuid, calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  /**
   * 提交校验记录
   */
  const handleSubmitCalibration = async () => {
    try {
      const moldUuid = moldDetail?.uuid;
      if (!moldUuid) {
        messageApi.error('未选择模具');
        return;
      }
      const values = await calibForm.validateFields();
      const data = {
        mold_uuid: moldUuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
      };
      await moldApi.createCalibration(data);
      messageApi.success('校验记录已保存');
      setCalibModalVisible(false);
      if (moldDetail?.uuid) {
        loadCalibrations(moldDetail.uuid);
        const detail = await moldApi.get(moldDetail.uuid);
        setMoldDetail(detail);
        setMoldTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  /**
   * 提交使用记录
   */
  const handleSubmitUsage = async () => {
    try {
      const values = await usageForm.validateFields();
      const data = {
        mold_uuid: moldDetail!.uuid,
        source_type: values.source_type,
        source_no: values.source_no,
        usage_date: values.usage_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.usage_date,
        usage_count: values.usage_count ?? 1,
        operator_name: values.operator_name,
        status: values.status || '使用中',
      };
      await moldApi.createUsage(data);
      messageApi.success('使用记录创建成功');
      setUsageModalVisible(false);
      if (moldDetail?.uuid) {
        loadUsages(moldDetail.uuid);
        setMoldTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '创建失败');
    }
  };

  /**
   * 处理批量删除模具（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条模具吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await moldApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          if (moldDetail?.uuid && keys.map(String).includes(String(moldDetail.uuid))) {
            setDrawerVisible(false);
            setMoldDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractMoldFormValues(values);
      const submitData = {
        ...standardValues,
        purchase_date: standardValues.purchase_date ? standardValues.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: standardValues.installation_date ? standardValues.installation_date.format('YYYY-MM-DD') : null,
        cavity_count: standardValues.cavity_count ?? null,
        design_lifetime: standardValues.design_lifetime ?? null,
      };

      const editedUuid = isEdit ? currentMold?.uuid : undefined;
      if (isEdit && editedUuid) {
        await moldApi.update(editedUuid, submitData);
        messageApi.success('模具更新成功');
        const updated = await moldApi.get(editedUuid);
        if (updated?.id != null) {
          await saveMoldCustomFieldValues(updated.id, customData);
        }
      } else {
        const created = await moldApi.create(submitData);
        if (created?.id != null) {
          await saveMoldCustomFieldValues(created.id, customData);
        }
        messageApi.success('模具创建成功');
      }
      setModalVisible(false);
      setCurrentMold(null);
      formRef.current?.resetFields();
      resetMoldFormFieldValues();
      actionRef.current?.reload();
      if (editedUuid && moldDetail?.uuid === editedUuid) {
        try {
          const fresh = await moldApi.get(editedUuid);
          setMoldDetail(fresh);
          loadUsages(editedUuid);
          loadCalibrations(editedUuid);
          setMoldTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<Mold>[] = [
    {
      title: '模具编号',
      dataIndex: 'code',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
    },
    {
      title: '模具类型',
      dataIndex: 'type',
    },
    {
      title: '模具分类',
      dataIndex: 'category',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
    },
    {
      title: '型号',
      dataIndex: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: '安装日期',
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: '保修期（月）',
      dataIndex: 'warranty_period',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '使用中': { text: '使用中', color: 'processing' },
          '维护中': { text: '维护中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '腔数（模数）',
      dataIndex: 'cavity_count',
    },
    {
      title: '设计寿命（次）',
      dataIndex: 'design_lifetime',
    },
    {
      title: '累计使用次数',
      dataIndex: 'total_usage_count',
    },
    {
      title: '保养间隔（次）',
      dataIndex: 'maintenance_interval',
    },
    {
      title: '需要校验',
      dataIndex: 'needs_calibration',
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '校验周期（天）',
      dataIndex: 'calibration_period',
    },
    {
      title: '上次校验日期',
      dataIndex: 'last_calibration_date',
      valueType: 'date',
    },
    {
      title: '下次校验日期',
      dataIndex: 'next_calibration_date',
      valueType: 'date',
    },
    {
      title: '描述',
      dataIndex: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<Mold>[] = useMemo(() => {
    const customFieldColumns = generateMoldCustomFieldColumns();
    return [
    {
      title: '模具编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '模具名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '模具类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '模具分类',
      dataIndex: 'category',
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '累计使用次数',
      dataIndex: 'total_usage_count',
      width: 110,
    },
    {
      title: '寿命进度',
      dataIndex: ['total_usage_count', 'design_lifetime'],
      width: 100,
      render: (_: any, record: Mold) => {
        const total = record.total_usage_count ?? 0;
        const lifetime = record.design_lifetime;
        if (!lifetime || lifetime <= 0) return '-';
        const pct = Math.round((total / lifetime) * 100);
        if (pct >= 100) return <Tag color="error">{pct}%</Tag>;
        if (pct >= 90) return <Tag color="warning">{pct}%</Tag>;
        return `${pct}%`;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    ...customFieldColumns,
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMoldAssetLifecycle(record as Record<string, unknown>);
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
      width: 180,
      fixed: 'right',
      render: (_text, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              void handleDetail(record);
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              void handleEdit(record);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除模具"${record.name}"吗？`,
                onOk: () => record.uuid && handleDelete([record.uuid]),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
  }, [moldListCustomFields, generateMoldCustomFieldColumns, t, navigate]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Mold>
          headerTitle="模具管理"
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.molds"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params) => {
            try {
              const response = await moldApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              const enriched = await enrichMoldRecordsWithCustomFields(response.items || []);
              return {
                data: enriched,
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取模具列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText="新建模具"
          onCreate={handleCreate}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入数据为空或格式不正确');
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              moldImportTemplate.importHeaderMap,
            );
            if (headerIndexMap.name === undefined) {
              messageApi.error('导入表头需包含模具名称');
              return;
            }
            const items: any[] = [];
            const importRows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            for (const row of importRows) {
              const name = String(row[headerIndexMap.name] ?? '').trim();
              if (!name) continue;
              items.push({
                code:
                  headerIndexMap.code !== undefined
                    ? String(row[headerIndexMap.code] ?? '').trim() || undefined
                    : undefined,
                name,
                type:
                  headerIndexMap.type !== undefined
                    ? String(row[headerIndexMap.type] ?? '').trim() || undefined
                    : undefined,
                category:
                  headerIndexMap.category !== undefined
                    ? String(row[headerIndexMap.category] ?? '').trim() || undefined
                    : undefined,
                brand:
                  headerIndexMap.brand !== undefined
                    ? String(row[headerIndexMap.brand] ?? '').trim() || undefined
                    : undefined,
                model:
                  headerIndexMap.model !== undefined
                    ? String(row[headerIndexMap.model] ?? '').trim() || undefined
                    : undefined,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => moldApi.create(item),
              title: '导入模具',
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(`成功导入 ${result.successCount} 条模具`);
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(`部分失败 ${result.failureCount} 条`);
            }
          }}
          importHeaders={moldImportTemplate.importHeaders}
          importExampleRow={moldImportTemplate.importExampleRow}
          importFieldMap={moldImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await moldApi.list({ skip: 0, limit: 10000 });
              let items = (res as any)?.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `molds-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          scroll={{ x: 2000 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑模具 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑模具' : '新建模具'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentMold(null);
          resetMoldFormFieldValues();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-equipment-management-mold"
              name="code"
              label="模具编号"
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="模具名称"
              placeholder="请输入模具名称"
              rules={[{ required: true, message: '请输入模具名称' }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_TYPE"
              name="type"
              label="模具类型"
              placeholder="请选择模具类型"
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="category" label="模具分类" placeholder="请输入模具分类" />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label="品牌" placeholder="请输入品牌" />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label="型号" placeholder="请输入型号" />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label="序列号" placeholder="请输入序列号" />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label="制造商" placeholder="请输入制造商" />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label="供应商" placeholder="请输入供应商" />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label="采购日期"
              placeholder="请选择采购日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label="安装日期"
              placeholder="请选择安装日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label="保修期（月）"
              placeholder="请输入保修期（月）"
              min={0}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_STATUS"
              name="status"
              label="模具状态"
              placeholder="请选择模具状态"
              required={true}
              rules={[{ required: true, message: '请选择模具状态' }]}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="cavity_count"
              label="腔数（模数）"
              placeholder="一次成型产出件数"
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="design_lifetime"
              label="设计寿命（次）"
              placeholder="模具设计寿命，用于寿命预警"
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={24}>
            <CustomFieldsFormSection
              customFields={moldFormCustomFields}
              customFieldValues={moldFormCustomFieldValues}
              gridColumns={2}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label="描述"
              placeholder="请输入描述（可选）"
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label="是否启用" />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 模具详情 Drawer */}
      <DetailDrawerTemplate<Mold>
        title="模具详情"
        open={drawerVisible}
        zIndex={moldDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setMoldDetail(null);
          setUsages([]);
          setCalibrations([]);
          resetMoldDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={moldDetail}
        columns={detailColumns}
        customContent={
          moldDetail && (
            <>
              {hasCustomFieldsDetailContent(moldListCustomFields, moldDetailCustomFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields', { defaultValue: '自定义字段' })}>
                  <CustomFieldsDetailSection
                    customFields={moldListCustomFields}
                    customFieldValues={moldDetailCustomFieldValues}
                  />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title="生命周期">
                {moldDetail.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="mold"
                    documentId={moldDetail.id}
                    active={drawerVisible}
                    selfDocumentId={moldDetail.id}
                    renderBriefActions={(doc) => (
                      <EquipmentTraceBriefPrimaryActions
                        doc={doc}
                        t={t}
                        navigate={navigate}
                        closeDrawer={() => {
                          setDrawerVisible(false);
                          setMoldDetail(null);
                          setUsages([]);
                          setCalibrations([]);
                        }}
                      />
                    )}
                  />
                ) : null}
              </DetailDrawerSection>
            <Tabs
              defaultActiveKey="basic"
              items={[
                {
                  key: 'basic',
                  label: '基本信息',
                  children: (
                    <>
                      {moldDetail.design_lifetime && moldDetail.design_lifetime > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const threshold = moldDetail.design_lifetime * 0.9;
                        if (total >= moldDetail.design_lifetime) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>寿命已到期，请关注</Tag>;
                        }
                        if (total >= threshold) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>寿命即将到期，请关注</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.maintenance_interval && moldDetail.maintenance_interval > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const remainder = total % moldDetail.maintenance_interval;
                        const nextAt = (Math.floor(total / moldDetail.maintenance_interval) + 1) * moldDetail.maintenance_interval;
                        const left = nextAt - total;
                        if (left > 0 && left <= moldDetail.maintenance_interval * 0.2) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>即将到达保养周期（剩余 {left} 次）</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.needs_calibration && moldDetail.next_calibration_date && (() => {
                        const next = dayjs(moldDetail.next_calibration_date);
                        const now = dayjs();
                        const daysLeft = next.diff(now, 'day');
                        if (daysLeft < 0) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>校验已过期，请尽快安排校验</Tag>;
                        }
                        if (daysLeft <= 7) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>校验即将到期（{daysLeft} 天内）</Tag>;
                        }
                        return null;
                      })()}
                      <Descriptions column={2} size="small">
                        {detailColumns.map((col) => {
                          const val = (moldDetail as any)[col.dataIndex as string];
                          let content: React.ReactNode = val;
                          if (col.valueType === 'dateTime' && val) content = dayjs(val).format('YYYY-MM-DD HH:mm:ss');
                          else if (col.valueType === 'date' && val) content = dayjs(val).format('YYYY-MM-DD');
                          else if (col.render) {
                            content = (col.render as (dom: React.ReactNode, entity: Mold, i: number) => React.ReactNode)(
                              val,
                              moldDetail,
                              0,
                            );
                          }
                          return (
                            <Descriptions.Item key={String(col.dataIndex)} label={col.title as React.ReactNode}>
                              {content ?? '-'}
                            </Descriptions.Item>
                          );
                        })}
                      </Descriptions>
                    </>
                  ),
                },
                {
                  key: 'usages',
                  label: '使用记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateUsage}>
                          新建使用记录
                        </Button>
                      </div>
                      <Table<MoldUsage>
                        size="small"
                        loading={usagesLoading}
                        dataSource={usages}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          { title: '使用单号', dataIndex: 'usage_no', width: 140 },
                          { title: '来源类型', dataIndex: 'source_type', width: 100 },
                          { title: '来源单号', dataIndex: 'source_no', width: 120 },
                          {
                            title: '使用日期',
                            dataIndex: 'usage_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '使用次数', dataIndex: 'usage_count', width: 80 },
                          { title: '操作人', dataIndex: 'operator_name', width: 90 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 80,
                            render: (s) => <Tag>{s || '-'}</Tag>,
                          },
                          {
                            title: '归还日期',
                            dataIndex: 'return_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: 'calibrations',
                  label: '校验记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordCalibration}>
                          新建校验记录
                        </Button>
                      </div>
                      <Table<MoldCalibration>
                        size="small"
                        loading={calibLoading}
                        dataSource={calibrations}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          {
                            title: '校验日期',
                            dataIndex: 'calibration_date',
                            width: 120,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          {
                            title: '结果',
                            dataIndex: 'result',
                            width: 100,
                            render: (r) => <Tag>{r || '-'}</Tag>,
                          },
                          { title: '证书编号', dataIndex: 'certificate_no', width: 140 },
                          {
                            title: '有效期至',
                            dataIndex: 'expiry_date',
                            width: 120,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '备注', dataIndex: 'remark', ellipsis: true },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: 'tracking_timeline',
                  label: '操作记录',
                  children: (
                    <>
                      {moldTracking.loading && (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                          <Spin />
                        </div>
                      )}
                      {moldTracking.error && !moldTracking.loading && (
                        <Typography.Text type="danger">{moldTracking.error}</Typography.Text>
                      )}
                      {moldTracking.data && !moldTracking.loading && (
                        <DocumentTrackingTimelineBody data={moldTracking.data} />
                      )}
                      {!moldTracking.loading && !moldTracking.data && !moldTracking.error && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                      )}
                    </>
                  ),
                },
              ]}
            />
            </>
          )
        }
      />

      {/* 新建校验记录 Modal */}
      <Modal
        title="新建校验记录"
        open={calibModalVisible}
        onOk={handleSubmitCalibration}
        onCancel={() => setCalibModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="calibration_date" label="校验日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="校验结果" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '合格', value: '合格' },
                { label: '不合格', value: '不合格' },
                { label: '准用', value: '准用' },
              ]}
            />
          </Form.Item>
          <Form.Item name="certificate_no" label="证书编号">
            <Input placeholder="请输入证书编号" />
          </Form.Item>
          <Form.Item name="expiry_date" label="有效期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建使用记录 Modal */}
      <Modal
        title="新建使用记录"
        open={usageModalVisible}
        onOk={handleSubmitUsage}
        onCancel={() => setUsageModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型">
            <Select placeholder="请选择" allowClear options={[
              { label: '工单', value: 'work_order' },
              { label: '生产订单', value: 'production_order' },
              { label: '其他', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="source_no" label="来源单号">
            <Input placeholder="请输入来源单号" />
          </Form.Item>
          <Form.Item name="usage_date" label="使用日期" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="usage_count" label="使用次数" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="operator_name" label="操作人">
            <Input placeholder="请输入操作人" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { label: '使用中', value: '使用中' },
              { label: '已归还', value: '已归还' },
              { label: '已报废', value: '已报废' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MoldsPage;

