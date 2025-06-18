// app/_layout.tsx
import { bootstrap } from '@/src/db';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  // ─── 1) Load your custom font ─────────────────────────
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // ─── 2) Track when your DB bootstrap is done ──────────
  const [dbReady, setDbReady] = useState(false);

  // ─── 4) Perform your bootstrap exactly once ────────────
  useEffect(() => {
    (async () => {
      await bootstrap();
      setDbReady(true);
    })();
  }, []);

  // ─── 5) Early‐return the *UI only* until everything is ready ─
  if (!fontsLoaded || !dbReady) {
    return null;
  }

  // ─── 6) Now render your app with theme & routing ───────
  return (
      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="login"  />
        <Stack.Screen name="label"  />
        <Stack.Screen name="+not-found" />
      </Stack>
  );
}
