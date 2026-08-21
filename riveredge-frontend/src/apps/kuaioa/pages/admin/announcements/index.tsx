import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
} from '../../../services/announcements';
import { buildOaAnnouncementStatusEnum } from '../../../utils/oaFormEnums';

const AnnouncementsPage: React.FC = () => {
  const { t } = useTranslation();
  const statusEnum = useMemo(() => buildOaAnnouncementStatusEnum(t), [t]);
  const scopeOptions = useMemo(
    () => [
      { label: t('app.kuaioa.announcement.scopeAll'), value: 'all' },
      { label: t('app.kuaioa.announcement.scopeDepartment'), value: 'department' },
    ],
    [t],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.announcement.createButton"
      resource="kuaioa:announcement"
      codeField="announcement_code"
      nameField="title"
      autoGenerateCode
      statusEnum={statusEnum}
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getAnnouncement}
      fields={[
        { name: 'announcement_code', labelKey: 'app.kuaioa.announcement.code', width: 150 },
        { name: 'title', labelKey: 'app.kuaioa.announcement.title', required: true, width: 220 },
        {
          name: 'scope_type',
          labelKey: 'app.kuaioa.announcement.scope',
          width: 100,
          type: 'select',
          options: scopeOptions,
        },
        {
          name: 'effective_at',
          labelKey: 'app.kuaioa.announcement.effectiveAt',
          width: 160,
          type: 'datetime',
          hideInTable: true,
        },
        {
          name: 'expires_at',
          labelKey: 'app.kuaioa.announcement.expiresAt',
          width: 160,
          type: 'datetime',
          hideInTable: true,
        },
        { name: 'publisher_name', labelKey: 'app.kuaioa.announcement.publisher', width: 100 },
        {
          name: 'published_at',
          labelKey: 'app.kuaioa.announcement.publishedAt',
          width: 160,
          type: 'datetime',
        },
        {
          name: 'content',
          labelKey: 'app.kuaioa.announcement.content',
          hideInTable: true,
          required: true,
          type: 'textarea',
        },
        {
          name: 'scope_department',
          labelKey: 'app.kuaioa.announcement.scopeDepartment',
          hideInTable: true,
        },
        { name: 'is_pinned', labelKey: 'app.kuaioa.announcement.pinned', width: 80, type: 'switch' },
        { name: 'status', labelKey: 'common.status', width: 100 },
      ]}
      listFn={listAnnouncements}
      createFn={createAnnouncement}
      updateFn={updateAnnouncement}
      deleteFn={deleteAnnouncement}
      extraActions={[
        {
          key: 'publish',
          labelKey: 'app.kuaioa.announcement.publish',
          visible: (r) => r.status === 'draft',
          onClick: async (r) => {
            await publishAnnouncement(Number(r.id));
          },
        },
      ]}
    />
  );
};

export default AnnouncementsPage;
