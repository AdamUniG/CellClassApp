// app/_layout.tsx
import { bootstrap } from '@/src/db';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, SafeAreaView, StyleSheet, View } from 'react-native';

export default function RootLayout() {
  // ─── 1) Load your custom font ─────────────────────────
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // ─── 2) Track when your DB bootstrap is done ──────────
  const [dbReady, setDbReady] = useState(false);

  // ─── 3) Perform your bootstrap exactly once ────────────
  useEffect(() => {
    (async () => {
      await bootstrap();
      setDbReady(true);
    })();
  }, []);

  // ─── 4) Early-return while loading ─────────────────────
  if (!fontsLoaded || !dbReady) {
    return null;
  }

  // ─── 5) Render your app wrapped for web sizing ──────────
  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.inner}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="label" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
    </SafeAreaView>
  );
}

const windowHeight = Platform.OS === 'web'
   ? Dimensions.get('window').height
   : undefined;

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    height: windowHeight ?? '100%',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'space-between',
    paddingVertical: 16,
    alignSelf: 'center',
  },
});
