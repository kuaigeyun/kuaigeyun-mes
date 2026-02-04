module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // 'import' plugin removed to prevent build errors. 
            // Ant Design Mobile will work without it (full import), ensuring stability.
            'react-native-reanimated/plugin',
        ],
    };
};
