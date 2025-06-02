import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function SplashScreen() {
  useEffect(() => {
    const id = setTimeout(() => router.replace('/login'), 2000);   // 1 s
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/sopsplashfin.png')}  
        style={styles.img}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:'center', alignItems:'center',
              backgroundColor:'#FFFFFF' },
  img: { flex: 1, width: '100%', height: '100%' }
  });
