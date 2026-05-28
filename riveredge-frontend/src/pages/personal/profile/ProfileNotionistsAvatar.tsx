import React, { useMemo, useState } from 'react';
import { Avatar } from 'antd';
import type { AvatarProps } from 'antd';
import { getAvatarFontSize, getAvatarText } from '../../../utils/avatar';
import {
  PROFILE_AVATAR_USE_NOTIONISTS,
  buildNotionistsAvatarUrl,
  resolveProfileAvatarSeed,
} from '../../../utils/generatedAvatar';

export type ProfileNotionistsAvatarProps = {
  size: number;
  uploadedSrc?: string;
  fullName?: string;
  username?: string;
  profileUuid?: string;
  email?: string;
  style?: AvatarProps['style'];
};

/**
 * 个人资料头像：优先上传图；无上传且开启 Notionists 时显示生成人物头像；否则首字母。
 */
export const ProfileNotionistsAvatar: React.FC<ProfileNotionistsAvatarProps> = ({
  size,
  uploadedSrc,
  fullName,
  username,
  profileUuid,
  email,
  style,
}) => {
  const [generatedFailed, setGeneratedFailed] = useState(false);

  const generatedSrc = useMemo(() => {
    if (uploadedSrc || !PROFILE_AVATAR_USE_NOTIONISTS || generatedFailed) {
      return undefined;
    }
    const seed = resolveProfileAvatarSeed({ uuid: profileUuid, username, email });
    return buildNotionistsAvatarUrl(seed, size * 2);
  }, [uploadedSrc, profileUuid, username, email, size, generatedFailed]);

  const displaySrc = uploadedSrc || generatedSrc;
  const showInitials = !displaySrc;

  return (
    <Avatar
      size={size}
      src={displaySrc}
      onError={() => {
        if (!uploadedSrc && generatedSrc) {
          setGeneratedFailed(true);
        }
      }}
      style={{
        ...style,
        ...(showInitials ? { backgroundColor: style?.backgroundColor } : undefined),
        ...(displaySrc && !uploadedSrc ? { backgroundColor: 'transparent' } : undefined),
      }}
    >
      {showInitials ? getAvatarText(fullName, username) : null}
    </Avatar>
  );
};
