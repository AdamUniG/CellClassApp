// app/label.tsx
import { Category, deleteLabelFromFirestore, deleteLabelLocal, fetchUnsynced, getNextPicture, saveLabel, syncToFirestore } from '@/src/db';
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

const MAIN_CATEGORIES: Category[] = ['Oli', 'OPC', 'Astro', 'More'];
const ALT_CATEGORIES: Category[] = ['Multiple', 'Unknown', 'Nothing', 'Back'];

const MAIN_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9E9E63'];
const ALT_COLORS  = ['#6A1B9A', '#00897B', '#F44336', '#9E9E63'];

const LAB_LOGO       = require('../assets/images/logosmallclean.png');
const FANFARE_AUDIO = require('../assets/sounds/spell.mp3');
const CONGRATS_IMG_10  = require('../assets/images/con10.png');
const CONGRATS_IMG_30  = require('../assets/images/con30.png');
const CONGRATS_IMG_50  = require('../assets/images/con50.png');


export default function LabelScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useLocalSearchParams<{ user?: string }>();
  const userId = user && user.length ? user : 'user';

  const [altMode, setAltMode] = useState(false);
  const [sessionCnt, setSessionCnt]     = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCongratsImg, setCurrentCongratsImg] = useState<any>(null);

  const [currentRow, setCurrentRow] = useState<{
    picture_id: string;
    category:   Category;
  } | null>(null);
  const [currentImg, setCurrentImg] = useState<any>(null);
  const [zoomed, setZoomed] = useState(false);
  // history stack
   const [history,setHistory,] = useState<Array<{
    picture_id: string; category: Category }>>(
    []
  );


  // ─── Load the next picture on mount ───
  useEffect(() => {
    loadNext();
  }, []);

  


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
    setCurrentImg(imgObj);
    setZoomed(false);
  }
// back boi
  async function handleBack() {
      if (history.length === 0) {
        return; // nothing to undo
      }

      // 1) Pop the last entry from history
      const last = history[history.length - 1];
      setHistory((prev) => prev.slice(0, prev.length - 1));

      try {
        // 2) Delete that label from local SQLite
        await deleteLabelLocal(userId, last.picture_id);

        // 3) If it was already synced to Firestore, delete it there as well
        await deleteLabelFromFirestore(userId, last.picture_id);
      } catch (e) {
        console.warn('Could not delete from remote, continuing anyway:', e);
      }

      // 4) Decrement the session counter
      setSessionCnt((c) => Math.max(0, c - 1));

      // 5) Restore that popped‐off row as the “currentRow”
      setCurrentRow({
        picture_id: last.picture_id,
        category: last.category,
      });

      // 6) Re‐derive the image object so it’s displayed again
      const imgObj = IMAGES.find((i) => i.id === last.picture_id);
      setCurrentImg(imgObj);
    }


  async function handlePick(category: Category) {
    if (!currentRow) return;

    if (category === 'More') {
      setAltMode(true);
      return;
    }

    if (category === 'Back') {
      setAltMode(false);
      return;
    }

    // back to regular mode
    setAltMode(false)
    // history
    setHistory((prev) => [
      ...prev,
      {
        picture_id: currentRow.picture_id,
        category: category,
      },
    ]);

    // update counters
    
    const nextSession = sessionCnt + 1;
    setSessionCnt(nextSession);

    
    console.log(
    `Image ${currentRow.picture_id} was classified as ${category}`
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
    if (nextSession === 10) {
    triggerCelebration(CONGRATS_IMG_10);
  } else if (nextSession === 30) {
    triggerCelebration(CONGRATS_IMG_30);
  } else if (nextSession === 50) {
    triggerCelebration(CONGRATS_IMG_50);
  }

    // then load another
    await loadNext();
  }

  async function triggerCelebration(imageSource: any) {
    setCurrentCongratsImg(imageSource);

    // Play audio immediately:
    const { sound } = await Audio.Sound.createAsync(FANFARE_AUDIO);
    await sound.playAsync();

    // Show modal immediately:
    setModalVisible(true);

    // Hide after 2 seconds, then unload audio:
    setTimeout(async () => {
      setModalVisible(false);
      await sound.unloadAsync();
    }, 2000);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        
        <View style={styles.headerBox}>
          <Text style={styles.headerTxt}>Hey {userId}</Text>
          <Text style={styles.headerTxt}>{sessionCnt} this session</Text>
        </View>
        {/* ←– BACK BUTTON (styled red / muted red) */}
        <Pressable
          onPress={handleBack}
          // Disable the Pressable if there’s nothing to undo
          disabled={history.length === 0}
          style={({ pressed }) => [
            styles.backBtn,
            // If history is empty → muted red, else healthy red
           {
              backgroundColor:
                history.length > 0 ? '#F44336' /* red */ : '#E57373' /* muted red */,
            },
            // When pressed (and enabled), use a darker red for feedback
            pressed && history.length > 0 && { backgroundColor: '#D32F2F' },
          ]}
        >
          <Text style={styles.backTxt}>Back</Text>
        </Pressable>
        <Image source={LAB_LOGO} style={styles.logo} resizeMode="contain" />
      </View>

      {/* ROI Image */}
      <Pressable onPress={() => setZoomed(z => !z)} style={styles.roiBox}>
        {currentImg ? (
          <Image
            source={zoomed ? currentImg.zoomed : currentImg.raw}
            style={styles.roiImg}
            resizeMode="cover"
          />
        ) : (
          <Text>Loading…</Text>
        )}
      </Pressable>

      {/* 2×2 Buttons */}
      <View style={styles.grid}>
        {(altMode ? ALT_CATEGORIES : MAIN_CATEGORIES).map((cat, i) => (
            <Pressable
            key={cat}
            onPress={() => {
              if (cat === 'More') return setAltMode(true);
              if (cat === 'Back') return setAltMode(false);
              handlePick(cat as Category)}}
            style={({ pressed }) => [
              styles.catBtn,
              { backgroundColor: altMode ? ALT_COLORS[i] : MAIN_COLORS[i] },
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
          {currentCongratsImg && (
            <Image
              source={currentCongratsImg}
              style={styles.congratsImg}
              resizeMode="contain"
            />
          )}
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
   backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    borderRadius: 4
  },
  backTxt: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
  headerBox:{ paddingRight:12 },
  headerTxt:{ fontSize:18, lineHeight:24, fontWeight:'600', color:'#222' },
  logo:{ width:100, height:100 },

  roiBox:{
    width:'100%', aspectRatio:1, borderWidth:0,
    borderRadius:24, justifyContent:'center', alignItems:'center',
    overflow:'hidden', marginBottom:20
  },
  roiImg:{ width:'90%', height:'90%' },

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
