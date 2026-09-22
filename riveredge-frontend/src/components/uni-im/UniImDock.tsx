/**
 * UNI-IM：顶栏入口 + 右下角三栏弹窗（仿微信 PC 端，非独立路由）
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AuditOutlined,
  BellOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  CommentOutlined,
  MessageOutlined,
  MinusOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
  RollbackOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, DatePicker, Dropdown, Empty, Input, Modal, Tooltip, message as antMessage, theme } from 'antd';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useDocumentVisible } from '../../hooks/useDocumentVisible';
import { useUserAvatarUrl } from '../../hooks/useUserAvatarUrl';
import {
  isApprovalUserMessage,
  isUnreadMessage,
  looksLikeSystemNotifyTitle,
  messageSnippet,
} from '../../pages/personal/messages/messageHelpers';
import {
  getAvatarFontSize,
  getAvatarText,
  getAvatarUrl,
  getCachedAvatarUrl,
  getImageAvatarCircleStyle,
  getTextAvatarCircleStyle,
  isTextAvatarDisplay,
} from '../../utils/avatar';
import { formatDateTime } from '../../utils/format';
import { hasPermission } from '../../utils/permission';
import { ReferenceDisplayAccessError } from '../../services/displayContract';
import {
  createDirectImConversation,
  IM_BOT_SENDER_ID,
  listImConversations,
  listImMembers,
  listImMessages,
  markImConversationRead,
  recallImMessage,
  sendImMessage,
  setImConversationPinned,
  type ImConversation,
  type ImMember,
  type ImMessage,
} from '../../services/im';
import { resolveUserDisplay, searchUserDisplay, type UserDisplayItem } from '../../services/user';
import UniImCreateGroupModal from './UniImCreateGroupModal';
import UniImGroupSettingsModal from './UniImGroupSettingsModal';
import {
  getUserMessages,
  markMessagesRead,
  type UserMessage,
} from '../../services/userMessage';
import {
  getUserTasks,
  type UserTask,
} from '../../services/userTask';
import { KuAiLottieMark } from '../ai-assistant/KuAiLottieMark';
import AiAssistantMarkdown from '../ai-assistant/AiAssistantMarkdown';
import UniImKuAiChat from './UniImKuAiChat';
import {
  UniImTaskComposer,
  UniImTaskList,
  addMessageBodyToReminder,
  addMessageBodyToTodo,
  canRecallImMessage,
  completeImPersonalTask,
  filterImReminderTasks,
  filterImTodoTasks,
} from './UniImTaskPanels';
import {
  defaultImRemindAtFallback,
  extractImRemindAtFromText,
  splitImMessageBodyLinks,
} from './uniImRemindTime';
import styles from './uni-im.module.css';
import { resolveDocumentByCode } from '../../services/documentTrackingResolve';
import { useOptionalLinkedDocumentDetail } from '../linked-document-detail';
import { canOpenLinkedDocumentDetail } from '../../apps/kuaizhizao/utils/linkedDocumentDetail';

export type UniImPanelProps = {
  open: boolean;
  onClose: () => void;
  /** 是否最小化（仅显示悬浮球） */
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** 是否展示置顶 KU-AI 入口（与顶栏 AI 助手门控一致） */
  hasKuAiEntry?: boolean;
};

export type ImNavSection = 'direct' | 'group' | 'approval' | 'system' | 'todo' | 'reminder';

const NAV_SECTIONS: ImNavSection[] = ['direct', 'group', 'approval', 'system'];
const BOTTOM_NAV_SECTIONS: ImNavSection[] = ['todo', 'reminder'];

const NAV_ICONS: Record<ImNavSection, React.ReactNode> = {
  direct: <UserOutlined />,
  group: <TeamOutlined />,
  approval: <AuditOutlined />,
  system: <MessageOutlined />,
  todo: <CheckSquareOutlined />,
  reminder: <BellOutlined />,
};

const CHAT_KINDS = new Set<ImNavSection>(['direct', 'group']);
const TASK_SECTIONS = new Set<ImNavSection>(['todo', 'reminder']);

/** 默认总宽偏好；硬顶为视口 50%，加宽第二栏时第三栏在上限内让出 */
const WINDOW_BASE_WIDTH = 880;
const WINDOW_MAX_VIEWPORT_RATIO = 0.5;
const CHAT_PANE_MIN_WIDTH = 300;
const WINDOW_VIEWPORT_GUTTER = 28;
/** 第一栏固定宽度（不可拖动） */
const NAV_RAIL_WIDTH = 64;

/** 第二栏列表宽度四档（px）；拖动二/三栏分界改变第二栏与第三栏宽度 */
const LIST_PANE_WIDTH_LEVELS = [200, 240, 280, 320] as const;
const LIST_PANE_WIDTH_STORAGE_KEY = 'riveredge:uni-im:list-pane-width-level';
const DEFAULT_LIST_PANE_WIDTH_LEVEL = 1;

function readStoredWidthLevel(storageKey: string, levelCount: number, fallback: number): number {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const raw = window.localStorage.getItem(storageKey);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= levelCount) {
    return fallback;
  }
  return parsed;
}

function clampToWidthLevels(width: number, levels: readonly number[]): number {
  return Math.min(levels[levels.length - 1], Math.max(levels[0], width));
}

