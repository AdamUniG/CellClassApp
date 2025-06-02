// app/label.tsx
import { Category, fetchUnsynced, getNextPicture, saveLabel, syncToFirestore } from '@/src/db';
import { IMAGES } from '@/src/images';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES: Category[] = ['apple','banana','Avo','sabres'];
const COLORS = ['#4CAF50','#2196F3','#FF9800','#E91E63'];

const LAB_LOGO       = require('../assets/images/logosmallclean.png');
const FANFARE_AUDIO = require('../assets/sounds/tada.mp3');
const CONGRATS_IMG  = require('../assets/images/congrats.png');

export default function LabelScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useLocalSearchParams<{ user?: string }>();
  const userId = user && user.length ? user : 'user';

  const [sessionCnt, setSessionCnt]     = useState(0);
  const [totalCnt, setTotalCnt]         = useState(0);
  const [celebrated, setCelebrated]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [currentRow, setCurrentRow] = useState<{
    picture_id: string;
    file_name:  string;
    category:   Category;
  } | null>(null);
  const [currentImg, setCurrentImg] = useState<any>(null);

  // ─── Load the next picture on mount ───
  useEffect(() => {
    loadNext();
  }, []);

  
/*
  async function loadNext() {
    const row = await getNextPicture(userId);
    if (!row) return alert('All done for today! 🎉');
    setCurrentRow(row);

    // find the bundled require(...) for this id
    const imgObj = IMAGES.find(i => i.id === row.picture_id);
    setCurrentImg(imgObj?.img ?? null);
  }
*/

async function loadNext() {
  // 1️⃣ Total pool size
  console.log(`🖼️  Total images in pool: ${IMAGES.length}`);

  // 2️⃣ How many local labels have you created so far?
  const unsyncedRows = await fetchUnsynced(userId);
  console.log(`✍️  You’ve labelled (unsynced) ${unsyncedRows.length} images`);

  // 3️⃣ Try to get the next one
  const row = await getNextPicture(userId);
  console.log('🔍 getNextPicture →', row);

  // 4️⃣ If null, we really are done
  if (!row) {
    alert('All done for today! 🎉');
    return;
  }

  // 5️⃣ Check that we actually bundled that image
  const imgObj = IMAGES.find(i => i.id === row.picture_id);
  console.log(
    `🆔 picture_id = ${row.picture_id}, ` +
    `found in IMAGES? ${!!imgObj}`
  );

  // 6️⃣ Finally set state as before
  setCurrentRow(row);
  setCurrentImg(imgObj?.img ?? null);
}


  async function handlePick(category: Category) {
    if (!currentRow) return;

    // update counters
    const nextSession = sessionCnt + 1;
    setSessionCnt(nextSession);
    setTotalCnt(totalCnt + 1);

    console.log(
    `Image ${currentRow.picture_id} (${currentRow.file_name}) ` +
    `was classified as ${category}`
    );

    // save to local DB
  await saveLabel(userId, currentRow.picture_id, category);
    
  syncToFirestore(userId)
    .then(() =>
      console.log(`✅ Synced to Firestore: ${currentRow.picture_id} → ${category}`)
    )
    .catch(e =>
      console.error('❌ Firestore sync failed', e)
    );


    // celebrate at 10
    if (nextSession === 10 && !celebrated) {
      triggerCelebration();
    }

    // then load another
    await loadNext();
  }

  async function triggerCelebration() {
    setCelebrated(true);
    const { sound } = await Audio.Sound.createAsync(FANFARE_AUDIO);
    await sound.playAsync();
    setTimeout(() => setModalVisible(true), 2000);
    setTimeout(async () => {
      setModalVisible(false);
      await sound.unloadAsync();
    }, 4000);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTxt}>Hey {userId}</Text>
          <Text style={styles.headerTxt}>{sessionCnt} this session</Text>
          <Text style={styles.headerTxt}>{totalCnt} total</Text>
        </View>
        <Image source={LAB_LOGO} style={styles.logo} resizeMode="contain" />
      </View>

      {/* ROI Image */}
      <View style={styles.roiBox}>
        {currentImg
          ? <Image source={currentImg} style={styles.roiImg} resizeMode="contain" />
          : <Text>Loading…</Text>
        }
      </View>

      {/* 2×2 Buttons */}
      <View style={styles.grid}>
        {CATEGORIES.map((cat, i) => (
          <Pressable
            key={cat}
            onPress={() => handlePick(cat)}
            style={({ pressed }) => [
              styles.catBtn,
              { backgroundColor: COLORS[i] },
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
            ]}
          >
            <Text style={styles.catTxt}>{cat}</Text>
          </Pressable>
        ))}
      </View>

      {/* Celebration Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Image
            source={CONGRATS_IMG}
            style={styles.congratsImg}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#FFF', paddingHorizontal:16 },

  headerRow:{
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between', marginBottom:16
  },
  headerBox:{ paddingRight:12 },
  headerTxt:{ fontSize:18, lineHeight:24, fontWeight:'600', color:'#222' },
  logo:{ width:100, height:100 },

  roiBox:{
    width:'100%', aspectRatio:1, borderWidth:1,
    borderRadius:24, justifyContent:'center', alignItems:'center',
    overflow:'hidden', marginBottom:20
  },
  roiImg:{ width:'70%', height:'70%' },

  grid:{
    flexDirection:'row', flexWrap:'wrap',
    justifyContent:'space-between', flexGrow:1,
    paddingBottom:24
  },
  catBtn:{
    flexBasis:'47%', height:110, borderRadius:18,
    alignItems:'center', justifyContent:'center',
    marginBottom:20
  },
  catTxt:{ color:'#FFF', fontSize:20, fontWeight:'700' },

  modalBackdrop:{
    flex:1, backgroundColor:'rgba(0,0,0,0.6)',
    justifyContent:'center', alignItems:'center'
  },
  congratsImg:{ flex: 1, width: '100%', height: '100%' },
});
