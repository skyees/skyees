import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ImageBackground, StatusBar, Animated, Easing, StyleSheet
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import useSocket from '@/utils/socket';
import InCallManager from 'react-native-incall-manager';
<StatusBar hidden={true} />

const Incoming = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const socket = useSocket();
  const { getToken } = useAuth();
 
  const { callerName, callerId, receiverId, callType, _id: callId, callerImg } =
    useLocalSearchParams();
 const callMode = callType === 'video' ? 'video' : 'audio';
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const isNavigating = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(0.94)).current;
 

  useEffect(() => {
  InCallManager.startRingtone("_DEFAULT_");

  return () => {
    InCallManager.stopRingtone();
  };
}, []);

useEffect(() => {
  // 1. Initialize InCallManager with the correct media profile
  // Setting 'media' warms up the audio driver for the next screen
  InCallManager.start({ 
    media: callType === 'video' ? 'video' : 'audio',
    ringback: '_BUNDLE_' 
  });

  // 2. DO NOT force speakerphone here
  // Forcing speakerphone often overrides the system silent/vibrate switch
  InCallManager.setForceSpeakerphoneOn(false); 

  // 3. Start Ringtone using the 'ringtone' type
  // This tells the OS to respect the physical silent/vibrate switch
  InCallManager.startRingtone("_DEFAULT_", "ringtone");

  // Entrance animations...
  Animated.parallel([
    Animated.timing(screenOpacity, { 
      toValue: 1, 
      duration: 260, 
      useNativeDriver: true 
    }),
    Animated.spring(screenScale, { 
      toValue: 1, 
      friction: 10, 
      useNativeDriver: true 
    })
  ]).start();

  return () => {
    // Stop sound but keep the manager session alive if moving to the Call screen
    InCallManager.stopRingtone();
  };
}, [callType]);

  // ---------- SAFE EXIT ANIMATION ----------
  const runExitThen = (next: () => void) => {
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(screenScale, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      // ✅ FIX: removed setTimeout — direct call is safe
      next();
    });
  };

const safeClose = () => {
  if (isNavigating.current) return;
  isNavigating.current = true;

  // Kill ALL hardware immediately
  InCallManager.stopRingtone();
  InCallManager.stopRingback();
  InCallManager.stop();

  runExitThen(() => {
    
    // Ensure we end up on the calls tab
    router.replace('/(tabs)/calls');
  });
};

  // ---------- SOCKET EVENTS ----------
useEffect(() => {
  if (!socket || !callId) return;

  const handleRemoteEnd = (data) => {
    // FIX: Server sends '_id', frontend sometimes uses 'callId'
    const remoteCallId = data._id || data.callId;
      console.log("🔚 Remote end received for:1", remoteCallId);
    if (remoteCallId === callId) {
      console.log("🔚 Remote end received for:2", remoteCallId);
      
      // Stop audio immediately
      InCallManager.stopRingtone();
      InCallManager.stop();
      
      // Close the screen
      safeClose();
    }
  };

  socket.on('call-ended', handleRemoteEnd);
  socket.on('call-cancelled', handleRemoteEnd);

  return () => {
    socket.off('call-ended', handleRemoteEnd);
    socket.off('call-cancelled', handleRemoteEnd);
  };
}, [socket, callId]);

 // ---------- UPDATED ACTIONS ----------
const onAccept = async () => {
  // 1. Prevent double-taps immediately
  if (isNavigating.current) return;
  isNavigating.current = true;

  // 2. STOP RINGTONE INSTANTLY (Don't wait for animations)
  try {
    InCallManager.stopRingtone();
    // Force stop all manager activity before starting the new session in CallScreen
    InCallManager.stop(); 
  } catch (e) {
    console.log("Audio stop error:", e);
  }

  try {
    const token = await getToken();
    await axios.put(
      `${API_URL}/api/calls/accept`,
      { callId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 3. Run the visual exit, then navigate
    runExitThen(() => {
      router.replace({
        pathname: '/call/Call',
        params: {
          callerName,
          callerId,
          receiverId,
          type: callMode,
          callId,
          isCaller: 'false',
          image: callerImg,
          origin: 'calls'
        },
      });
    });
  } catch (error) {
    console.error("Accept API Error:", error);
    isNavigating.current = false; // Allow retry if API failed
    safeClose();
  }
};

const onDecline = async () => {
  // 1. Silence the device immediately
  InCallManager.stopRingtone();
  InCallManager.stop();
  
  // 2. Trigger the exit animation
  safeClose();

  // 3. Background API cleanup
  try {
    const token = await getToken();
    axios.put(
      `${API_URL}/api/calls/end`,
      { callId, status: 'missed' },
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => {});
    
    // Also notify caller via socket if needed
    socket?.emit("call-declined", { to: callerId, callId });
  } catch (err) {}
};

 const avatarUri = (callerImg && typeof callerImg === "string" && callerImg.trim() !== "")
  ? { uri: callerImg }
  : require("@/assets/images/user-default.jpg");
  return (
    <Animated.View style={[
      styles.root,
      { opacity: screenOpacity, transform: [{ scale: screenScale }] }
    ]}>
      <ImageBackground source={avatarUri} style={styles.bg} blurRadius={60}>
        <StatusBar hidden />

        <BlurView intensity={30} tint="dark" style={styles.blur}>
          <View />

          <View style={styles.center}>
            <Image source={avatarUri} style={styles.avatar} />
            <Text style={styles.name}>{callerName}</Text>

            <View style={styles.typeBadge}>
              <Ionicons
                name={callType === 'video' ? 'videocam' : 'call'}
                size={16}
                color="#fff"
                style={styles.typeIcon}
              />
              <Text style={styles.typeText}>
                INCOMING {callType === 'video' ? 'VIDEO' : 'AUDIO'}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onDecline}
              style={[styles.actionBtn, styles.declineBtn]}
            >
              <MaterialIcons name="call-end" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onAccept}
              style={[styles.actionBtn, styles.acceptBtn]}
            >
              <MaterialIcons
                name={callType === 'video' ? 'videocam' : 'call'}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

        </BlurView>
      </ImageBackground>
    </Animated.View>
  );
};

export default Incoming;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  blur: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 90
  },
  center: { alignItems: 'center' },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    marginBottom: 20
  },
  name: { color: '#fff', fontSize: 32, fontWeight: '700' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10
  },
  typeIcon: { marginRight: 6 },
  typeText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 40 },
  actionBtn: {
    width: 75,
    height: 75,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center'
  },
  declineBtn: { backgroundColor: '#FF3B30' },
  acceptBtn: { backgroundColor: '#34C759' }
});
