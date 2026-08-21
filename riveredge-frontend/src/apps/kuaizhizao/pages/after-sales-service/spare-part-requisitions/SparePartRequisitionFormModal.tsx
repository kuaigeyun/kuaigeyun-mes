import React, { useMemo, useRef, useState } from 'react';
import { App, Col, Form, Input, InputNumber, Row } from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { formatApiErrorDetail } from '../../../../../services/api';
import {
  afterSalesSparePartRequisitionApi,
  type AfterSalesSparePartRequisition,
  type AfterSalesSparePartRequisitionPayload,
} from '../../../services/after-sales-service';
import { AfterSalesSourceDocumentSelect } from '../shared/AfterSalesSourceDocumentSelect';

export type SparePartRequisitionFormModalProps = {
  open: boolean;
  editing: AfterSalesSparePartRequisition | null;
  onClose: () => void;
  onSuccess: () => void;
};

type LineForm = {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  quantity?: number;
};

const emptyLine = (): LineForm => ({ quantity: 1 });

const SparePartRequisitionFormModal: React.FC<SparePartRequisitionFormModalProps> = ({
  open,
  editing,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [submitting, setSubmitting] = useState(false);
  const sourceLocked = Boolean(editing);

  const initialValues = useMemo(() => {
    if (editing) {
      return {
        source_type: editing.source_type,
        source_id: editing.source_id,
        source_code: editing.source_code,
        warehouse_id: editing.warehouse_id ?? undefined,
        warehouse_name: editing.warehouse_name ?? undefined,
        notes: editing.notes ?? undefined,
        items:
          (editing.items ?? []).map((item) => ({
            material_id: item.material_id ?? undefined,
            material_code: item.material_code ?? undefined,
            material_name: item.material_name ?? undefined,
            material_spec: item.material_spec ?? undefined,
            material_unit: item.material_unit ?? undefined,
            quantity: Number(item.quantity) || 1,
          })) || [emptyLine()],
      };
    }
    return {
      source_type: 'repair_order',
      items: [emptyLine()],
    };
  }, [editing]);

  const handleFinish = async (values: Record<string, unknown>) => {
    const items = ((values.items as LineForm[]) || []).filter(
      (row) => row.material_id && Number(row.quantity) > 0,
    );
    if (!items.length) {
      messageApi.error(t('app.kuaizhizao.afterSalesService.sparePartRequisition.linesRequired'));
      return;
    }
    const payload: AfterSalesSparePartRequisitionPayload = {
      source_type: String(values.source_type),
      source_id: Number(values.source_id),
      source_code: String(values.source_code || ''),
      warehouse_id: values.warehouse_id != null ? Number(values.warehouse_id) : undefined,
      warehouse_name: (values.warehouse_name as string) || undefined,
      notes: (values.notes as string) || undefined,
      items: items.map((row) => ({
        material_id: Number(row.material_id),
        material_code: row.material_code,
        material_name: row.material_name,
        material_spec: row.material_spec,
        material_unit: row.material_unit,
        quantity: Number(row.quantity) || 1,
      })),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await afterSalesSparePartRequisitionApi.update(editing.id, {
          warehouse_id: payload.warehouse_id,
          warehouse_name: payload.warehouse_name,
          notes: payload.notes,
          items: payload.items,
        });
        messageApi.success(t('common.saveSuccess'));
      } else {
        await afterSalesSparePartRequisitionApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (error) {
      messageApi.error(formatApiErrorDetail(error) || t('common.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      key={editing?.id ?? 'create'}
      formRef={formRef}
      open={open}
      onClose={onClose}
      title={
        editing
          ? t('app.kuaizhizao.afterSalesService.sparePartRequisition.editTitle')
          : t('app.kuaizhizao.afterSalesService.sparePartRequisition.createTitle')
      }
      width={MODAL_CONFIG.LARGE_WIDTH}
      grid={false}
      isEdit={Boolean(editing)}
      loading={submitting}
      initialValues={initialValues}
      onFinish={handleFinish}
    >
      <Row gutter={16}>
        <Col span={24}>
          {sourceLocked ? (
            <>
              <Form.Item name="source_type" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="source_id" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="source_code" hidden>
                <Input />
              </Form.Item>
              <Form.Item label={t('app.kuaizhizao.afterSalesService.common.sourceDocument')}>
                <Input value={editing?.source_code} disabled />
              </Form.Item>
            </>
          ) : (
            <AfterSalesSourceDocumentSelect
              allowedTypes={['repair_order', 'install_execution']}
              typeLabelKeyPrefix="app.kuaizhizao.afterSalesService.dispatchOrder.field"
            />
          )}
        </Col>
        <Col span={12}>
          <Form.Item name="warehouse_name" hidden>
            <Input />
          </Form.Item>
          <UniWarehouseSelect
            name="warehouse_id"
            label={t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName')}
            required
            onChange={(_value, warehouse) => {
              formRef.current?.setFieldsValue({
                warehouse_name: warehouse?.name,
              });
            }}
          />
        </Col>
        <Col span={12}>
          <Form.Item
            name="notes"
            label={t('common.remark')}
          >
            <Input.TextArea rows={1} />
          </Form.Item>
        </Col>
      </Row>

      <UniTableDetail
        name="items"
        title={t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.items')}
        required
        requiredMessage={t('app.kuaizhizao.afterSalesService.sparePartRequisition.linesRequired')}
        addText={t('app.kuaizhizao.afterSalesService.sparePartRequisition.addLine')}
        initialValue={emptyLine()}
        columns={[
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.material'),
            dataIndex: 'material_id',
            width: 280,
            render: (_: unknown, __: unknown, index: number) => (
              <>
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  required
                  size="small"
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_spec: 'specification',
                    material_unit: 'baseUnit',
                  }}
                  formItemProps={{ style: { margin: 0 } }}
                />
                <Form.Item name={[index, 'material_code']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_name']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_spec']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_unit']} hidden>
                  <Input />
                </Form.Item>
              </>
            ),
          },
          {
            title: t('common.quantity'),
            dataIndex: 'quantity',
            width: 120,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item
                name={[index, 'quantity']}
                rules={[{ required: true, message: t('common.required') }]}
                style={{ margin: 0 }}
              >
                <InputNumber min={0.0001} style={{ width: '100%' }} size="small" />
              </Form.Item>
            ),
          },
        ]}
      />
    </FormModalTemplate>
  );
};

export default SparePartRequisitionFormModal;