function snapWidthToLevelIndex(width: number, levels: readonly number[]): number {
  let bestIndex = 0;
  let bestDistance = Math.abs(width - levels[0]);
  for (let index = 1; index < levels.length; index += 1) {
    const distance = Math.abs(width - levels[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function readStoredListPaneWidthLevel(): number {
  return readStoredWidthLevel(
    LIST_PANE_WIDTH_STORAGE_KEY,
    LIST_PANE_WIDTH_LEVELS.length,
    DEFAULT_LIST_PANE_WIDTH_LEVEL,
  );
}

function formatConversationTime(value?: string | null, yesterdayLabel?: string): string {
  if (!value) {
    return '';
  }
  const d = dayjs(value);
  const now = dayjs();
  if (d.isSame(now, 'day')) {
    return d.format('HH:mm');
  }
  if (d.isSame(now.subtract(1, 'day'), 'day')) {
    return yesterdayLabel || '昨天';
  }
  if (d.isSame(now, 'year')) {
    return d.format('M/D');
  }
  return d.format('YYYY/M/D');
}

function formatUserMessageTime(item: UserMessage): string {
  const value = item.sent_at || item.created_at;
  return value ? formatDateTime(value, 'YYYY-MM-DD HH:mm') : '';
}

function isSameUserId(
  left: number | string | undefined | null,
  right: number | string | undefined | null,
): boolean {
  if (left == null || right == null) {
    return false;
  }
  return Number(left) === Number(right);
}

function resolveDirectConversationForUser(
  user: UserDisplayItem,
  directByPeerId: Map<number, ImConversation>,
): ImConversation | undefined {
  const peerId = Number(user.id);
  if (!Number.isFinite(peerId) || peerId <= 0) {
    return undefined;
  }
  return directByPeerId.get(peerId);
}

function compareDirectListOrder(
  left: { pinned: boolean; unread: number; time: number; label: string },
  right: { pinned: boolean; unread: number; time: number; label: string },
): number {
  const pinnedLeft = left.pinned ? 1 : 0;
  const pinnedRight = right.pinned ? 1 : 0;
  if (pinnedLeft !== pinnedRight) {
    return pinnedRight - pinnedLeft;
  }
  const unreadLeft = left.unread > 0 ? 1 : 0;
  const unreadRight = right.unread > 0 ? 1 : 0;
  if (unreadLeft !== unreadRight) {
    return unreadRight - unreadLeft;
  }
  if (left.time !== right.time) {
    return right.time - left.time;
  }
  return left.label.localeCompare(right.label, 'zh-CN');
}

export default function UniImPanel({
  open,
  onClose,
  minimized = false,
  onMinimizedChange,
  hasKuAiEntry = false,
}: UniImPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const currentUser = useCurrentUser();
  const documentVisible = useDocumentVisible();
  const { avatarUrl, setImageFailed, showTextAvatar } = useUserAvatarUrl(currentUser);
  const [activeSection, setActiveSection] = React.useState<ImNavSection>('direct');
  const [selectedUuid, setSelectedUuid] = React.useState<string | null>(null);
  const [selectedNotifyUuid, setSelectedNotifyUuid] = React.useState<string | null>(null);
  const [selectedKuAi, setSelectedKuAi] = React.useState(false);
  const [selectedTaskUuid, setSelectedTaskUuid] = React.useState<string | null>(null);
  const [completingTaskUuid, setCompletingTaskUuid] = React.useState<string | null>(null);
  const [addingTodoMessageUuid, setAddingTodoMessageUuid] = React.useState<string | null>(null);
  const [recallingMessageUuid, setRecallingMessageUuid] = React.useState<string | null>(null);
  const [reminderSourceMessage, setReminderSourceMessage] = React.useState<ImMessage | null>(null);
  const [reminderAt, setReminderAt] = React.useState<Dayjs | null>(null);
  const [reminderRemark, setReminderRemark] = React.useState('');
  const [reminderSaving, setReminderSaving] = React.useState(false);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const linkedDocument = useOptionalLinkedDocumentDetail();
  const [openingDocCode, setOpeningDocCode] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [contactKeyword, setContactKeyword] = React.useState('');
  const [openingUserId, setOpeningUserId] = React.useState<number | null>(null);
  const [listPaneWidthLevel, setListPaneWidthLevel] = React.useState(readStoredListPaneWidthLevel);
  const [dragListPaneWidth, setDragListPaneWidth] = React.useState<number | null>(null);
  const listPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const listPaneWidth = dragListPaneWidth ?? LIST_PANE_WIDTH_LEVELS[listPaneWidthLevel];
  const listPaneResizing = dragListPaneWidth != null;

  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : WINDOW_BASE_WIDTH + WINDOW_VIEWPORT_GUTTER,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const panelWidth = useMemo(() => {
    const columnsWidth = NAV_RAIL_WIDTH + listPaneWidth;
    const defaultColumnsWidth =
      NAV_RAIL_WIDTH + LIST_PANE_WIDTH_LEVELS[DEFAULT_LIST_PANE_WIDTH_LEVEL];
    /** 加宽第二栏时尽量保住第三栏原有余量，总宽硬顶视口 50% */
    const preferredChatWidth = Math.max(
      CHAT_PANE_MIN_WIDTH,
      WINDOW_BASE_WIDTH - defaultColumnsWidth,
    );
    const needed = columnsWidth + preferredChatWidth;
    const maxByRatio = Math.floor(viewportWidth * WINDOW_MAX_VIEWPORT_RATIO);
    const maxWidth = Math.min(maxByRatio, viewportWidth - WINDOW_VIEWPORT_GUTTER);
    return Math.min(maxWidth, needed);
  }, [listPaneWidth, viewportWidth]);

  const enabled =
    !!currentUser &&
    documentVisible &&
    hasPermission(currentUser, 'system:user-message:read');

  const canReadTasks = !!currentUser && hasPermission(currentUser, 'system:user-task:read');
  const canUpdateTasks =
    !!currentUser && hasPermission(currentUser, 'system:user-task:update');
  const isTaskSection = TASK_SECTIONS.has(activeSection);

  const { data: conversations, isLoading: convLoading } = useQuery({
    queryKey: ['imConversations'],
    queryFn: () => listImConversations({ page: 1, page_size: 50 }),
    enabled,
    staleTime: 5_000,
    refetchInterval: enabled && open ? 10_000 : false,
    refetchIntervalInBackground: false,
  });

  const {
    data: directUsersData,
    isLoading: directUsersLoading,
    isError: directUsersError,
    error: directUsersQueryError,
  } = useQuery({
    queryKey: ['imDirectContacts', contactKeyword.trim()],
    queryFn: () =>
      searchUserDisplay({
        page: 1,
        page_size: 200,
        is_active: true,
        keyword: contactKeyword.trim() || undefined,
        host_resource: 'system:user-message',
      }),
    enabled: enabled && open && activeSection === 'direct',
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ReferenceDisplayAccessError && error.status === 403) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const { data: userInbox, isLoading: userInboxLoading } = useQuery({
    queryKey: ['userInboxMessages'],
    queryFn: () => getUserMessages({ page: 1, page_size: 50 }),
    enabled: enabled && open,
    staleTime: 5_000,
    refetchInterval: enabled && open ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ['imMessages', selectedUuid],
    queryFn: () => listImMessages(selectedUuid!, { page: 1, page_size: 50 }),
    enabled: enabled && open && !!selectedUuid && activeSection !== 'system' && activeSection !== 'approval' && !isTaskSection,
    staleTime: 2_000,
    refetchInterval:
      enabled && open && !!selectedUuid && activeSection !== 'system' && activeSection !== 'approval' && !isTaskSection
        ? 5_000
        : false,
    refetchIntervalInBackground: false,
  });

  const { data: groupMembersData } = useQuery({
    queryKey: ['imMembers', selectedUuid],
    queryFn: () => listImMembers(selectedUuid!),
    enabled:
      enabled &&
      open &&
      !!selectedUuid &&
      activeSection === 'group' &&
      !isTaskSection,
    staleTime: 30_000,
  });
  const groupMembers = groupMembersData?.items ?? [];

  const { data: personalTasksData, isLoading: personalTasksLoading } = useQuery({
    queryKey: ['imPersonalTasks'],
    queryFn: () => getUserTasks({ page: 1, page_size: 100 }),
    enabled: enabled && open && canReadTasks && isTaskSection,
    staleTime: 5_000,
    refetchInterval: enabled && open && canReadTasks && isTaskSection ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  const items = conversations?.items ?? [];
  const notifyItems = userInbox?.items ?? [];
  const approvalNotifyItems = useMemo(
    () => notifyItems.filter((item) => isApprovalUserMessage(item)),
    [notifyItems],
  );
  const systemNotifyItems = useMemo(
    () => notifyItems.filter((item) => !isApprovalUserMessage(item)),
    [notifyItems],
  );
  const sectionNotifyItems =
    activeSection === 'approval'
      ? approvalNotifyItems
      : activeSection === 'system'
        ? systemNotifyItems
        : [];
  const personalPendingTasks = personalTasksData?.items ?? [];

  const todoTasks = useMemo(
    () => filterImTodoTasks(personalPendingTasks),
    [personalPendingTasks],
  );
  const reminderTasks = useMemo(
    () => filterImReminderTasks(personalPendingTasks),
    [personalPendingTasks],
  );
  const taskListItems = activeSection === 'reminder' ? reminderTasks : todoTasks;
  const selectedTask = useMemo(
    () => taskListItems.find((task) => task.uuid === selectedTaskUuid) ?? null,
    [selectedTaskUuid, taskListItems],
  );

  const unreadBySection = useMemo(() => {
    const approvalUnread = approvalNotifyItems.filter((item) => isUnreadMessage(item)).length;
    const systemUnread = systemNotifyItems.filter((item) => isUnreadMessage(item)).length;
    const counts: Record<ImNavSection, number> = {
      direct: 0,
      group: 0,
      approval: approvalUnread,
      system: systemUnread,
      todo: 0,
      reminder: 0,
    };
    for (const item of items) {
      const kind = item.kind as ImNavSection;
      if (kind in counts && kind !== 'system' && kind !== 'approval' && !TASK_SECTIONS.has(kind)) {
        counts[kind] += item.unread_count || 0;
      }
    }
    return counts;
  }, [approvalNotifyItems, items, systemNotifyItems]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.kind === activeSection)
      .sort((a, b) => {
        const pinned = (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        if (pinned !== 0) {
          return pinned;
        }
        const timeA = a.last_message_at ? dayjs(a.last_message_at).valueOf() : 0;
        const timeB = b.last_message_at ? dayjs(b.last_message_at).valueOf() : 0;
        return timeB - timeA;
      });
  }, [activeSection, items]);

  const directByPeerId = useMemo(() => {
    const map = new Map<number, ImConversation>();
    for (const item of items) {
      if (item.kind !== 'direct' || item.peer_user_id == null) {
        continue;
      }
      const peerId = Number(item.peer_user_id);
      if (!Number.isFinite(peerId) || peerId <= 0) {
        continue;
      }
      map.set(peerId, item);
    }
    return map;
  }, [items]);

  const directContactUsers = useMemo(() => {
    const rows = (directUsersData?.items ?? []).filter(
      (user) => !isSameUserId(user.id, currentUser?.id),
    );
    return rows;
  }, [currentUser?.id, directUsersData?.items]);

  type DirectListRow =
    | { type: 'user'; user: UserDisplayItem; conv?: ImConversation }
    | { type: 'orphan'; conv: ImConversation };

  const directListRows = useMemo((): DirectListRow[] => {
    const matched = new Set<string>();
    const userRows: DirectListRow[] = directContactUsers.map((user) => {
      const conv = resolveDirectConversationForUser(user, directByPeerId);
      if (conv) {
        matched.add(conv.uuid);
      }
      return { type: 'user', user, conv };
    });

    const keyword = contactKeyword.trim().toLowerCase();
    const orphanRows: DirectListRow[] = items
      .filter((item) => {
        if (item.kind !== 'direct' || matched.has(item.uuid)) {
          return false;
        }
        // 站内信主题误落成私聊会话标题时，不在「个人」展示（应只出现在「消息/审批」）
        if (
          looksLikeSystemNotifyTitle(item.title) ||
          looksLikeSystemNotifyTitle(item.last_message_preview)
        ) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        const title = (item.title || '').toLowerCase();
        const preview = (item.last_message_preview || '').toLowerCase();
        return title.includes(keyword) || preview.includes(keyword);
      })
      .map((conv) => ({ type: 'orphan' as const, conv }));

    return [...userRows, ...orphanRows].sort((a, b) => {
      const left =
        a.type === 'user'
          ? {
              pinned: !!a.conv?.is_pinned,
              unread: a.conv?.unread_count ?? 0,
              time: a.conv?.last_message_at ? dayjs(a.conv.last_message_at).valueOf() : 0,
              label: a.user.label,
            }
          : {
              pinned: !!a.conv.is_pinned,
              unread: a.conv.unread_count ?? 0,
              time: a.conv.last_message_at ? dayjs(a.conv.last_message_at).valueOf() : 0,
              label: a.conv.title || a.conv.uuid,
            };
      const right =
        b.type === 'user'
          ? {
              pinned: !!b.conv?.is_pinned,
              unread: b.conv?.unread_count ?? 0,
              time: b.conv?.last_message_at ? dayjs(b.conv.last_message_at).valueOf() : 0,
              label: b.user.label,
            }
          : {
              pinned: !!b.conv.is_pinned,
              unread: b.conv.unread_count ?? 0,
              time: b.conv.last_message_at ? dayjs(b.conv.last_message_at).valueOf() : 0,
              label: b.conv.title || b.conv.uuid,
            };
      return compareDirectListOrder(left, right);
    });
  }, [contactKeyword, directContactUsers, directByPeerId, items]);

  const directListHasRows = directListRows.length > 0;

  const directUsersForbidden =
    directUsersError &&
    directUsersQueryError instanceof ReferenceDisplayAccessError &&
    directUsersQueryError.status === 403;

  const messageItems = useMemo(() => messages?.items ?? [], [messages?.items]);

  const messageSenderIdsMissing = useMemo(() => {
    const known = new Set<number>();
    if (currentUser?.id != null) {
      known.add(Number(currentUser.id));
    }
    for (const user of directContactUsers) {
      known.add(Number(user.id));
    }
    const missing: number[] = [];
    const seen = new Set<number>();
    for (const item of messageItems) {
      const senderId = Number(item.sender_id);
      if (
        !Number.isFinite(senderId) ||
        senderId === IM_BOT_SENDER_ID ||
        known.has(senderId) ||
        seen.has(senderId)
      ) {
        continue;
      }
      seen.add(senderId);
      missing.push(senderId);
    }
    return missing;
  }, [currentUser?.id, directContactUsers, messageItems]);

  const { data: resolvedMessageSenders } = useQuery({
    queryKey: ['imMessageSenderDisplay', selectedUuid, messageSenderIdsMissing],
    queryFn: () =>
      resolveUserDisplay({
        user_ids: messageSenderIdsMissing,
        host_resource: 'system:user-message',
      }),
    enabled: enabled && open && messageSenderIdsMissing.length > 0,
    staleTime: 60_000,
  });

  const messageSenderDisplay = useMemo(() => {
    const map = new Map<
      number,
      Pick<UserDisplayItem, 'full_name' | 'username' | 'label' | 'avatar'>
    >();
    if (currentUser?.id != null) {
      map.set(Number(currentUser.id), {
        full_name: currentUser.full_name,
        username: currentUser.username,
        label: currentUser.full_name || currentUser.username,
        avatar: currentUser.avatar,
      });
    }
    for (const user of directContactUsers) {
      map.set(Number(user.id), {
        full_name: user.full_name,
        username: user.username,
        label: user.label,
        avatar: user.avatar,
      });
    }
    for (const user of resolvedMessageSenders ?? []) {
      if (map.has(Number(user.id))) {
        continue;
      }
      map.set(Number(user.id), {
        full_name: user.full_name,
        username: user.username,
        label: user.label,
        avatar: user.avatar,
      });
    }
    return map;
  }, [currentUser, directContactUsers, resolvedMessageSenders]);

  const peerAvatarUuids = useMemo(() => {
    const uuids = new Map<number, string>();
    for (const [userId, user] of messageSenderDisplay) {
      if (isSameUserId(userId, currentUser?.id)) {
        continue;
      }
      const avatarUuid = user.avatar?.trim();
      if (avatarUuid) {
        uuids.set(userId, avatarUuid);
      }
    }
    return uuids;
  }, [currentUser?.id, messageSenderDisplay]);

  const [peerAvatarUrls, setPeerAvatarUrls] = React.useState<Record<number, string>>({});
  const [peerAvatarFailedIds, setPeerAvatarFailedIds] = React.useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    const entries = [...peerAvatarUuids.entries()];
    if (entries.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        entries.map(async ([userId, avatarUuid]) => {
          const cached = getCachedAvatarUrl(avatarUuid);
          if (cached) {
            next[userId] = cached;
            return;
          }
          const url = await getAvatarUrl(avatarUuid);
          if (url) {
            next[userId] = url;
          }
        }),
      );
      if (!cancelled) {
        setPeerAvatarUrls((prev) => ({ ...prev, ...next }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [peerAvatarUuids]);

  const selectedConversation = useMemo(
    () => items.find((item) => item.uuid === selectedUuid) ?? null,
    [items, selectedUuid],
  );

  const selectedNotify = useMemo(
    () => sectionNotifyItems.find((item) => item.uuid === selectedNotifyUuid) ?? null,
    [sectionNotifyItems, selectedNotifyUuid],
  );

  const isSystemSection = activeSection === 'system';
  const isApprovalSection = activeSection === 'approval';
  const isNotifySection = isSystemSection || isApprovalSection;

  const canCompose =
    !selectedKuAi &&
    !isNotifySection &&
    !!selectedUuid &&
    !!selectedConversation &&
    CHAT_KINDS.has(selectedConversation.kind as ImNavSection);

  const emptyListDescription = useMemo(() => {
    if (activeSection === 'approval') {
      return t('components.uniIm.emptyApproval');
    }
    if (activeSection === 'system') {
      return t('components.uniIm.emptySystem');
    }
    if (activeSection === 'group') {
      return t('components.uniIm.emptyGroup');
    }
    if (activeSection === 'direct') {
      if (directUsersForbidden) {
        return t('components.uniIm.noUserListPermission');
      }
      return t('components.uniIm.emptyDirectUsers');
    }
    if (activeSection === 'todo') {
      return canReadTasks
        ? t('components.uniIm.emptyTodos')
        : t('components.uniIm.noTaskPermission');
    }
    if (activeSection === 'reminder') {
      return canReadTasks
        ? t('components.uniIm.emptyReminders')
        : t('components.uniIm.noTaskPermission');
    }
    return t('pages.personal.im.noConversations');
  }, [activeSection, canReadTasks, directUsersForbidden, t]);

  const switchSection = useCallback((section: ImNavSection) => {
    setActiveSection(section);
    setSelectedUuid(null);
    setSelectedNotifyUuid(null);
    setSelectedKuAi(false);
    setSelectedTaskUuid(null);
    setContactKeyword('');
    setDraft('');
  }, []);

  const selectKuAi = useCallback(() => {
    setActiveSection('direct');
    setSelectedKuAi(true);
    setSelectedUuid(null);
    setSelectedNotifyUuid(null);
    setSelectedTaskUuid(null);
    setDraft('');
  }, []);

  const onToggleConversationPin = useCallback(
    async (conv: ImConversation, nextPinned?: boolean) => {
      const pinned = nextPinned ?? !conv.is_pinned;
      try {
        await setImConversationPinned(conv.uuid, pinned);
        antMessage.success(
          pinned ? t('components.uniIm.pinSuccess') : t('components.uniIm.unpinSuccess'),
        );
        void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.pinFailed'));
      }
    },
    [queryClient, t],
  );

  const onPinDirectContact = useCallback(
    async (user: UserDisplayItem, conv?: ImConversation) => {
      try {
        let target = conv;
        if (!target) {
          target = await createDirectImConversation(user.id);
          void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
        }
        await onToggleConversationPin(target, !target.is_pinned);
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.pinFailed'));
      }
    },
    [onToggleConversationPin, queryClient, t],
  );

  const onCompleteTask = useCallback(
    async (task: UserTask) => {
      if (!canUpdateTasks || completingTaskUuid) {
        return;
      }
      setCompletingTaskUuid(task.uuid);
      try {
        await completeImPersonalTask(task);
        antMessage.success(t('components.uniIm.taskCompleted'));
        if (selectedTaskUuid === task.uuid) {
          setSelectedTaskUuid(null);
        }
        void queryClient.invalidateQueries({ queryKey: ['imPersonalTasks'] });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.taskCompleteFailed'));
      } finally {
        setCompletingTaskUuid(null);
      }
    },
    [canUpdateTasks, completingTaskUuid, queryClient, selectedTaskUuid, t],
  );

  const onAddMessageToTodo = useCallback(
    async (message: ImMessage) => {
      if (!canUpdateTasks || !message.body.trim() || addingTodoMessageUuid) {
        return;
      }
      setAddingTodoMessageUuid(message.uuid);
      try {
        await addMessageBodyToTodo(message.body);
        antMessage.success(t('components.uniIm.addedToTodo'));
        void queryClient.invalidateQueries({ queryKey: ['imPersonalTasks'] });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.taskCreateFailed'));
      } finally {
        setAddingTodoMessageUuid(null);
      }
    },
    [addingTodoMessageUuid, canUpdateTasks, queryClient, t],
  );

  const onOpenAddReminder = useCallback(
    (message: ImMessage, remindAtOverride?: Dayjs | null) => {
      if (!canUpdateTasks || !message.body.trim()) {
        return;
      }
      const hit = extractImRemindAtFromText(message.body);
      setReminderSourceMessage(message);
      setReminderRemark('');
      setReminderAt(
        remindAtOverride ?? hit.remindAt ?? defaultImRemindAtFallback(),
      );
    },
    [canUpdateTasks],
  );

  const onConfirmAddReminder = useCallback(async () => {
    if (!reminderSourceMessage || !reminderAt || !canUpdateTasks) {
      return;
    }
    setReminderSaving(true);
    try {
      await addMessageBodyToReminder(
        reminderSourceMessage.body,
        reminderAt.toISOString(),
        reminderRemark,
      );
      antMessage.success(t('components.uniIm.addedToReminder'));
      setReminderSourceMessage(null);
      setReminderAt(null);
      setReminderRemark('');
      void queryClient.invalidateQueries({ queryKey: ['imPersonalTasks'] });
    } catch (e: unknown) {
      const err = e as { message?: string };
      antMessage.error(err?.message || t('components.uniIm.taskCreateFailed'));
    } finally {
      setReminderSaving(false);
    }
  }, [canUpdateTasks, queryClient, reminderAt, reminderRemark, reminderSourceMessage, t]);

  const onRecallMessage = useCallback(
    async (message: ImMessage) => {
      if (!selectedUuid || recallingMessageUuid) {
        return;
      }
      if (!canRecallImMessage(message, currentUser?.id)) {
        antMessage.warning(t('components.uniIm.recallExpired'));
        return;
      }
      setRecallingMessageUuid(message.uuid);
      try {
        await recallImMessage(selectedUuid, message.uuid);
        antMessage.success(t('components.uniIm.recallSuccess'));
        void queryClient.invalidateQueries({ queryKey: ['imMessages', selectedUuid] });
        void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.recallFailed'));
      } finally {
        setRecallingMessageUuid(null);
      }
    },
    [currentUser?.id, queryClient, recallingMessageUuid, selectedUuid, t],
  );

  const onOpenDocumentCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || openingDocCode) {
        return;
      }
      if (!linkedDocument) {
        antMessage.warning(t('components.uniIm.documentDetailUnavailable'));
        return;
      }
      setOpeningDocCode(trimmed);
      try {
        const res = await resolveDocumentByCode(trimmed);
        const openable = (res.items ?? []).filter((item) =>
          canOpenLinkedDocumentDetail(item.document_type),
        );
        if (openable.length === 0) {
          antMessage.warning(t('components.uniIm.documentNotFound'));
          return;
        }
        const hit = openable[0];
        const opened = linkedDocument.openLinkedDocumentDetail(
          hit.document_type,
          hit.document_id,
          { placement: 'left' },
        );
        if (!opened) {
          antMessage.warning(t('components.uniIm.documentDetailUnavailable'));
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('components.uniIm.documentResolveFailed'));
      } finally {
        setOpeningDocCode(null);
      }
    },
    [linkedDocument, openingDocCode, t],
  );

  const renderMessageBody = useCallback(
    (message: ImMessage) => {
      const body = message.body;
      if (message.kind === 'ai_ref') {
        return <AiAssistantMarkdown content={body} />;
      }
      const segments = splitImMessageBodyLinks(body);
      const hasLink = segments.some((seg) => seg.kind === 'time' || seg.kind === 'document');
      if (!hasLink) {
        return body;
      }
      return (
        <>
          {segments.map((seg, index) => {
            if (seg.kind === 'text') {
              return <React.Fragment key={`t-${index}`}>{seg.text}</React.Fragment>;
            }
            if (seg.kind === 'document') {
              return (
                <button
                  key={`doc-${index}`}
                  type="button"
                  className={styles.docLink}
                  title={t('components.uniIm.openDocumentDetail')}
                  disabled={openingDocCode === seg.text}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onOpenDocumentCode(seg.text);
                  }}
                >
                  {seg.text}
                </button>
              );
            }
            if (!canUpdateTasks) {
              return <React.Fragment key={`time-plain-${index}`}>{seg.text}</React.Fragment>;
            }
            return (
              <button
                key={`time-${index}`}
                type="button"
                className={styles.timeLink}
                title={t('components.uniIm.addToReminder')}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAddReminder(message, seg.remindAt);
                }}
              >
                {seg.text}
              </button>
            );
          })}
        </>
      );
    },
    [canUpdateTasks, onOpenAddReminder, onOpenDocumentCode, openingDocCode, t],
  );

  const onMinimize = useCallback(() => {
    onMinimizedChange?.(true);
  }, [onMinimizedChange]);

  const onRestore = useCallback(() => {
    onMinimizedChange?.(false);
  }, [onMinimizedChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (minimized) {
        onRestore();
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose, minimized, onRestore]);

  useEffect(() => {
    if (!open || !selectedUuid || isNotifySection || isTaskSection) {
      return;
    }
    void markImConversationRead(selectedUuid).then(() => {
      queryClient.invalidateQueries({ queryKey: ['imConversations'] });
    });
  }, [isNotifySection, isTaskSection, open, queryClient, selectedUuid]);

  useEffect(() => {
    if (!open || !selectedNotifyUuid || !isNotifySection) {
      return;
    }
    const target = sectionNotifyItems.find((item) => item.uuid === selectedNotifyUuid);
    if (!target || !isUnreadMessage(target)) {
      return;
    }
    void markMessagesRead({ message_uuids: [selectedNotifyUuid] }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['userMessageStats'] });
      queryClient.invalidateQueries({ queryKey: ['userInboxMessages'] });
    });
  }, [isNotifySection, open, queryClient, sectionNotifyItems, selectedNotifyUuid]);

  useLayoutEffect(() => {
    if (!open || !selectedUuid || isNotifySection) {
      return;
    }
    const el = messageListRef.current;
    if (!el) {
      return;
    }
    // 打开会话直接落底，避免 smooth 从顶滑到底
    el.scrollTop = el.scrollHeight;
  }, [isNotifySection, messageItems.length, open, selectedUuid]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!selectedUuid || !text) {
      return;
    }
    const mentionKuAi = /@(?:KU-AI|KUAI|快AI|库AI)\b/i.test(text);
    try {
      await sendImMessage(selectedUuid, text, { mention_ku_ai: mentionKuAi });
      setDraft('');
      setMentionQuery(null);
      await queryClient.invalidateQueries({ queryKey: ['imMessages', selectedUuid] });
      await queryClient.invalidateQueries({ queryKey: ['imConversations'] });
      // @KU-AI 回复异步写入，短暂后再刷一次
      if (mentionKuAi) {
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ['imMessages', selectedUuid] });
          void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
        }, 2500);
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      antMessage.error(err?.message || t('pages.personal.im.sendFailed'));
    }
  }, [draft, queryClient, selectedUuid, t]);

  const persistListPaneWidthLevel = useCallback((level: number) => {
    setListPaneWidthLevel(level);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LIST_PANE_WIDTH_STORAGE_KEY, String(level));
    }
  }, []);

  const onListPaneResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      listPaneResizeRef.current = {
        startX: event.clientX,
        startWidth: LIST_PANE_WIDTH_LEVELS[listPaneWidthLevel],
      };
      setDragListPaneWidth(LIST_PANE_WIDTH_LEVELS[listPaneWidthLevel]);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [listPaneWidthLevel],
  );

  const onListPaneResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!listPaneResizeRef.current) {
      return;
    }
    const { startX, startWidth } = listPaneResizeRef.current;
    const nextWidth = clampToWidthLevels(
      startWidth + (event.clientX - startX),
      LIST_PANE_WIDTH_LEVELS,
    );
    setDragListPaneWidth(nextWidth);
  }, []);

  const finishListPaneResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!listPaneResizeRef.current) {
        return;
      }
      const { startX, startWidth } = listPaneResizeRef.current;
      const finalWidth = clampToWidthLevels(
        startWidth + (event.clientX - startX),
        LIST_PANE_WIDTH_LEVELS,
      );
      persistListPaneWidthLevel(snapWidthToLevelIndex(finalWidth, LIST_PANE_WIDTH_LEVELS));
      listPaneResizeRef.current = null;
      setDragListPaneWidth(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [persistListPaneWidthLevel],
  );

  const onListPaneResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -1 : 1;
      const nextLevel = Math.min(
        LIST_PANE_WIDTH_LEVELS.length - 1,
        Math.max(0, listPaneWidthLevel + delta),
      );
      if (nextLevel !== listPaneWidthLevel) {
        persistListPaneWidthLevel(nextLevel);
      }
    },
    [listPaneWidthLevel, persistListPaneWidthLevel],
  );

  const selectConversation = useCallback((uuid: string) => {
    setSelectedKuAi(false);
    setSelectedNotifyUuid(null);
    setSelectedUuid(uuid);
  }, []);

  const onOpenDirectWithUser = useCallback(
    async (user: UserDisplayItem, existingConv?: ImConversation) => {
      // 已有会话：立即切到对话框，不走创建接口
      if (existingConv?.uuid) {
        selectConversation(existingConv.uuid);
        return;
      }
      if (openingUserId != null) {
        return;
      }
      setOpeningUserId(user.id);
      try {
        const conv = await createDirectImConversation(user.id);
        selectConversation(conv.uuid);
        queryClient.setQueryData(
          ['imConversations'],
          (prev: { items: ImConversation[]; total: number } | undefined) => {
            if (!prev) {
              return { items: [conv], total: 1 };
            }
            const exists = prev.items.some((item) => item.uuid === conv.uuid);
            if (exists) {
              return prev;
            }
            return { ...prev, items: [conv, ...prev.items], total: prev.total + 1 };
          },
        );
        void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antMessage.error(err?.message || t('pages.personal.im.createFailed'));
      } finally {
        setOpeningUserId(null);
      }
    },
    [openingUserId, queryClient, selectConversation, t],
  );

  const prefetchDirectMessages = useCallback(
    (conv?: ImConversation) => {
      if (!enabled || !conv?.uuid) {
        return;
      }
      void queryClient.prefetchQuery({
        queryKey: ['imMessages', conv.uuid],
        queryFn: () => listImMessages(conv.uuid, { page: 1, page_size: 50 }),
        staleTime: 15_000,
      });
    },
    [enabled, queryClient],
  );

  const resolveMessageSender = useCallback(
    (item: ImMessage) => {
      const senderId = Number(item.sender_id);
      if (senderId === IM_BOT_SENDER_ID || item.kind === 'ai_ref' || item.kind === 'system') {
        const isAi = item.kind === 'ai_ref';
        return {
          isSelf: false,
          fullName: isAi ? t('ui.aiAssistant.title') : t('components.uniIm.systemSender'),
          username: isAi ? 'KU-AI' : 'system',
          imageSrc: undefined as string | undefined,
          useTextAvatar: true,
          onImageError: () => undefined,
          isBot: true,
          isAi,
        };
      }
      const isSelf = isSameUserId(senderId, currentUser?.id);
      if (isSelf) {
        return {
          isSelf: true,
          fullName: currentUser?.full_name,
          username: currentUser?.username,
          imageSrc: avatarUrl,
          useTextAvatar: showTextAvatar,
          onImageError: () => setImageFailed(true),
          isBot: false,
          isAi: false,
        };
      }
      const sender = messageSenderDisplay.get(senderId);
      const imageSrc = peerAvatarUrls[senderId];
      const useTextAvatar = isTextAvatarDisplay(imageSrc, peerAvatarFailedIds.has(senderId));
      if (sender) {
        return {
          isSelf: false,
          fullName: sender.full_name,
          username: sender.username ?? sender.label,
          imageSrc,
          useTextAvatar,
          onImageError: () => {
            setPeerAvatarFailedIds((prev) => {
              const next = new Set(prev);
              next.add(senderId);
              return next;
            });
          },
          isBot: false,
          isAi: false,
        };
      }
      return {
        isSelf: false,
        fullName: selectedConversation?.kind === 'direct' ? selectedConversation.title : undefined,
        username: undefined,
        imageSrc,
        useTextAvatar,
        onImageError: () => {
          setPeerAvatarFailedIds((prev) => {
            const next = new Set(prev);
            next.add(senderId);
            return next;
          });
        },
        isBot: false,
        isAi: false,
      };
    },
    [
      avatarUrl,
      currentUser?.full_name,
      currentUser?.id,
      currentUser?.username,
      messageSenderDisplay,
      peerAvatarFailedIds,
      peerAvatarUrls,
      selectedConversation?.kind,
      selectedConversation?.title,
      setImageFailed,
      showTextAvatar,
      t,
    ],
  );

  const directPeerLabel = useMemo(() => {
    if (selectedConversation?.kind !== 'direct' || selectedConversation.peer_user_id == null) {
      return null;
    }
    const peer = directContactUsers.find((user) =>
      isSameUserId(user.id, selectedConversation.peer_user_id),
    );
    return peer?.label || peer?.full_name || peer?.username || null;
  }, [directContactUsers, selectedConversation]);

  if (!enabled) {
    return null;
  }

  const selfLabel =
    currentUser?.full_name || currentUser?.username || t('components.uniIm.self');
  const navAvatarSize = 32;
  const listAvatarSize = 32;
  const messageAvatarSize = 36;

  const renderListAvatar = (
    fullName?: string | null,
    username?: string,
    options?: {
      className?: string;
      style?: React.CSSProperties;
      icon?: React.ReactNode;
      imageSrc?: string;
      useTextAvatar?: boolean;
      onImageError?: () => void;
    },
  ) => {
    const useTextAvatar = options?.useTextAvatar ?? true;
    const imageSrc = options?.imageSrc;
    return (
      <Avatar
        size={listAvatarSize}
        src={!useTextAvatar && imageSrc ? imageSrc : undefined}
        onError={options?.onImageError}
        className={`${styles.imAvatar}${options?.className ? ` ${options.className}` : ''}`}
        style={{
          ...(useTextAvatar || !imageSrc
            ? getTextAvatarCircleStyle(token)
            : getImageAvatarCircleStyle()),
          fontSize: getAvatarFontSize(listAvatarSize),
          fontWeight: 500,
          ...options?.style,
        }}
      >
        {options?.icon ??
          (useTextAvatar || !imageSrc
            ? getAvatarText(fullName ?? undefined, username)
            : null)}
      </Avatar>
    );
  };

  const renderMessageAvatar = (
    fullName?: string | null,
    username?: string,
    isSelf = false,
    imageSrc?: string,
    useTextAvatar = true,
    onImageError?: () => void,
  ) => (
    <Avatar
      size={messageAvatarSize}
      src={!useTextAvatar && imageSrc ? imageSrc : undefined}
      onError={onImageError}
      className={`${styles.imAvatar}${isSelf ? ` ${styles.msgAvatarSelf}` : ''}`}
      style={{
        ...(isSelf
          ? useTextAvatar
            ? { backgroundColor: '#576b95', color: '#ffffff', border: 'none', boxShadow: 'none' }
            : getImageAvatarCircleStyle()
          : useTextAvatar || !imageSrc
            ? getTextAvatarCircleStyle(token)
            : getImageAvatarCircleStyle()),
        fontSize: getAvatarFontSize(messageAvatarSize),
        fontWeight: 500,
      }}
    >
      {useTextAvatar || !imageSrc ? getAvatarText(fullName ?? undefined, username) : null}
    </Avatar>
  );

  const renderConversationItem = (item: ImConversation) => {
    const title =
      item.is_public
        ? t('components.uniIm.publicGroupTitle')
        : item.title || t('pages.personal.im.untitled');
    const active = selectedUuid === item.uuid;
    const pinned = !!item.is_pinned;
    return (
      <Dropdown
        key={item.uuid}
        trigger={['contextMenu']}
        menu={{
          items: [
            {
              key: 'pin',
              icon: <PushpinOutlined />,
              label: pinned ? t('components.uniIm.unpin') : t('components.uniIm.pin'),
              onClick: () => void onToggleConversationPin(item),
            },
          ],
        }}
      >
        <div
          className={`${styles.convItem} ${active ? styles.convItemActive : ''} ${
            pinned ? styles.convItemPinned : ''
          }`}
          onClick={() => selectConversation(item.uuid)}
          onMouseEnter={() => prefetchDirectMessages(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              selectConversation(item.uuid);
            }
          }}
        >
          {renderListAvatar(title)}
          <div className={styles.convMeta}>
            <span className={styles.convName}>{title}</span>
            <span className={styles.convTime}>
              {formatConversationTime(item.last_message_at, t('components.uniIm.yesterday'))}
            </span>
          </div>
          {pinned ? (
            <PushpinOutlined className={styles.convPinIcon} aria-label={t('components.uniIm.pin')} />
          ) : null}
          {item.unread_count > 0 ? (
            <span className={styles.unreadDot}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </span>
          ) : null}
        </div>
      </Dropdown>
    );
  };

  const renderKuAiRow = () => (
    <div
      className={`${styles.convItem} ${styles.pinnedItem}${selectedKuAi ? ` ${styles.convItemActive}` : ''}`}
      onClick={selectKuAi}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          selectKuAi();
        }
      }}
    >
      <span className={`${styles.imAvatar} ${styles.kuAiListAvatar}`} aria-hidden>
        <KuAiLottieMark size={42} />
      </span>
      <div className={styles.convMeta}>
        <span className={styles.convName}>{t('ui.aiAssistant.title')}</span>
        <span className={styles.convPreview}>{t('components.uniIm.kuAiSubtitle')}</span>
      </div>
    </div>
  );

  const renderDirectContactItem = (user: UserDisplayItem, conv?: ImConversation) => {
    const title = user.label || user.username;
    const active = !!conv && selectedUuid === conv.uuid;
    const opening = openingUserId === user.id;
    const pinned = !!conv?.is_pinned;
    return (
      <Dropdown
        key={user.uuid}
        trigger={['contextMenu']}
        menu={{
          items: [
            {
              key: 'pin',
              icon: <PushpinOutlined />,
              label: pinned ? t('components.uniIm.unpin') : t('components.uniIm.pin'),
              onClick: () => void onPinDirectContact(user, conv),
            },
          ],
        }}
      >
        <div
          className={`${styles.convItem} ${active ? styles.convItemActive : ''} ${
            opening ? styles.convItemOpening : ''
          } ${pinned ? styles.convItemPinned : ''}`}
          onClick={() => void onOpenDirectWithUser(user, conv)}
          onMouseEnter={() => prefetchDirectMessages(conv)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void onOpenDirectWithUser(user, conv);
            }
          }}
        >
          {renderListAvatar(user.full_name, user.username || title, {
            imageSrc: peerAvatarUrls[Number(user.id)],
            useTextAvatar: isTextAvatarDisplay(
              peerAvatarUrls[Number(user.id)],
              peerAvatarFailedIds.has(Number(user.id)),
            ),
            onImageError: () => {
              setPeerAvatarFailedIds((prev) => {
                const next = new Set(prev);
                next.add(Number(user.id));
                return next;
              });
            },
          })}
          <div className={styles.convMeta}>
            <span className={styles.convName}>{title}</span>
            {conv?.last_message_at ? (
              <span className={styles.convTime}>
                {formatConversationTime(conv.last_message_at, t('components.uniIm.yesterday'))}
              </span>
            ) : (
              <span className={styles.convTime}>{user.username}</span>
            )}
          </div>
          {pinned ? (
            <PushpinOutlined className={styles.convPinIcon} aria-label={t('components.uniIm.pin')} />
          ) : null}
          {conv && conv.unread_count > 0 ? (
            <span className={styles.unreadDot}>
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          ) : null}
        </div>
      </Dropdown>
    );
  };

  const renderNotifyItem = (item: UserMessage) => {
    const unread = isUnreadMessage(item);
    const active = selectedNotifyUuid === item.uuid;
    const title = item.subject || t('common.noSubject');
    const isApproval = isApprovalUserMessage(item);
    return (
      <div
        key={item.uuid}
        className={`${styles.convItem} ${active ? styles.convItemActive : ''}`}
        onClick={() => {
          setSelectedKuAi(false);
          setSelectedNotifyUuid(item.uuid);
          setSelectedUuid(null);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setSelectedKuAi(false);
            setSelectedNotifyUuid(item.uuid);
            setSelectedUuid(null);
          }
        }}
      >
        {renderListAvatar(undefined, undefined, {
          className: styles.notifyAvatar,
          style: isApproval
            ? { backgroundColor: '#fa8c16', color: '#ffffff' }
            : { backgroundColor: '#1677ff', color: '#ffffff' },
          icon: isApproval ? <AuditOutlined /> : <MessageOutlined />,
        })}
        <div className={styles.convMeta}>
          <span className={`${styles.convName} ${unread ? styles.convNameUnread : ''}`}>
            {title}
          </span>
          <span className={styles.convTime}>{formatUserMessageTime(item)}</span>
        </div>
        {unread ? <span className={styles.unreadDot} /> : null}
      </div>
    );
  };

  const listLoading =
    activeSection === 'direct'
      ? directUsersLoading
      : isNotifySection
        ? userInboxLoading
        : isTaskSection
          ? personalTasksLoading
          : convLoading;

  const listEmpty =
    activeSection === 'direct'
      ? !hasKuAiEntry && !directListHasRows
      : isNotifySection
        ? sectionNotifyItems.length === 0
        : isTaskSection
          ? !canReadTasks || taskListItems.length === 0
          : filteredItems.length === 0;

  const chatTitle = selectedKuAi
    ? t('ui.aiAssistant.title')
    : isTaskSection
      ? selectedTask?.title || t(`components.uniIm.nav.${activeSection}`)
      : isNotifySection
        ? selectedNotify
          ? messageSnippet(selectedNotify.subject || selectedNotify.content, 40) ||
            t('components.uniIm.selectNotify')
          : t('components.uniIm.selectNotify')
        : selectedConversation?.is_public
          ? t('components.uniIm.publicGroupTitle')
          : directPeerLabel ||
            selectedConversation?.title ||
            t('pages.personal.im.selectConversation');

  const hasSelection = isTaskSection
    ? !!selectedTask
    : selectedKuAi ||
      (isNotifySection ? !!selectedNotify : !!selectedConversation);

  const emptyDetailHint = isTaskSection
    ? t('components.uniIm.selectTask')
    : isNotifySection
      ? t('components.uniIm.selectNotify')
      : t('pages.personal.im.selectConversation');

  const showPanel = open && !minimized;
  const showFab = open && minimized;

  return createPortal(
    <div
      className={`${styles.shell}${open ? '' : ` ${styles.shellHidden}`}`}
      aria-hidden={!open}
    >
      {showFab ? (
        <button
          type="button"
          className={styles.minimizedFab}
          onClick={onRestore}
          aria-label={t('components.uniIm.restore')}
          title={t('components.uniIm.restore')}
        >
          <CommentOutlined className={styles.minimizedFabIcon} />
          {(unreadBySection.direct +
            unreadBySection.group +
            unreadBySection.approval +
            unreadBySection.system) >
          0 ? (
            <span className={styles.minimizedFabBadge}>
              {(() => {
                const n =
                  unreadBySection.direct +
                  unreadBySection.group +
                  unreadBySection.approval +
                  unreadBySection.system;
                return n > 99 ? '99+' : n;
              })()}
            </span>
          ) : null}
        </button>
      ) : null}
      {showPanel ? (
        <div
          className={`${styles.window}${listPaneResizing ? ` ${styles.windowResizing}` : ''}`}
          style={
            {
              width: panelWidth,
              ['--uni-im-color-primary' as string]: token.colorPrimary,
            } as React.CSSProperties
          }
          role="dialog"
          aria-label={t('components.uniIm.title')}
        >
          <div className={styles.body}>
            <nav className={styles.navRail} aria-label={t('components.uniIm.navLabel')}>
              <Avatar
                size={navAvatarSize}
                src={showTextAvatar ? undefined : avatarUrl}
                onError={() => setImageFailed(true)}
                className={styles.navUserAvatar}
                title={selfLabel}
                style={{
                  ...(showTextAvatar
                    ? getTextAvatarCircleStyle(token)
                    : getImageAvatarCircleStyle()),
                  fontSize: getAvatarFontSize(navAvatarSize),
                  fontWeight: 600,
                }}
              >
                {showTextAvatar
                  ? getAvatarText(currentUser?.full_name, currentUser?.username)
                  : null}
              </Avatar>
              <div className={styles.navItems}>
                {NAV_SECTIONS.map((section) => {
                  const unread = unreadBySection[section];
                  const label = t(`components.uniIm.nav.${section}`);
                  return (
                    <button
                      key={section}
                      type="button"
                      className={`${styles.navBtn} ${activeSection === section ? styles.navBtnActive : ''}`}
                      aria-label={label}
                      aria-current={activeSection === section ? 'page' : undefined}
                      onClick={() => switchSection(section)}
                    >
                      <span className={styles.navBtnIcon}>
                        {NAV_ICONS[section]}
                        {unread > 0 ? (
                          <span className={styles.navBtnBadge}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.navBtnLabel}>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.navBottom}>
                {BOTTOM_NAV_SECTIONS.map((section) => {
                  const label = t(`components.uniIm.nav.${section}`);
                  return (
                    <button
                      key={section}
                      type="button"
                      className={`${styles.navBtn} ${activeSection === section ? styles.navBtnActive : ''}`}
                      aria-label={label}
                      aria-current={activeSection === section ? 'page' : undefined}
                      onClick={() => switchSection(section)}
                    >
                      <span className={styles.navBtnIcon}>{NAV_ICONS[section]}</span>
                      <span className={styles.navBtnLabel}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className={styles.listPaneWrap} style={{ width: listPaneWidth }}>
            <aside className={styles.listPane}>
              <div className={styles.listHeader}>
                <Input
                  className={styles.searchInput}
                  placeholder={t('components.uniIm.searchPlaceholder')}
                  allowClear
                  disabled={activeSection !== 'direct'}
                  value={activeSection === 'direct' ? contactKeyword : undefined}
                  onChange={(e) => {
                    if (activeSection === 'direct') {
                      setContactKeyword(e.target.value);
                    }
                  }}
                />
                {activeSection === 'group' ? (
                  <Button
                    type="link"
                    size="small"
                    className={styles.listHeaderLink}
                    icon={<PlusOutlined />}
                    onClick={() => setCreateGroupOpen(true)}
                  >
                    {t('components.uniIm.createGroup')}
                  </Button>
                ) : isNotifySection ? (
                  <Button
                    type="link"
                    size="small"
                    className={styles.listHeaderLink}
                    onClick={() => {
                      onClose();
                      navigate('/personal/messages');
                    }}
                  >
                    {t('pages.dashboard.viewAll')} <RightOutlined />
                  </Button>
                ) : isTaskSection && canReadTasks ? (
                  <Button
                    type="link"
                    size="small"
                    className={styles.listHeaderLink}
                    onClick={() => {
                      onClose();
                      navigate('/personal/tasks');
                    }}
                  >
                    {t('pages.dashboard.viewAll')} <RightOutlined />
                  </Button>
                ) : null}
              </div>
              <div className={styles.convList}>
                {listLoading ? (
                  <div className={styles.emptyChat}>{t('common.loading')}</div>
                ) : isTaskSection ? (
                  !canReadTasks ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={emptyListDescription}
                      style={{ marginTop: 48 }}
                    />
                  ) : (
                    <UniImTaskList
                      mode={activeSection === 'reminder' ? 'reminder' : 'todo'}
                      tasks={taskListItems}
                      selectedUuid={selectedTaskUuid}
                      completingUuid={completingTaskUuid}
                      onSelect={setSelectedTaskUuid}
                      onToggleComplete={(task) => void onCompleteTask(task)}
                    />
                  )
                ) : activeSection === 'direct' ? (
                  <>
                    {hasKuAiEntry ? renderKuAiRow() : null}
                    {hasKuAiEntry && directListHasRows ? (
                      <div className={styles.pinnedDivider} />
                    ) : null}
                    {directUsersForbidden ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={emptyListDescription}
                        style={{ marginTop: hasKuAiEntry ? 24 : 48 }}
                      />
                    ) : !directListHasRows ? (
                      !hasKuAiEntry ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={emptyListDescription}
                          style={{ marginTop: 48 }}
                        />
                      ) : null
                    ) : (
                      directListRows.map((row) =>
                        row.type === 'orphan'
                          ? renderConversationItem(row.conv)
                          : renderDirectContactItem(row.user, row.conv),
                      )
                    )}
                  </>
                ) : listEmpty ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={emptyListDescription}
                    style={{ marginTop: 48 }}
                  />
                ) : isNotifySection ? (
                  sectionNotifyItems.map(renderNotifyItem)
                ) : (
                  filteredItems.map(renderConversationItem)
                )}
              </div>
            </aside>
            <div
              className={`${styles.listPaneResizeHandle}${listPaneResizing ? ` ${styles.listPaneResizeHandleActive}` : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('components.uniIm.listPaneResize')}
              aria-valuemin={1}
              aria-valuemax={LIST_PANE_WIDTH_LEVELS.length}
              aria-valuenow={listPaneWidthLevel + 1}
              aria-valuetext={t('components.uniIm.listPaneWidthLevel', {
                level: listPaneWidthLevel + 1,
                width: listPaneWidth,
              })}
              tabIndex={0}
              onPointerDown={onListPaneResizePointerDown}
              onPointerMove={onListPaneResizePointerMove}
              onPointerUp={finishListPaneResize}
              onPointerCancel={finishListPaneResize}
              onKeyDown={onListPaneResizeKeyDown}
            />
            </div>

            <main className={styles.chatPane}>
              <div className={styles.chatHeader}>
                <span className={styles.chatHeaderTitle}>{chatTitle}</span>
                <div className={styles.chatHeaderActions}>
                  {selectedConversation?.kind === 'group' ? (
                    <Button
                      type="text"
                      className={styles.headerIconBtn}
                      icon={<SettingOutlined />}
                      aria-label={t('components.uniIm.groupSettings')}
                      onClick={() => setGroupSettingsOpen(true)}
                    />
                  ) : null}
                  <Button
                    type="text"
                    className={styles.headerIconBtn}
                    icon={<MinusOutlined />}
                    aria-label={t('components.uniIm.minimize')}
                    onClick={onMinimize}
                  />
                  <Button
                    type="text"
                    className={styles.headerIconBtn}
                    icon={<CloseOutlined />}
                    aria-label={t('common.close')}
                    onClick={onClose}
                  />
                </div>
              </div>

              {isTaskSection ? (
                <>
                  {selectedTask ? (
                    <div className={styles.taskDetail}>
                      <div className={styles.taskDetailTitle}>{selectedTask.title}</div>
                      {selectedTask.content ? (
                        <div className={styles.taskDetailContent}>{selectedTask.content}</div>
                      ) : null}
                      <div className={styles.taskDetailMeta}>
                        {selectedTask.remind_at ? (
                          <div>
                            {t('components.uniIm.remindAtLabel', {
                              time: formatDateTime(selectedTask.remind_at, 'YYYY-MM-DD HH:mm'),
                            })}
                          </div>
                        ) : null}
                        {selectedTask.created_at ? (
                          <div>
                            {t('components.uniIm.taskCreatedAt', {
                              time: formatDateTime(selectedTask.created_at, 'YYYY-MM-DD HH:mm'),
                            })}
                          </div>
                        ) : null}
                      </div>
                      {canUpdateTasks && selectedTask.status === 'pending' ? (
                        <Button
                          type="primary"
                          className={styles.sendBtn}
                          style={{ marginTop: 16 }}
                          loading={completingTaskUuid === selectedTask.uuid}
                          onClick={() => void onCompleteTask(selectedTask)}
                        >
                          {t('components.uniIm.markTodoDone')}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className={styles.emptyChat}>{emptyDetailHint}</div>
                  )}
                  <UniImTaskComposer
                    mode={activeSection === 'reminder' ? 'reminder' : 'todo'}
                    canUpdate={canUpdateTasks}
                    onCreated={() => {
                      setSelectedTaskUuid(null);
                      void queryClient.invalidateQueries({ queryKey: ['imPersonalTasks'] });
                    }}
                  />
                </>
              ) : !hasSelection ? (
                <div className={styles.emptyChat}>{emptyDetailHint}</div>
              ) : selectedKuAi ? (
                <UniImKuAiChat active={open && selectedKuAi} />
              ) : isNotifySection && selectedNotify ? (
                <div className={styles.messageList}>
                  <div className={styles.notifyDetail}>
                    <div className={styles.notifyMeta}>{formatUserMessageTime(selectedNotify)}</div>
                    <div className={styles.notifyContent}>{selectedNotify.content}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.messageList} ref={messageListRef}>
                    {msgLoading ? (
                      <div className={styles.emptyChat}>{t('common.loading')}</div>
                    ) : messageItems.length === 0 ? (
                      <div className={styles.emptyChat}>{t('pages.personal.im.noMessages')}</div>
                    ) : (
                      messageItems.map((item: ImMessage) => {
                        const sender = resolveMessageSender(item);
                        return (
                          <div
                            key={item.uuid}
                            className={`${styles.messageRow} ${sender.isSelf ? styles.messageRowSelf : ''}`}
                          >
                            {sender.isAi ? (
                              <span
                                className={`${styles.imAvatar} ${styles.kuAiListAvatar}`}
                                style={{ width: 36, height: 36 }}
                                aria-hidden
                              >
                                <KuAiLottieMark size={36} />
                              </span>
                            ) : (
                              renderMessageAvatar(
                                sender.fullName,
                                sender.username,
                                sender.isSelf,
                                sender.imageSrc,
                                sender.useTextAvatar,
                                sender.onImageError,
                              )
                            )}
                            <div className={styles.bubbleWrap}>
                              {selectedConversation?.kind === 'group' && !sender.isSelf ? (
                                <div className={styles.senderName}>
                                  {sender.fullName || sender.username}
                                </div>
                              ) : null}
                              <div
                                className={`${styles.bubble} ${sender.isSelf ? styles.bubbleSelf : ''} ${sender.isBot ? styles.bubbleBot : ''}`}
                              >
                                {renderMessageBody(item)}
                              </div>
                              {(() => {
                                const showTaskActions =
                                  canUpdateTasks && !!item.body.trim();
                                const showRecall = canRecallImMessage(
                                  item,
                                  currentUser?.id,
                                );
                                if (!showTaskActions && !showRecall) {
                                  return null;
                                }
                                return (
                                  <div className={styles.bubbleActions}>
                                    {showTaskActions ? (
                                      <>
                                        <Tooltip title={t('components.uniIm.addToTodo')}>
                                          <Button
                                            type="text"
                                            size="small"
                                            className={styles.bubbleActionBtn}
                                            icon={<CheckSquareOutlined />}
                                            loading={addingTodoMessageUuid === item.uuid}
                                            aria-label={t('components.uniIm.addToTodo')}
                                            onClick={() => void onAddMessageToTodo(item)}
                                          />
                                        </Tooltip>
                                        <Tooltip title={t('components.uniIm.addToReminder')}>
                                          <Button
                                            type="text"
                                            size="small"
                                            className={styles.bubbleActionBtn}
                                            icon={<BellOutlined />}
                                            aria-label={t('components.uniIm.addToReminder')}
                                            onClick={() => onOpenAddReminder(item)}
                                          />
                                        </Tooltip>
                                      </>
                                    ) : null}
                                    {showRecall ? (
                                      <Tooltip title={t('components.uniIm.recall')}>
                                        <Button
                                          type="text"
                                          size="small"
                                          className={`${styles.bubbleActionBtn} ${styles.bubbleActionBtnDanger}`}
                                          icon={<RollbackOutlined />}
                                          loading={recallingMessageUuid === item.uuid}
                                          aria-label={t('components.uniIm.recall')}
                                          onClick={() => void onRecallMessage(item)}
                                        />
                                      </Tooltip>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {canCompose ? (
                    <div className={styles.composer}>
                      {selectedConversation?.kind === 'group' && mentionQuery != null ? (
                        <div className={styles.mentionPanel}>
                          <button
                            type="button"
                            className={styles.mentionItem}
                            onClick={() => {
                              setDraft((prev) =>
                                prev.replace(/@([^\s@]*)$/, '@KU-AI '),
                              );
                              setMentionQuery(null);
                            }}
                          >
                            @KU-AI
                          </button>
                          {groupMembers
                            .filter((m: ImMember) => {
                              const q = mentionQuery.trim().toLowerCase();
                              if (!q) {
                                return true;
                              }
                              return (
                                m.label.toLowerCase().includes(q) ||
                                m.username.toLowerCase().includes(q) ||
                                (m.full_name || '').toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 8)
                            .map((m: ImMember) => (
                              <button
                                key={m.user_id}
                                type="button"
                                className={styles.mentionItem}
                                onClick={() => {
                                  const name = m.label || m.username;
                                  setDraft((prev) => prev.replace(/@([^\s@]*)$/, `@${name} `));
                                  setMentionQuery(null);
                                }}
                              >
                                @{m.label || m.username}
                              </button>
                            ))}
                        </div>
                      ) : null}
                      <div className={styles.composerBox}>
                        <Input.TextArea
                          className={styles.composerInput}
                          variant="borderless"
                          value={draft}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDraft(value);
                            if (selectedConversation?.kind === 'group') {
                              const match = value.match(/@([^\s@]*)$/);
                              setMentionQuery(match ? match[1] : null);
                            } else {
                              setMentionQuery(null);
                            }
                          }}
                          placeholder={
                            selectedConversation?.kind === 'group'
                              ? t('components.uniIm.groupInputPlaceholder')
                              : t('pages.personal.im.inputPlaceholder')
                          }
                          autoSize={{ minRows: 3, maxRows: 6 }}
                          onPressEnter={(e) => {
                            if (!e.shiftKey) {
                              e.preventDefault();
                              void onSend();
                            }
                          }}
                        />
                        <div className={styles.composerFooter}>
                          <Button
                            type="primary"
                            className={styles.sendBtn}
                            onClick={() => void onSend()}
                            disabled={!draft.trim()}
                          >
                            {t('pages.personal.im.send')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </main>
          </div>
        </div>
      ) : null}
      <UniImCreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={(uuid) => {
          void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
          setActiveSection('group');
          selectConversation(uuid);
        }}
      />
      <UniImGroupSettingsModal
        open={groupSettingsOpen}
        conversation={selectedConversation?.kind === 'group' ? selectedConversation : null}
        onClose={() => setGroupSettingsOpen(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
          void queryClient.invalidateQueries({ queryKey: ['imMembers', selectedUuid] });
        }}
      />
      <Modal
        title={t('components.uniIm.addToReminder')}
        open={!!reminderSourceMessage}
        onCancel={() => {
          if (reminderSaving) {
            return;
          }
          setReminderSourceMessage(null);
          setReminderAt(null);
          setReminderRemark('');
        }}
        onOk={() => void onConfirmAddReminder()}
        confirmLoading={reminderSaving}
        okText={t('components.uniIm.addReminder')}
        destroyOnHidden
        mask={{ closable: !reminderSaving }}
        zIndex={1100}
      >
        <div className={styles.remindModalBody}>
          <div className={styles.remindField}>
            <div className={styles.remindFieldLabel}>
              {t('components.uniIm.remindMessageContentLabel')}
            </div>
            <div className={styles.remindSourceQuote}>{reminderSourceMessage?.body}</div>
          </div>
          <div className={styles.remindField}>
            <div className={styles.remindFieldLabel}>{t('components.uniIm.remindRemarkLabel')}</div>
            <Input.TextArea
              className={styles.remindRemarkInput}
              value={reminderRemark}
              onChange={(e) => setReminderRemark(e.target.value)}
              placeholder={t('components.uniIm.remindRemarkPlaceholder')}
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={500}
              disabled={reminderSaving}
            />
          </div>
          <div className={styles.remindField}>
            <div className={styles.remindFieldLabel}>{t('components.uniIm.remindAtPlaceholder')}</div>
            <DatePicker
              showTime
              style={{ width: '100%' }}
              value={reminderAt}
              onChange={(value) => setReminderAt(value)}
              placeholder={t('components.uniIm.remindAtPlaceholder')}
              disabled={reminderSaving}
              getPopupContainer={(node) => node.parentElement ?? document.body}
            />
          </div>
        </div>
      </Modal>
    </div>,
    document.body,
  );
}
