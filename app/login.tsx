// app/login.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const [name, setName] = useState('');

  function handleLogin() {
    const username = name.trim() ? name.trim() : 'user';
    router.replace({
    pathname: '/label',
    params: { user: username },
  });
  }

  return (
    <View style={styles.container}>

      <Image
        source={require('../assets/images/logosmallclean.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome</Text>

      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />


      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonTxt}>Log in</Text>
      </Pressable>
    </View>
  );
}

const PRIMARY = '#007AFF';          

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:'center', padding:32, gap:24,
              backgroundColor:'#FFFFFF' },

  title:{ fontSize:28, fontWeight:'700', textAlign:'center', marginBottom:12 },

  logo:{ width:160, height:160, alignSelf:'center', marginBottom:8 },

  input:{ borderWidth:1, borderColor:'#DDD', borderRadius:12,
          padding:16, fontSize:16 },

  button:{ backgroundColor:PRIMARY, borderRadius:12, padding:18,
           alignItems:'center', marginTop:8 },

  buttonTxt:{ color:'#FFF', fontSize:18, fontWeight:'600' },
});
