import React from 'react';
import { Button, Space } from 'antd';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import { SwapOutlined } from '@ant-design/icons';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { buildInspectionDetailPath } from '../../quality-management/components/inspectionTemplateUtils';
import type {
  DeliveryDelayExceptionDetailRecord,
  MaterialShortageExceptionDetailRecord,
  QualityExceptionDetailRecord,
} from './ProductionExceptionDetailContent';

const P = 'app.kuaizhizao.productionException';
const Q = `${P}.quality`;

type ActionHandler = (action: string) => void;

function wrapActionButtons(buttons: React.ReactNode[]): React.ReactNode | null {
  if (buttons.length === 0) return null;
  return (
    <Space wrap size={[8, 8]}>
      {buttons}
    </Space>
  );
}

export function buildMaterialShortageExceptionActionButtons({
  record,
  t,
  onAction,
  keyPrefix,
}: {
  record: MaterialShortageExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode[] {
  if (record.status !== 'pending') return [];

  return [
    <Button
      key={`${keyPrefix}-purchase`}
      {...rowActionKind('execute')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('purchase')}
    >
      {t(`${P}.action.purchase`)}
    </Button>,
    <Button
      key={`${keyPrefix}-substitute`}
      {...rowActionKind('skip')}
      {...rowActionLabelKeep()}
      icon={<SwapOutlined />}
      onClick={() => onAction('substitute')}
    >
      {t(`${P}.action.substitute`)}
    </Button>,
    <Button
      key={`${keyPrefix}-resolve`}
      {...rowActionKind('complete')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('resolve')}
    >
      {t(`${P}.action.resolve`)}
    </Button>,
    <Button
      key={`${keyPrefix}-cancel`}
      {...rowActionKind('reject')}
      onClick={() => onAction('cancel')}
    >
      {t(`${P}.action.cancel`)}
    </Button>,
  ];
}

export function renderMaterialShortageExceptionActionGroup(props: {
  record: MaterialShortageExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode | null {
  return wrapActionButtons(buildMaterialShortageExceptionActionButtons(props));
}

export function buildDeliveryDelayExceptionActionButtons({
  record,
  t,
  onAction,
  keyPrefix,
}: {
  record: DeliveryDelayExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode[] {
  if (record.status !== 'pending') return [];

  return [
    <Button
      key={`${keyPrefix}-adjust`}
      {...rowActionKind('update')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('adjust_plan')}
    >
      {t(`${P}.action.adjustPlan`)}
    </Button>,
    <Button
      key={`${keyPrefix}-resources`}
      {...rowActionKind('assign')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('increase_resources')}
    >
      {t(`${P}.action.increaseResources`)}
    </Button>,
    <Button
      key={`${keyPrefix}-expedite`}
      {...rowActionKind('execute')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('expedite')}
    >
      {t(`${P}.action.expedite`)}
    </Button>,
    <Button
      key={`${keyPrefix}-resolve`}
      {...rowActionKind('complete')}
      {...rowActionLabelKeep()}
      onClick={() => onAction('resolve')}
    >
      {t(`${P}.action.resolve`)}
    </Button>,
    <Button
      key={`${keyPrefix}-cancel`}
      {...rowActionKind('reject')}
      onClick={() => onAction('cancel')}
    >
      {t(`${P}.action.cancel`)}
    </Button>,
  ];
}

export function renderDeliveryDelayExceptionActionGroup(props: {
  record: DeliveryDelayExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode | null {
  return wrapActionButtons(buildDeliveryDelayExceptionActionButtons(props));
}

export function buildQualityExceptionHandleButtons({
  record,
  t,
  onAction,
  keyPrefix,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode[] {
  const buttons: React.ReactNode[] = [];

  if (record.status === 'pending') {
    buttons.push(
      <Button
        key={`${keyPrefix}-investigate`}
        {...rowActionKind('audit')}
        {...rowActionLabelKeep()}
        onClick={() => onAction('investigate')}
      >
        {t(`${P}.action.investigate`)}
      </Button>,
    );
  }

  if (record.status === 'investigating') {
    buttons.push(
      <Button
        key={`${keyPrefix}-correct`}
        {...rowActionKind('update')}
        {...rowActionLabelKeep()}
        onClick={() => onAction('correct')}
      >
        {t(`${P}.action.correct`)}
      </Button>,
    );
  }

  if (record.status === 'correcting') {
    buttons.push(
      <Button
        key={`${keyPrefix}-close`}
        {...rowActionKind('complete')}
        {...rowActionLabelKeep()}
        onClick={() => onAction('close')}
      >
        {t(`${P}.action.close`)}
      </Button>,
    );
  }

  if (record.status === 'pending' || record.status === 'investigating' || record.status === 'correcting') {
    buttons.push(
      <Button
        key={`${keyPrefix}-cancel`}
        {...rowActionKind('reject')}
        onClick={() => onAction('cancel')}
      >
        {t(`${P}.action.cancel`)}
      </Button>,
    );
  }

  return buttons;
}

export function buildQualityException8DButton({
  t,
  onStart8D,
  canCreate8D,
  keyPrefix,
}: {
  t: TFunction;
  onStart8D: () => void;
  canCreate8D: boolean;
  keyPrefix: string;
}): React.ReactNode[] {
  if (!canCreate8D) return [];
  return [
    <Button
      key={`${keyPrefix}-start8d`}
      {...rowActionKind('create')}
      {...rowActionLabelKeep()}
      onClick={onStart8D}
    >
      {t(`${Q}.action.start8D`)}
    </Button>,
  ];
}

export function buildQualityExceptionInspectButtons({
  record,
  t,
  navigate,
  onCloseDrawer,
  keyPrefix,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  navigate: NavigateFunction;
  onCloseDrawer: () => void;
  keyPrefix: string;
}): React.ReactNode[] {
  if (!record.inspection_record_id) return [];
  return [
    <Button
      key={`${keyPrefix}-source-inspection`}
      onClick={() => {
        const path = buildInspectionDetailPath(
          record.inspection_source_type,
          record.inspection_record_id,
        );
        if (path) {
          onCloseDrawer();
          navigate(path);
        }
      }}
    >
      {t(`${Q}.action.viewSourceInspection`)}
    </Button>,
    <Button
      key={`${keyPrefix}-nonconforming-ledger`}
      onClick={() => {
        onCloseDrawer();
        const q = new URLSearchParams();
        if (record.inspection_source_type === 'incoming_inspection') {
          q.set('incoming_inspection_id', String(record.inspection_record_id));
        } else if (record.inspection_source_type === 'process_inspection') {
          q.set('process_inspection_id', String(record.inspection_record_id));
        } else if (record.inspection_source_type === 'finished_goods_inspection') {
          q.set('finished_goods_inspection_id', String(record.inspection_record_id));
        }
        navigate(`/apps/kuaizhizao/quality-management/nonconforming-ledger?${q.toString()}`);
      }}
    >
      {t(`${Q}.action.viewNonconformingLedger`)}
    </Button>,
  ];
}

export function buildQualityExceptionActionButtons({
  record,
  t,
  onAction,
  onStart8D,
  canCreate8D,
  keyPrefix,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  onStart8D: () => void;
  canCreate8D: boolean;
  keyPrefix: string;
}): React.ReactNode[] {
  return [
    ...buildQualityExceptionHandleButtons({ record, t, onAction, keyPrefix }),
    ...buildQualityException8DButton({ t, onStart8D, canCreate8D, keyPrefix }),
  ];
}

export function renderQualityExceptionHandleGroup(props: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  keyPrefix: string;
}): React.ReactNode | null {
  return wrapActionButtons(buildQualityExceptionHandleButtons(props));
}

export function renderQualityExceptionWorkbenchExtra(props: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  navigate: NavigateFunction;
  onCloseDrawer: () => void;
  onStart8D: () => void;
  canCreate8D: boolean;
  keyPrefix: string;
}): React.ReactNode | null {
  return wrapActionButtons([
    ...buildQualityExceptionInspectButtons(props),
    ...buildQualityException8DButton(props),
  ]);
}

export function renderQualityExceptionActionGroup(props: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  onAction: ActionHandler;
  onStart8D: () => void;
  canCreate8D: boolean;
  keyPrefix: string;
}): React.ReactNode | null {
  return wrapActionButtons(buildQualityExceptionActionButtons(props));
}

export function hasMaterialShortageExceptionActions(record: MaterialShortageExceptionDetailRecord): boolean {
  return record.status === 'pending';
}

export function hasDeliveryDelayExceptionActions(record: DeliveryDelayExceptionDetailRecord): boolean {
  return record.status === 'pending';
}

export function hasQualityExceptionHandleActions(record: QualityExceptionDetailRecord): boolean {
  return (
    record.status === 'pending'
    || record.status === 'investigating'
    || record.status === 'correcting'
  );
}

export function hasQualityExceptionActions(
  record: QualityExceptionDetailRecord,
  canCreate8D: boolean,
): boolean {
  return hasQualityExceptionHandleActions(record) || canCreate8D;
}
