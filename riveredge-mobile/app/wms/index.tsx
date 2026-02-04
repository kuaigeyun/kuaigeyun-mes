import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function WMSIndexScreen() {
    return (
        <>
            <Stack.Screen options={{ title: '仓储物流 (WMS)', headerBackTitle: '工作台' }} />
            <View style={styles.container}>
                <Text style={styles.text}>仓库管理</Text>
                <Text style={styles.subText}>功能开发中...</Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subText: {
        marginTop: 10,
        color: '#888',
    },
});
