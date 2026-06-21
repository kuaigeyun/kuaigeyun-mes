import React, { useMemo } from 'react';

import { Tooltip, theme } from 'antd';

import { CheckOutlined } from '@ant-design/icons';

import {

  buildWorkOrderOperationStepSlots,

  type WorkOrderOperationStep,

} from '../workOrderOperationSteps';



export interface WorkOrderOperationStepsStripProps {

  steps?: WorkOrderOperationStep[] | null;

  slotCount?: number;

  compact?: boolean;

}



export function WorkOrderOperationStepsStrip({

  steps,

  slotCount = 5,

  compact = true,

}: WorkOrderOperationStepsStripProps) {

  const { token } = theme.useToken();

  const slots = useMemo(

    () => buildWorkOrderOperationStepSlots(steps ?? [], slotCount),

    [steps, slotCount],

  );



  if (!slots.length) {

    return null;

  }



  const nodeSize = compact ? 28 : 32;

  const progressFontSize = compact ? 10 : 11;

  const labelFontSize = compact ? 11 : 12;

  const labelGap = compact ? 2 : 4;

  const doneColor = token.colorSuccess;

  const activeColor = token.colorPrimary;

  const pendingBorder = token.colorBorderSecondary;

  const labelDim = token.colorTextSecondary;

  const labelActive = token.colorPrimary;

  const labelDone = token.colorSuccess;

  const nodeBg = token.colorBgContainer;



  const renderNode = (step: WorkOrderOperationStep | undefined, placeholder: boolean) => {

    const isDone = step?.status === 'done';

    const isActive = step?.status === 'active';

    const isPending = step?.status === 'pending';

    const borderColor = placeholder

      ? pendingBorder

      : isPending

        ? pendingBorder

        : isDone

          ? doneColor

          : activeColor;



    return (

      <div

        style={{

          position: 'relative',

          zIndex: 1,

          width: nodeSize,

          height: nodeSize,

          borderRadius: '50%',

          background: isDone ? doneColor : nodeBg,

          border: `2px solid ${borderColor}`,

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

          boxSizing: 'border-box',

          flexShrink: 0,

        }}

      >

        {placeholder ? null : isDone ? (

          <CheckOutlined style={{ color: '#fff', fontSize: compact ? 12 : 14 }} />

        ) : isActive ? (

          <span

            style={{

              color: activeColor,

              fontSize: progressFontSize,

              fontWeight: 700,

              lineHeight: 1,

              whiteSpace: 'nowrap',

            }}

          >

            {step!.progress}%

          </span>

        ) : null}

      </div>

    );

  };



  return (

    <div

      style={{

        width: '100%',

        minWidth: compact ? 180 : 260,

        padding: compact ? '2px 4px 0' : '4px 8px 0',

      }}

    >

      <div

        style={{

          position: 'relative',

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'space-between',

          height: nodeSize,

          marginBottom: labelGap,

        }}

      >

        <div

          aria-hidden

          style={{

            position: 'absolute',

            left: nodeSize / 2,

            right: nodeSize / 2,

            top: '50%',

            transform: 'translateY(-50%)',

            height: 1,

            background: token.colorBorderSecondary,

            zIndex: 0,

          }}

        />

        {slots.map(({ key, step, placeholder }) => {

          const node = renderNode(step, placeholder);

          return (

            <div

              key={key}

              style={{

                position: 'relative',

                zIndex: 1,

                flex: 1,

                display: 'flex',

                justifyContent: 'center',

                minWidth: 0,

              }}

            >

              {!placeholder && step ? (

                <Tooltip title={`${step.name}${step.status === 'active' ? ` · ${step.progress}%` : ''}`}>

                  {node}

                </Tooltip>

              ) : (

                node

              )}

            </div>

          );

        })}

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>

        {slots.map(({ key, step, placeholder }) => {

          const isDone = step?.status === 'done';

          const isActive = step?.status === 'active';

          const isPending = step?.status === 'pending';

          const label = placeholder ? '—' : step!.name;

          const labelColor = placeholder

            ? 'transparent'

            : isPending

              ? labelDim

              : isActive

                ? labelActive

                : isDone

                  ? labelDone

                  : labelDim;



          return (

            <span

              key={key}

              title={placeholder ? undefined : step?.name}

              style={{

                flex: 1,

                minWidth: 0,

                fontSize: labelFontSize,

                color: labelColor,

                textAlign: 'center',

                whiteSpace: 'nowrap',

                overflow: 'hidden',

                textOverflow: 'ellipsis',

                userSelect: 'none',

                lineHeight: 1.2,

              }}

            >

              {label}

            </span>

          );

        })}

      </div>

    </div>

  );

}



export default WorkOrderOperationStepsStrip;


