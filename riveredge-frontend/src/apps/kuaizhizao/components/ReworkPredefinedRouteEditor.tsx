/**
 * 预设返工路线：原工单工序明细表 + 勾选纳入 + 排序
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Space, Table, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export type ReworkRouteOperationRow = {
  id: number;
  sequence?: number;
  operation_code?: string;
  operation_name?: string;
  workshop_name?: string;
  standard_time?: number;
};

export interface ReworkPredefinedRouteEditorProps {
  value?: number[];
  onChange?: (ids: number[]) => void;
  operations: ReworkRouteOperationRow[];
}

const ReworkPredefinedRouteEditor: React.FC<ReworkPredefinedRouteEditorProps> = ({
  value,
  onChange,
  operations,
}) => {
  const { t } = useTranslation();
  const selectedIds = value ?? [];

  const sortedOperations = useMemo(
    () => [...operations].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [operations],
  );

  const toggleOperation = useCallback(
    (opId: number, checked: boolean) => {
      if (checked) {
        if (selectedIds.includes(opId)) return;
        onChange?.([...selectedIds, opId]);
        return;
      }
      onChange?.(selectedIds.filter((id) => id !== opId));
    },
    [onChange, selectedIds],
  );

  const moveOperation = useCallback(
    (opId: number, direction: 'up' | 'down') => {
      const index = selectedIds.indexOf(opId);
      if (index < 0) return;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= selectedIds.length) return;
      const next = [...selectedIds];
      [next[index], next[target]] = [next[target], next[index]];
      onChange?.(next);
    },
    [onChange, selectedIds],
  );

  const columns = useMemo<ColumnsType<ReworkRouteOperationRow>>(
    () => [
      {
        title: t('app.kuaizhizao.reworkOrder.predefinedRouteSeq'),
        width: 56,
        align: 'center',
        render: (_: unknown, row) => {
          const routeIndex = selectedIds.indexOf(row.id);
          return routeIndex >= 0 ? routeIndex + 1 : '-';
        },
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colOperationSequence'),
        dataIndex: 'sequence',
        width: 56,
        align: 'center',
        render: (seq: number | undefined) => seq ?? '-',
      },
      {
        title: t('app.kuaizhizao.workOrder.colCodeShort'),
        dataIndex: 'operation_code',
        width: 80,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colOperationName'),
        dataIndex: 'operation_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.colWorkshop'),
        dataIndex: 'workshop_name',
        width: 72,
        ellipsis: true,
        render: (name: string | undefined) => name || '-',
      },
      {
        title: t('common.actions'),
        width: 120,
        align: 'center',
        render: (_: unknown, row) => {
          const routeIndex = selectedIds.indexOf(row.id);
          const included = routeIndex >= 0;
          return (
            <Space size={2} className="rework-predefined-route-editor__actions">
              <Checkbox
                checked={included}
                onChange={(e) => toggleOperation(row.id, e.target.checked)}
              >
                {t('app.kuaizhizao.reworkOrder.predefinedRouteInclude')}
              </Checkbox>
              {included ? (
                <>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowUpOutlined />}
                    title={t('app.kuaizhizao.reworkOrder.moveUp')}
                    disabled={routeIndex <= 0}
                    onClick={() => moveOperation(row.id, 'up')}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowDownOutlined />}
                    title={t('app.kuaizhizao.reworkOrder.moveDown')}
                    disabled={routeIndex >= selectedIds.length - 1}
                    onClick={() => moveOperation(row.id, 'down')}
                  />
                </>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [moveOperation, selectedIds, t, toggleOperation],
  );

  return (
    <div className="rework-predefined-route-editor">
      <Typography.Text type="secondary" className="rework-predefined-route-editor__hint">
        {t('app.kuaizhizao.reworkOrder.predefinedRouteHint')}
      </Typography.Text>
      <Table<ReworkRouteOperationRow>
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={sortedOperations}
        columns={columns}
        tableLayout="fixed"
        scroll={{ y: 200 }}
      />
    </div>
  );
};

export default ReworkPredefinedRouteEditor;
