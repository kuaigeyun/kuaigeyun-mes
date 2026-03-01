/**
 * 消息中心 - 列表、未读标记、详情、标记已读
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@ant-design/react-native';
import {
  getUserMessages,
  getUserMessageStats,
  getUserMessage,
  markMessagesRead,
  UserMessage,
  UserMessageStatsResponse,
} from '../../src/services/messageService';

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function MessageScreen() {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [stats, setStats] = useState<UserMessageStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailModal, setDetailModal] = useState<UserMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMessages = useCallback(async (p = 1, append = false) => {
    try {
      if (p === 1) setLoading(true);
      const res = await getUserMessages({ page: p, page_size: 20 });
      if (append) {
        setMessages((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
      } else {
        setMessages(res.items || []);
      }
      setTotal(res.total);
      setPage(p);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await getUserMessageStats();
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadMessages(1), loadStats()]);
  }, [loadMessages, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const openDetail = async (msg: UserMessage) => {
    setDetailModal(msg);
    setDetailLoading(true);
    try {
      const full = await getUserMessage(msg.uuid);
      setDetailModal(full);
      if (msg.status !== 'read') {
        await markMessagesRead([msg.uuid]);
        loadStats();
      }
    } catch {
      setDetailModal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const markAllRead = async () => {
    const unread = messages.filter((m) => m.status !== 'read');
    if (unread.length === 0) return;
    try {
      await markMessagesRead(unread.map((m) => m.uuid));
      loadAll();
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>消息中心</Text>
        {stats && stats.unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677ff']} />
        }
      >
        {loading && messages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1677ff" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="inbox" size={48} color="#d9d9d9" />
            <Text style={styles.emptyText}>暂无消息</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <TouchableOpacity
              key={msg.uuid}
              style={[styles.msgItem, msg.status !== 'read' && styles.msgItemUnread]}
              onPress={() => openDetail(msg)}
              activeOpacity={0.7}
            >
              <View style={styles.msgRow}>
                <Text style={styles.msgSubject} numberOfLines={1}>
                  {msg.subject || msg.content?.slice(0, 30) || '无标题'}
                </Text>
                <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
              </View>
              <Text style={styles.msgPreview} numberOfLines={2}>
                {msg.content || ''}
              </Text>
              {msg.status !== 'read' && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 详情弹窗 */}
      <Modal
        visible={!!detailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detailModal?.subject || '消息详情'}</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)} style={styles.modalClose}>
                <Icon name="close" size="md" color="#666" />
              </TouchableOpacity>
            </View>
            {detailLoading ? (
              <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 40 }} />
            ) : (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalTime}>
                  {detailModal?.created_at
                    ? new Date(detailModal.created_at).toLocaleString('zh-CN')
                    : ''}
                </Text>
                <Text style={styles.modalText}>{detailModal?.content || ''}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  markAllBtn: { padding: 4 },
  markAllText: { fontSize: 14, color: '#1677ff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 40 },
  loadingWrap: { padding: 60, alignItems: 'center' },
  emptyWrap: { padding: 60, alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: '#999' },
  msgItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    position: 'relative',
  },
  msgItemUnread: { backgroundColor: '#f0f7ff' },
  msgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  msgSubject: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333' },
  msgTime: { fontSize: 12, color: '#999', marginLeft: 8 },
  msgPreview: { fontSize: 14, color: '#666', lineHeight: 20 },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1677ff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  modalClose: { padding: 4 },
  modalBody: { padding: 16, maxHeight: 400 },
  modalTime: { fontSize: 12, color: '#999', marginBottom: 12 },
  modalText: { fontSize: 15, color: '#333', lineHeight: 24 },
});
