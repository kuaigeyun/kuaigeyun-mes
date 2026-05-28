import React, { useEffect, useState } from 'react';
import { Avatar } from 'antd';
import type { AvatarProps } from 'antd';
import { getAvatarText } from '../../../utils/avatar';

export type ProfileNotionistsAvatarProps = {
  size: number;
  /** 已上传头像 URL */
  uploadedSrc?: string;
  /** DiceBear 预览 URL（无上传时由父组件传入） */
  generatedSrc?: string;
  fullName?: string;
  username?: string;
  style?: AvatarProps['style'];
};

/**
 * 个人资料头像：优先上传图，其次生成图，否则首字母。
 */
export const ProfileNotionistsAvatar: React.FC<ProfileNotionistsAvatarProps> = ({
  size,
  uploadedSrc,
  generatedSrc,
  fullName,
  username,
  style,
}) => {
  const [generatedFailed, setGeneratedFailed] = useState(false);
  const [uploadedFailed, setUploadedFailed] = useState(false);

  useEffect(() => {
    setGeneratedFailed(false);
    setUploadedFailed(false);
  }, [uploadedSrc, generatedSrc]);

  const displaySrc =
    uploadedSrc && !uploadedFailed
      ? uploadedSrc
      : generatedFailed
        ? undefined
        : generatedSrc;
  const showInitials = !displaySrc;

  const avatarStyle: AvatarProps['style'] = showInitials
    ? style
    : {
        ...style,
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
      };

  return (
    <Avatar
      size={size}
      src={displaySrc}
      onError={() => {
        if (uploadedSrc && !uploadedFailed) {
          setUploadedFailed(true);
        } else if (generatedSrc) {
          setGeneratedFailed(true);
        }
      }}
      style={avatarStyle}
    >
      {showInitials ? getAvatarText(fullName, username) : null}
    </Avatar>
  );
};
