/**
 * 个人中心 - Ant Design Mobile 规范
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@ant-design/react-native';
import { logout, getStoredUser } from '../../src/services/authService';
import { getUserProfile } from '../../src/services/userProfileService';
import { getFilePreview } from '../../src/services/fileService';
import { BASE_URL } from '../../src/services/api';

export default function ProfileScreen() {
    const [userName, setUserName] = useState('用户');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const [u, profile] = await Promise.all([
                getStoredUser(),
                getUserProfile().catch(() => null),
            ]);
            if (u?.full_name) setUserName(u.full_name);
            else if (u?.username) setUserName(u.username);
            if (profile?.full_name || profile?.username) {
                setUserName(profile.full_name || profile.username || '用户');
            }
            const avatarUuid = profile?.avatar || u?.avatar;
            if (avatarUuid && typeof avatarUuid === 'string' && avatarUuid.length > 0) {
                try {
                    const previewInfo = await getFilePreview(avatarUuid, true);
                    if (previewInfo.preview_url) {
                        let processedUrl = previewInfo.preview_url;
                        if (processedUrl.includes('localhost') || processedUrl.includes('127.0.0.1')) {
                            const match = processedUrl.match(/https?:\/\/[^\/]+(.*)/);
                            if (match?.[1]) processedUrl = match[1];
                        }
                        const base = BASE_URL.replace(/\/api\/v1\/?$/, '');
                        const url = processedUrl.startsWith('http')
                            ? processedUrl
                            : `${base}${processedUrl.startsWith('/') ? '' : '/'}${processedUrl}`;
                        setUserAvatar(url);
                    }
                } catch {
                    setUserAvatar(null);
                }
            } else {
                setUserAvatar(null);
            }
        };
        load();
    }, []);

    const handleLogout = async () => {
        await logout();
        router.replace('/(auth)/login');
    };

    const menuItems = [
        { title: '通用设置', icon: 'setting', path: '/settings' },
        { title: '关于我们', icon: 'info-circle', path: '/about' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    {userAvatar ? (
                        <Image source={{ uri: userAvatar }} style={styles.avatarImage} onError={() => setUserAvatar(null)} />
                    ) : (
                        <Text style={styles.avatarText}>{userName.charAt(0) || '?'}</Text>
                    )}
                </View>
                <View>
                    <Text style={styles.name}>{userName}</Text>
                    <Text style={styles.role}>操作员</Text>
                </View>
            </View>

            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={() => router.push(item.path as any)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuLeft}>
                            <Icon name={item.icon as any} size="md" color="#1677ff" style={styles.menuIcon} />
                            <Text style={styles.menuText}>{item.title}</Text>
                        </View>
                        <Icon name="right" size="xs" color="#999" />
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={styles.logoutButtonText}>退出登录</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f9',
    },
    header: {
        backgroundColor: '#1677ff',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 30,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
        marginRight: 15,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 60,
        height: 60,
    },
    avatarText: {
        fontSize: 30,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    role: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
    },
    menuContainer: {
        backgroundColor: '#fff',
        marginTop: 16,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIcon: {
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
        color: '#333',
    },
    logoutButton: {
        backgroundColor: '#ff4d4f',
        marginHorizontal: 20,
        marginTop: 40,
        padding: 14,
        borderRadius: 4,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
