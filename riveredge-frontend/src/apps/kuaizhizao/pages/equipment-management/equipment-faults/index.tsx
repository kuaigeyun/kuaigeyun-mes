import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备故障维修管理页面
 *
 * 提供设备故障和维修记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持故障记录、维修流程、维修记录、故障分析等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormSelect,
  ProFormDatePicker,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Tag, Modal, Row, Col, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getEquipmentFaultLifecycle } from '../../../utils/equipmentLifecycle';
import { equipmentFaultApi, equipmentApi } from '../../../services/equipment';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const P = 'app.kuaizhizao.equipmentFault';

const FAULT_STATUS_KEYS: Record<string, string> = {
  '待处理': `${P}.status.pending`,
  '处理中': `${P}.status.processing`,
  '已修复': `${P}.status.repaired`,
  '已关闭': `${P}.status.closed`,
};

const FAULT_LEVEL_KEYS: Record<string, { key: string; color: string }> = {
  轻微: { key: `${P}.level.minor`, color: 'default' },
  一般: { key: `${P}.level.normal`, color: 'warning' },
  严重: { key: `${P}.level.severe`, color: 'error' },
};

const FAULT_STATUS_COLORS: Record<string, string> = {
  '待处理': 'default',
  '处理中': 'processing',
  '已修复': 'success',
  '已关闭': 'default',
};

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
      content = (col.render as (dom: React.ReactNode, entity: T, i: number) => React.ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderFaultRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

interface EquipmentFault {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  fault_no?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  fault_date?: string;
  fault_type?: string;
  fault_level?: string;
  fault_description?: string;
  status?: string;
  repair_required?: boolean;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
}

const EquipmentFaultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const faultDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑故障记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFault, setCurrentFault] = useState<EquipmentFault | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [faultDetail, setFaultDetail] = useState<EquipmentFault | null>(null);

  const [faultTrackingRefreshKey, setFaultTrackingRefreshKey] = useState(0);

  const faultTracking = useDocumentTracking(
    drawerVisible && faultDetail?.id ? 'equipment_fault' : undefined,
    faultDetail?.id,
    faultTrackingRefreshKey,
  );

  // 创建维修记录 Modal 状态
  const [repairModalVisible, setRepairModalVisible] = useState(false);
  const [repairFault, setRepairFault] = useState<EquipmentFault | null>(null);
  const repairFormRef = useRef<any>(null);

  /**
   * 处理新建故障记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFault(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t(`${P}.create`)),
    [t],
  );

  /**
   * 处理编辑故障记录
   */
  const handleEdit = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setIsEdit(true);
      setCurrentFault(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_uuid: detail.equipment_uuid,
          fault_date: detail.fault_date ? dayjs(detail.fault_date) : null,
          fault_type: detail.fault_type,
          fault_level: detail.fault_level,
          fault_description: detail.fault_description,
          status: detail.status,
          repair_required: detail.repair_required,
          attachments: mapAttachmentsToUploadList(detail.attachments),
        });
      }, 100);
    } catch (error) {
      messageApi.error(t(`${P}.detailFailed`));
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setFaultDetail(detail);
      setDrawerVisible(true);
      setFaultTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error(t(`${P}.detailFailed`));
    }
  };

  /**
   * 处理批量删除故障记录（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t(`${P}.batchDeleteTitle`),
      content: t(`${P}.batchDeleteContent`, { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await equipmentFaultApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          if (faultDetail?.uuid && keys.map(String).includes(String(faultDetail.uuid))) {
            setDrawerVisible(false);
            setFaultDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        fault_date: values.fault_date ? values.fault_date.format('YYYY-MM-DD') : null,
        attachments: normalizeDocumentAttachments(values.attachments),
      };

      const editedUuid = isEdit ? currentFault?.uuid : undefined;
      if (isEdit && editedUuid) {
        await equipmentFaultApi.update(editedUuid, submitData);
        messageApi.success(t(`${P}.updateSuccess`));
      } else {
        await equipmentFaultApi.create(submitData);
        messageApi.success(t(`${P}.createSuccess`));
      }
      setModalVisible(false);
      setCurrentFault(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
      if (editedUuid && faultDetail?.uuid === editedUuid) {
        try {
          const fresh = await equipmentFaultApi.get(editedUuid);
          setFaultDetail(fresh);
          setFaultTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  /**
   * 打开创建维修记录 Modal
   */
  const handleCreateRepair = (record: EquipmentFault) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error(t(`${P}.incompleteInfo`));
      return;
    }
    setRepairFault(record);
    setRepairModalVisible(true);
    setTimeout(() => {
      repairFormRef.current?.setFieldsValue({
        repair_date: dayjs(),
        repair_type: '现场维修',
        repair_description: t(`${P}.repairDescriptionTemplate`, {
          faultNo: record.fault_no,
          description: record.fault_description || '',
        }),
        status: '进行中',
      });
    }, 100);
  };

  /**
   * 提交创建维修记录
   */
  const handleRepairSubmit = async (values: any) => {
    if (!repairFault?.uuid || !repairFault?.equipment_uuid) return;
    try {
      await equipmentFaultApi.createRepair({
        equipment_uuid: repairFault.equipment_uuid,
        equipment_fault_uuid: repairFault.uuid,
        repair_date: values.repair_date?.format?.('YYYY-MM-DD HH:mm:ss') ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        repair_type: values.repair_type ?? '现场维修',
        repair_description: values.repair_description ?? '',
        status: values.status ?? '进行中',
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.repairCreated`));
      setRepairModalVisible(false);
      setRepairFault(null);
      repairFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<EquipmentFault>[] = useMemo(
    () => [
    {
      title: t(`${P}.col.faultNo`),
      dataIndex: 'fault_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }}>{r.fault_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentCode`),
      dataIndex: 'equipment_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
    },
    {
      title: t(`${P}.col.faultDate`),
      dataIndex: 'fault_date',
      valueType: 'date',
    },
    {
      title: t(`${P}.col.faultType`),
      dataIndex: 'fault_type',
    },
    {
      title: t(`${P}.col.faultLevel`),
      dataIndex: 'fault_level',
      render: (_, record) => {
        const level = record.fault_level;
        const config = level ? FAULT_LEVEL_KEYS[level] : undefined;
        if (!config) return <Tag>{level || '-'}</Tag>;
        return <Tag color={config.color}>{t(config.key)}</Tag>;
      },
    },
    {
      title: t(`${P}.col.faultDescription`),
      dataIndex: 'fault_description',
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const key = status ? FAULT_STATUS_KEYS[status] : undefined;
        const text = key ? t(key) : (status || '-');
        const color = status ? (FAULT_STATUS_COLORS[status] || 'default') : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: t(`${P}.col.repairRequired`),
      dataIndex: 'repair_required',
      render: (_, record) => (
        <Tag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? t(`${P}.yes`) : t(`${P}.no`)}
        </Tag>
      ),
    },
    {
      title: t(`${P}.col.createdAt`),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
    ],
    [t]
  );

  const renderFaultRowNodes = (record: EquipmentFault): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        {t('common.detail')}
      </Button>,
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        {t('common.edit')}
      </Button>,
      <Button {...rowActionKind('delete')}
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: t(`${P}.deleteTitle`),
            content: t(`${P}.deleteContent`, { code: record.fault_no }),
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        {t('common.delete')}
      </Button>,
    ];
    if (record.repair_required && record.status !== '已修复') {
      nodes.push(
        <Button {...rowActionKind('update')} key="repair" onClick={(e) => {
          e.stopPropagation();
          handleCreateRepair(record);
        }}
        >
          {t(`${P}.action.createRepair`)}
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<EquipmentFault>[] = useMemo(() => [
    {
      title: t(`${P}.col.faultNo`),
      dataIndex: 'fault_no',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }} ellipsis>
          {r.fault_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentCode`),
      dataIndex: 'equipment_code',
      width: 140,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
          {r.equipment_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t(`${P}.col.faultDate`),
      dataIndex: 'fault_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: t(`${P}.col.faultType`),
      dataIndex: 'fault_type',
      width: 120,
    },
    {
      title: t(`${P}.col.faultLevel`),
      dataIndex: 'fault_level',
      width: 100,
      render: (_, record) => {
        const level = record.fault_level;
        const config = level ? FAULT_LEVEL_KEYS[level] : undefined;
        if (!config) return <Tag>{level || '-'}</Tag>;
        return <Tag color={config.color}>{t(config.key)}</Tag>;
      },
    },
    {
      title: t(`${P}.col.repairRequired`),
      dataIndex: 'repair_required',
      width: 100,
      render: (_, record) => (
        <Tag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? t(`${P}.yes`) : t(`${P}.no`)}
        </Tag>
      ),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t(`${P}.col.lifecycle`),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getEquipmentFaultLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderFaultRowActions(renderFaultRowNodes(record), `flt-${record.uuid ?? 'row'}`),
    },
  ], [t]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentFault>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-faults"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentFaultApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error(t(`${P}.listFailed`));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          scroll={{ x: 1900 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑故障记录 Modal */}
      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentFault(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="equipment_uuid"
              label={t(`${P}.form.equipment`)}
              placeholder={t(`${P}.form.selectEquipment`)}
              request={async () => {
                try {
                  const response = await equipmentApi.list({ limit: 1000 });
                  return (response.items || []).map((eq: any) => ({
                    label: `${eq.code} - ${eq.name}`,
                    value: eq.uuid,
                  }));
                } catch (error) {
                  return [];
                }
              }}
              rules={[{ required: true, message: t(`${P}.form.selectEquipment`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="fault_date"
              label={t(`${P}.col.faultDate`)}
              placeholder={t(`${P}.form.selectFaultDate`)}
              rules={[{ required: true, message: t(`${P}.form.selectFaultDate`) }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="fault_type"
              label={t(`${P}.col.faultType`)}
              placeholder={t(`${P}.form.selectFaultType`)}
              options={[
                { label: t(`${P}.faultType.mechanical`), value: '机械故障' },
                { label: t(`${P}.faultType.electrical`), value: '电气故障' },
                { label: t(`${P}.faultType.software`), value: '软件故障' },
                { label: t(`${P}.faultType.other`), value: '其他' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectFaultType`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="fault_level"
              label={t(`${P}.col.faultLevel`)}
              placeholder={t(`${P}.form.selectFaultLevel`)}
              options={[
                { label: t(`${P}.level.minor`), value: '轻微' },
                { label: t(`${P}.level.normal`), value: '一般' },
                { label: t(`${P}.level.severe`), value: '严重' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectFaultLevel`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_fault_attachments" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="fault_description"
              label={t(`${P}.form.faultDescription`)}
              placeholder={t(`${P}.form.faultDescriptionPlaceholder`)}
              rules={[{ required: true, message: t(`${P}.form.faultDescriptionPlaceholder`) }]}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t(`${P}.col.status`)}
              placeholder={t(`${P}.form.selectStatus`)}
              options={[
                { label: t(`${P}.status.pending`), value: '待处理' },
                { label: t(`${P}.status.processing`), value: '处理中' },
                { label: t(`${P}.status.repaired`), value: '已修复' },
                { label: t(`${P}.status.closed`), value: '已关闭' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectStatus`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_required"
              label={t(`${P}.col.repairRequired`)}
              placeholder={t(`${P}.form.selectRepairRequired`)}
              options={[
                { label: t(`${P}.yes`), value: true },
                { label: t(`${P}.no`), value: false },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairRequired`) }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 创建维修记录 Modal */}
      <FormModalTemplate
        title={t(`${P}.repairModal`)}
        open={repairModalVisible}
        onClose={() => {
          setRepairModalVisible(false);
          setRepairFault(null);
          repairFormRef.current?.resetFields();
        }}
        onFinish={handleRepairSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={repairFormRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="repair_date"
              label={t(`${P}.form.repairDate`)}
              placeholder={t(`${P}.form.selectRepairDate`)}
              rules={[{ required: true, message: t(`${P}.form.selectRepairDate`) }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_type"
              label={t(`${P}.form.repairType`)}
              placeholder={t(`${P}.form.selectRepairType`)}
              options={[
                { label: t(`${P}.repairType.onSite`), value: '现场维修' },
                { label: t(`${P}.repairType.returnFactory`), value: '返厂维修' },
                { label: t(`${P}.repairType.outsource`), value: '委外维修' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairType`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_repair_attachments" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="repair_description"
              label={t(`${P}.form.repairDescription`)}
              placeholder={t(`${P}.form.repairDescriptionPlaceholder`)}
              rules={[{ required: true, message: t(`${P}.form.repairDescriptionPlaceholder`) }]}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t(`${P}.form.repairStatus`)}
              placeholder={t(`${P}.form.selectRepairStatus`)}
              options={[
                { label: t(`${P}.repairStatus.inProgress`), value: '进行中' },
                { label: t(`${P}.repairStatus.completed`), value: '已完成' },
                { label: t(`${P}.repairStatus.cancelled`), value: '已取消' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairStatus`) }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 故障记录详情 Drawer */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={drawerVisible}
        zIndex={faultDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setFaultDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={faultDetail || undefined}
        customContent={
          faultDetail ? (
            <>
              <DetailDrawerSection title={t(`${P}.section.basicInfo`)}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(faultDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.lifecycle`)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getEquipmentFaultLifecycle(faultDetail as Record<string, unknown>, t);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {faultDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='equipment_fault'
                      documentId={faultDetail.id}
                      active={drawerVisible}
                      selfDocumentId={faultDetail.id}
                      renderBriefActions={(doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setFaultDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.detailInfo`)}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noDetailLines`)} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.operationHistory`)}>
                {faultTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {faultTracking.error && !faultTracking.loading && (
                  <Typography.Text type="danger">{faultTracking.error}</Typography.Text>
                )}
                {faultTracking.data && !faultTracking.loading && (
                  <DocumentTrackingTimelineBody data={faultTracking.data} />
                )}
                {!faultTracking.loading && !faultTracking.data && !faultTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </>
  );
};

export default EquipmentFaultsPage;

