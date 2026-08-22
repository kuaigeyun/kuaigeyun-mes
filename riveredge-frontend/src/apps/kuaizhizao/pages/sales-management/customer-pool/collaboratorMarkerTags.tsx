import React from 'react';
import { Space, Tooltip } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';

export type CollaboratorMarkerItem = {
  user_id: number;
  user_name: string;
};

/** 协作人非状态徽章色（filled，与状态 solid 区分） */
const COLLABORATOR_MARKER_COLOR = 'geekblue';

const MAX_VISIBLE_COLLABORATORS = 2;

export function CollaboratorMarkerTags({ collaborators }: { collaborators: CollaboratorMarkerItem[] }) {
  if (!collaborators.length) return null;

  const visible = collaborators.slice(0, MAX_VISIBLE_COLLABORATORS);
  const rest = collaborators.length - visible.length;
  const allNames = collaborators.map((item) => item.user_name).join('、');

  const badges = (
    <Space size={4} wrap>
      {visible.map((item) => (
        <MarkerTag key={item.user_id} color={COLLABORATOR_MARKER_COLOR}>
          {item.user_name}
        </MarkerTag>
      ))}
      {rest > 0 ? <MarkerTag color={COLLABORATOR_MARKER_COLOR}>+{rest}</MarkerTag> : null}
    </Space>
  );

  if (collaborators.length <= MAX_VISIBLE_COLLABORATORS) {
    return badges;
  }

  return (
    <Tooltip title={allNames}>
      <span style={{ display: 'inline-block', maxWidth: '100%' }}>{badges}</span>
    </Tooltip>
  );
}
