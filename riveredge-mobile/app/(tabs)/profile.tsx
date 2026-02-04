import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function ProfileScreen() {
    const handleLogout = () => {
        router.replace('/(auth)/login');
    };

    const menuItems = [
        { title: '账号安全', icon: '🔐' },
        { title: '关于我们', icon: 'ℹ️' },
        { title: '通用设置', icon: '⚙️' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>👤</Text>
                </View>
                <View>
                    <Text style={styles.name}>管理员</Text>
                    <Text style={styles.role}>系统管理员</Text>
                </View>
            </View>

            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.menuItem}>
                        <View style={styles.menuLeft}>
                            <Text style={styles.menuIcon}>{item.icon}</Text>
                            <Text style={styles.menuText}>{item.title}</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
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
        backgroundColor: '#1890ff',
        paddingTop: 60,
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
        fontSize: 20,
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
        color: '#333',
    },
    arrow: {
        fontSize: 20,
        color: '#999',
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
