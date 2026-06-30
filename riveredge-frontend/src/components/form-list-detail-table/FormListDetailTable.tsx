/**
 * 表单明细表：Table 列头 + 行内编辑 + 复制/删除 + 底部添加按钮。
 * 视觉与交互对齐工艺路线 OperationSequenceEditor / 主数据明细表。
 */

import React, { useMemo, useState } from 'react';
import { Form, Button, Table, Space, Typography, Modal, Select, App, theme } from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { FormListFieldData } from 'antd/es/form';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../layout-templates/constants';

export interface FormListDetailColumn {
  title: React.ReactNode;
  key: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render: (field: FormListFieldData, index: number) => React.ReactNode;
}

export interface FormListBulkAddConfig {
  title: string;
  options: { label: string; value: string | number }[];
  valueField: string;
  searchPlaceholder?: string;
  /** 跳过列表中已存在的 valueField 值，默认 true */
  dedupe?: boolean;
}

export interface FormListDetailTableProps {
  name: string | (string | number)[];
  label?: React.ReactNode;
  columns: FormListDetailColumn[];
  addButtonText: string;
  defaultRow?: Record<string, unknown> | (() => Record<string, unknown>);
  minRows?: number;
  copyEnabled?: boolean;
  emptyText?: React.ReactNode;
  /** 多选批量添加；配置后点击添加按钮打开选择弹窗 */
  bulkAdd?: FormListBulkAddConfig;
  pickModalZIndex?: number;
}

function resolveDefaultRow(
  defaultRow?: Record<string, unknown> | (() => Record<string, unknown>),
): Record<string, unknown> {
  return typeof defaultRow === 'function' ? defaultRow() : { ...(defaultRow ?? {}) };
}

export const FormListDetailTable: React.FC<FormListDetailTableProps> = ({
  name,
  label,
  columns,
  addButtonText,
  defaultRow,
  minRows = 0,
  copyEnabled = true,
  emptyText,
  bulkAdd,
  pickModalZIndex,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const [pickOpen, setPickOpen] = useState(false);
  const [pickedValues, setPickedValues] = useState<Array<string | number>>([]);

  const modalZIndex = pickModalZIndex ?? token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const existingValues = useMemo(() => {
    if (!bulkAdd) return new Set<string | number>();
    const list = (form.getFieldValue(name) ?? []) as Record<string, unknown>[];
    return new Set(
      list
        .map((row) => row[bulkAdd.valueField])
        .filter((v): v is string | number => v !== undefined && v !== null && v !== ''),
    );
  }, [bulkAdd, form, name, pickOpen]);

  const availableOptions = useMemo(() => {
    if (!bulkAdd) return [];
    const dedupe = bulkAdd.dedupe !== false;
    return dedupe ? bulkAdd.options.filter((opt) => !existingValues.has(opt.value)) : bulkAdd.options;
  }, [bulkAdd, existingValues, pickOpen]);

  const openPickModal = () => {
    setPickedValues([]);
    setPickOpen(true);
  };

  const handlePickConfirm = () => {
    if (!bulkAdd) return;
    if (!pickedValues.length) {
      message.warning(t('common.bulkAddSelectRequired'));
      return;
    }
    const dedupe = bulkAdd.dedupe !== false;
    const list = [...((form.getFieldValue(name) ?? []) as Record<string, unknown>[])];
    const existSet = dedupe
      ? new Set(list.map((row) => row[bulkAdd.valueField]).filter((v) => v !== undefined && v !== null && v !== ''))
      : new Set<unknown>();
    const toAdd = pickedValues.filter((v) => !existSet.has(v));
    if (!toAdd.length) {
      message.warning(t('common.bulkAddAllExist'));
      return;
    }
    const baseDefault = resolveDefaultRow(defaultRow);
    const maxSort = list.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), -1);
    const nextList = [
      ...list,
      ...toAdd.map((value, index) => ({
        ...baseDefault,
        [bulkAdd.valueField]: value,
        ...(Object.prototype.hasOwnProperty.call(baseDefault, 'sort_order')
          ? { sort_order: maxSort + 1 + index }
          : {}),
      })),
    ];
    form.setFieldValue(name, nextList);
    setPickOpen(false);
    setPickedValues([]);
    message.success(t('common.bulkAddSuccess', { count: toAdd.length }));
  };

  const handleAddClick = () => {
    if (bulkAdd) {
      openPickModal();
      return;
    }
    const next = resolveDefaultRow(defaultRow);
    const list = (form.getFieldValue(name) ?? []) as Record<string, unknown>[];
    form.setFieldValue(name, [...list, next]);
  };

  return (
    <Form.List name={name}>
      {(fields, { add, remove }, { errors }) => {
        const tableColumns: ColumnsType<FormListFieldData> = [
          {
            title: '#',
            width: 48,
            align: 'center',
            render: (_value, _field, index) => index + 1,
          },
          ...columns.map((col) => ({
            title: col.title,
            key: col.key,
            width: col.width,
            align: col.align,
            render: (_value: unknown, field: FormListFieldData, index: number) =>
              col.render(field, index),
          })),
          {
            title: t('common.actions'),
            key: '_actions',
            width: 80,
            align: 'center' as const,
            fixed: 'right' as const,
            render: (_value, field) => (
              <Space size={0}>
                {copyEnabled ? (
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    title={t('common.copyRow')}
                    onClick={() => {
                      const list = (form.getFieldValue(name) ?? []) as Record<string, unknown>[];
                      const row = list[field.name];
                      if (row && typeof row === 'object') {
                        add({ ...row }, field.name + 1);
                      } else {
                        add({}, field.name + 1);
                      }
                    }}
                  />
                ) : null}
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  title={t('common.delete')}
                  disabled={fields.length <= minRows}
                  onClick={() => remove(field.name)}
                />
              </Space>
            ),
          },
        ];

        return (
          <div style={{ marginBottom: 16, width: '100%' }}>
            {label ? (
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                {label}
              </Typography.Text>
            ) : null}
            <Table<FormListFieldData>
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={fields}
              columns={tableColumns}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: emptyText ?? t('common.noData') }}
            />
            {errors?.length ? (
              <div style={{ marginTop: 4 }}>
                <Form.ErrorList errors={errors} />
              </div>
            ) : null}
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              style={{ marginTop: 8 }}
              onClick={handleAddClick}
            >
              {addButtonText}
            </Button>

            {bulkAdd ? (
              <Modal
                title={bulkAdd.title}
                open={pickOpen}
                zIndex={modalZIndex}
                destroyOnClose
                onCancel={() => {
                  setPickOpen(false);
                  setPickedValues([]);
                }}
                onOk={handlePickConfirm}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {t('common.bulkAddSelected', { count: pickedValues.length })}
                </Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  placeholder={bulkAdd.searchPlaceholder ?? t('common.bulkAddSearchPlaceholder')}
                  value={pickedValues}
                  options={availableOptions}
                  onChange={(vals) => setPickedValues(vals)}
                />
              </Modal>
            ) : null}
          </div>
        );
      }}
    </Form.List>
  );
};

export default FormListDetailTable;
