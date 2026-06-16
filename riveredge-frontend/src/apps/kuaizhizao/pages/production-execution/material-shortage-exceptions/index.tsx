/**
 * 缺料异常处理页面
 *
 * 提供缺料异常处理功能，包括预警列表、替代物料推荐等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ShoppingOutlined, SwapOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { materialApi } from '../../../../master-data/services/material';

const P = 'app.kuaizhizao.productionException';

/**
 * 缺料异常接口定义
 */
interface MaterialShortageException {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  shortage_quantity?: number;
  available_quantity?: number;
  required_quantity?: number;
  alert_level?: string;
  status?: string;
  alternative_material_id?: number;
  alternative_material_code?: string;
  alternative_material_name?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  created_at?: string;
}

/**
 * 缺料异常处理页面组件
 */
const MaterialShortageExceptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<MaterialShortageException | null>(null);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [materialList, setMaterialList] = useState<any[]>([]);
  const handleFormRef = useRef<any>(null);

  const alertLevelLabel = useCallback(
    (level?: string) => {
      const map: Record<string, string> = {
        critical: t(`${P}.alertLevel.critical`),
        high: t(`${P}.alertLevel.high`),
        medium: t(`${P}.alertLevel.medium`),
        low: t(`${P}.alertLevel.low`),
      };
      return level ? (map[level] ?? level) : '-';
    },
    [t],
  );

  const statusLabel = useCallback(
    (status?: string) => {
      const map: Record<string, string> = {
        pending: t(`${P}.status.pending`),
        processing: t(`${P}.status.processing`),
        resolved: t(`${P}.status.resolved`),
        cancelled: t(`${P}.status.cancelled`),
      };
      return status ? (map[status] ?? status) : '-';
    },
    [t],
  );

  const suggestedActionLabel = useCallback(
    (action?: string) => {
      const map: Record<string, string> = {
        purchase: t(`${P}.suggestedAction.purchase`),
        substitute: t(`${P}.suggestedAction.substitute`),
        adjust: t(`${P}.suggestedAction.adjust`),
      };
      return action ? (map[action] ?? action) : '-';
    },
    [t],
  );

  const handleModalTitle = useMemo(() => {
    const map: Record<string, string> = {
      purchase: t(`${P}.materialShortage.modal.handlePurchase`),
      substitute: t(`${P}.materialShortage.modal.handleSubstitute`),
      resolve: t(`${P}.materialShortage.modal.handleResolve`),
      cancel: t(`${P}.materialShortage.modal.handleCancel`),
    };
    return map[currentAction] ?? t(`${P}.materialShortage.modal.handleDefault`);
  }, [currentAction, t]);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaterialShortageException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materials = await materialApi.list({ isActive: true });
        setMaterialList(materials);
      } catch (error) {
        console.error('获取物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  const openHandleModal = (record: MaterialShortageException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
    setTimeout(() => {
      handleFormRef.current?.resetFields();
    }, 100);
  };

  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.recordNotFound`));
      }

      const params: any = {
        action: currentAction,
      };

      if (currentAction === 'substitute' && values.alternativeMaterialId) {
        params.alternative_material_id = values.alternativeMaterialId;
      }

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      const handled = await apiRequest<{
        scheduling_deep_link?: string;
        scheduling_notice?: string;
      }>(`/apps/kuaizhizao/exceptions/material-shortage/${currentRecord.id}/handle`, {
        method: 'POST',
        params,
      });
      if (handled?.scheduling_deep_link) {
        messageApi.success(
          <span>
            {handled.scheduling_notice || t(`${P}.message.handleSuccess`)}，
            <a href={handled.scheduling_deep_link}>{t(`${P}.message.goToVisualScheduling`)}</a>
          </span>
        );
      } else {
        messageApi.success(t(`${P}.message.handleSuccess`));
      }
      setHandleModalVisible(false);
      setCurrentRecord(null);
      setCurrentAction('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.message.handleFailed`));
      throw error;
    }
  };

  const columns: ProColumns<MaterialShortageException>[] = useMemo(() => [
    {
      title: t(`${P}.col.workOrderCode`),
      dataIndex: 'work_order_code',
      width: 140,
      fixed: 'left',
    },
    {
      title: t(`${P}.col.material`),
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, record) => (
        <MaterialStackedCell
          material_name={record.material_name}
          material_code={record.material_code}
        />
      ),
    },
    { title: t(`${P}.col.materialCode`), dataIndex: 'material_code', hideInTable: true },
    { title: t(`${P}.col.materialName`), dataIndex: 'material_name', hideInTable: true },
    {
      title: t(`${P}.col.requiredQty`),
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t(`${P}.col.availableQty`),
      dataIndex: 'available_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t(`${P}.col.shortageQty`),
      dataIndex: 'shortage_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {record.shortage_quantity}
        </span>
      ),
    },
    {
      title: t(`${P}.col.alertLevel`),
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: {
        low: { text: t(`${P}.alertLevel.low`), status: 'default' },
        medium: { text: t(`${P}.alertLevel.medium`), status: 'warning' },
        high: { text: t(`${P}.alertLevel.high`), status: 'error' },
        critical: { text: t(`${P}.alertLevel.critical`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: t(`${P}.status.pending`), status: 'default' },
        processing: { text: t(`${P}.status.processing`), status: 'processing' },
        resolved: { text: t(`${P}.status.resolved`), status: 'success' },
        cancelled: { text: t(`${P}.status.cancelled`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.suggestedAction`),
      dataIndex: 'suggested_action',
      width: 100,
      valueEnum: {
        purchase: { text: t(`${P}.suggestedAction.purchase`), status: 'processing' },
        substitute: { text: t(`${P}.suggestedAction.substitute`), status: 'warning' },
        adjust: { text: t(`${P}.suggestedAction.adjust`), status: 'default' },
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.actions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            {t('common.detail')}
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<ShoppingOutlined />}
                onClick={() => openHandleModal(record, 'purchase')}
              >
                {t(`${P}.action.purchase`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => openHandleModal(record, 'substitute')}
              >
                {t(`${P}.action.substitute`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openHandleModal(record, 'resolve')}
              >
                {t(`${P}.action.resolve`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => openHandleModal(record, 'cancel')}
                danger
              >
                {t(`${P}.action.cancel`)}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ], [t]);

  return (
    <ListPageTemplate>
      <UniTable
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.material-shortage-exceptions"
        headerTitle={t(`${P}.materialShortage.pageTitle`)}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/exceptions/material-shortage', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                alert_level: params.alert_level,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch {
            messageApi.error(t(`${P}.message.fetchListFailed`));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showAdvancedSearch={true}
      />

      <DetailDrawerTemplate
        title={t(`${P}.materialShortage.detailTitle`, { code: currentRecord?.work_order_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code}</p>
              <p><strong>{t(`${P}.col.materialCode`)}:</strong> {currentRecord.material_code}</p>
              <p><strong>{t(`${P}.col.materialName`)}:</strong> {currentRecord.material_name}</p>
              <p><strong>{t(`${P}.col.requiredQty`)}:</strong> {currentRecord.required_quantity}</p>
              <p><strong>{t(`${P}.col.availableQty`)}:</strong> {currentRecord.available_quantity}</p>
              <p><strong>{t(`${P}.col.shortageQty`)}:</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.shortage_quantity}
                </span>
              </p>
              <p><strong>{t(`${P}.col.alertLevel`)}:</strong>
                <Tag color={
                  currentRecord.alert_level === 'critical' ? 'red' :
                    currentRecord.alert_level === 'high' ? 'orange' :
                      currentRecord.alert_level === 'medium' ? 'gold' : 'default'
                }>
                  {alertLevelLabel(currentRecord.alert_level)}
                </Tag>
              </p>
              <p><strong>{t(`${P}.col.status`)}:</strong>
                <Tag color={
                  currentRecord.status === 'resolved' ? 'success' :
                    currentRecord.status === 'processing' ? 'processing' :
                      currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {statusLabel(currentRecord.status)}
                </Tag>
              </p>
              <p><strong>{t(`${P}.col.suggestedAction`)}:</strong> {suggestedActionLabel(currentRecord.suggested_action)}</p>
              {currentRecord.alternative_material_name && (
                <p><strong>{t(`${P}.field.alternativeMaterial`)}:</strong> {currentRecord.alternative_material_name}</p>
              )}
              {currentRecord.handled_by_name && (
                <>
                  <p><strong>{t(`${P}.field.handler`)}:</strong> {currentRecord.handled_by_name}</p>
                  <p><strong>{t(`${P}.field.handledAt`)}:</strong> {currentRecord.handled_at}</p>
                </>
              )}
            </div>
          ) : null
        }
      />

      <FormModalTemplate
        title={handleModalTitle}
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentRecord(null);
          setCurrentAction('');
          handleFormRef.current?.resetFields();
        }}
        onFinish={handleException}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code}</p>
              <p><strong>{t(`${P}.col.materialName`)}:</strong> {currentRecord.material_name}</p>
              <p><strong>{t(`${P}.col.shortageQty`)}:</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.shortage_quantity}
                </span>
              </p>
            </div>
            {currentAction === 'substitute' && (
              <ProFormSelect
                name="alternativeMaterialId"
                label={t(`${P}.field.alternativeMaterial`)}
                placeholder={t(`${P}.materialShortage.placeholder.alternativeMaterial`)}
                options={materialList
                  .filter(m => m.id !== currentRecord.material_id)
                  .map(material => ({
                    label: `${material.code || material.mainCode} - ${material.name}`,
                    value: material.id,
                  }))}
                rules={[{ required: true, message: t(`${P}.materialShortage.validation.alternativeMaterialRequired`) }]}
                fieldProps={{
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            )}
            <ProFormTextArea
              name="remarks"
              label={t(`${P}.field.remarks`)}
              placeholder={t(`${P}.placeholder.handleRemarksOptional`)}
              fieldProps={{
                rows: 4,
              }}
            />
          </>
        )}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MaterialShortageExceptionsPage;
