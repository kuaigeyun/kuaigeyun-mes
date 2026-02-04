import React from 'react';
import { StyleSheet, Platform, ViewStyle, View } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassCardProps {
    children?: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, intensity = 40 }) => {
    const isWeb = Platform.OS === 'web';

    // On Web, we can enhance the effect with explicit backdrop-filter if needed, 
    // but expo-blur handles it. We just need to ensure background color allows light through.

    return (
        <BlurView intensity={intensity} tint="light" style={[styles.container, style]}>
            {children}
        </BlurView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        backgroundColor: Platform.select({
            web: 'rgba(255, 255, 255, 0.6)',
            default: 'rgba(255, 255, 255, 0.5)',
        }),
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 24,
        elevation: 8, // Android shadow
    },
});
