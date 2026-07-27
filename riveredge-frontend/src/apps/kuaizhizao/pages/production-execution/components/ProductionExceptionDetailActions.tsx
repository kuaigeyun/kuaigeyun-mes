import React from 'react';
import { Button, Space } from 'antd';
import type { TFunction } from 'i18next';
import { SwapOutlined } from '@ant-design/icons';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
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

  if (canCreate8D) {
    buttons.push(
      <Button
        key={`${keyPrefix}-start8d`}
        {...rowActionKind('create')}
        {...rowActionLabelKeep()}
        onClick={onStart8D}
      >
        {t(`${Q}.action.start8D`)}
      </Button>,
    );
  }

  return buttons;
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

export function hasQualityExceptionActions(
  record: QualityExceptionDetailRecord,
  canCreate8D: boolean,
): boolean {
  return (
    record.status === 'pending'
    || record.status === 'investigating'
    || record.status === 'correcting'
    || canCreate8D
  );
}
