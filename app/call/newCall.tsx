import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageBackground,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-expo';
import useSocket from '@/utils/socket';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  Easing,
  runOnJS,
  withSpring
} from 'react-native-reanimated';
import InCallManager from 'react-native-incall-manager';

const NewCallScreen = () => {
  const { user } = useUser();
  const router = useRouter();
  const { getToken } = useAuth();
  const socket = useSocket();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const { name, image, id: receiverId, type, origin } = useLocalSearchParams();

  const [status, setStatus] = useState('initiating');
  const callIdRef = useRef<string | null>(null);
  const isNavigating = useRef(false);

  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);
  const screenOpacity = useSharedValue(0);
  const screenScale = useSharedValue(0.96);
  
  const avatarSource =
    image && typeof image === 'string' && image.trim().length > 5
      ? { uri: image }
      : require("@/assets/images/user-default.jpg");

  // ---------- ANIMATIONS ----------
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 400 });
    screenScale.value = withSpring(1, { damping: 15, stiffness: 100 });

    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1500, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1500 }),
        withTiming(0.5, { duration: 0 })
      ),
      -1,
      false
    );

    // Start ringtone immediately
    InCallManager.start({ media: 'audio', ringback: '_BUNDLE_' });

    return () => {
      InCallManager.stopRingback();
      InCallManager.stop();
    };
  }, []);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value
  }));

  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }]
  }));

  // ---------- NAVIGATION HELPERS ----------
  
  const runExit = useCallback((next: () => void) => {
    'worklet'; 
    // Note: 'worklet' directive is for UI thread, but we are calling JS callbacks.
    // It's safer to keep this simple or use runOnJS inside the callback.
    screenScale.value = withTiming(0.94, { duration: 200 });
    screenOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(next)();
      }
    });
  }, []);

  const safeClose = useCallback(() => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    InCallManager.stopRingtone();
    InCallManager.stopRingback();
    InCallManager.stop();

    runExit(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/calls');
      }
    });
  }, [router, runExit]);

  // ---------- SOCKET EVENTS ----------

  const onAccepted = useCallback((data: any) => {
    console.log("Call Accepted:", data);
    if (isNavigating.current) return;
    isNavigating.current = true;
    
    InCallManager.stopRingback(); // Stop ringback immediately

    runExit(() => {
      // Navigate to the active call screen
      // We use 'replace' so the user can't "go back" to the ringing screen
      router.replace({
        pathname: '/call/Call',
        params: {
          callId: data._id || data.callId || callIdRef.current,
          callerId: user?.id,
          receiverId,
          callerName: name, // Name of person we are calling
          type,
          isCaller: 'true',
          image,
          origin
        },
      });
    });
  }, [name, receiverId, type, image, origin, user?.id, runExit, router]);

  useEffect(() => {
    // 1. Initiate Call API
    const initiateCall = async () => {
      try {
        const token = await getToken();
        // Important: Make sure 'receiverId' is actually the ID string, not an object
        const res = await axios.post(
          `${API_URL}/api/calls`,
          { 
            callerId: user?.id, 
            receiverId: Array.isArray(receiverId) ? receiverId[0] : receiverId, 
            callType: type 
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const newCallId = String(res.data._id);
        callIdRef.current = newCallId;

        // Emit socket event to join room
        socket?.emit("join-call-room", { callId: newCallId });

      } catch (error) {
        console.error("Initiate call failed:", error);
        safeClose();
      }
    };

    if (status === 'initiating') {
      initiateCall();
    }

    // 2. Setup Listeners
    socket.on('call-ended', safeClose);
    socket.on('call-declined', safeClose);
    socket.on('call-accepted', onAccepted);

    // 3. Cleanup
    return () => {
      socket.off('call-ended', safeClose);
      socket.off('call-declined', safeClose);
      socket.off('call-accepted', onAccepted);
    };
  }, [status, socket, user?.id, receiverId, type, onAccepted, safeClose]);


  // ---------- HANDLERS ----------

  const onCancelPress = async () => {
    if (isNavigating.current) return;
    
    InCallManager.stopRingback();
    
    // Emit end event
    socket?.emit("call-end", { 
      to: receiverId, 
      callId: callIdRef.current 
    });

    // API update if we have a call ID
    if (callIdRef.current) {
      const token = await getToken();
      axios.put(`${API_URL}/api/calls/end`, 
        { callId: callIdRef.current, status: "missed" },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch((err) => console.log("Error ending call API", err));
    }

    safeClose();
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
      <StatusBar hidden />

      <ImageBackground source={avatarSource} style={styles.background} blurRadius={80}>
        <BlurView intensity={45} tint="dark" style={styles.container}>
          <View />

          <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.centerContent}>
            <View style={styles.avatarWrapper}>
              <Animated.View style={[styles.pulseRing, animatedRingStyle]} />
              <Image source={avatarSource} style={styles.avatar} />
            </View>

            <Text style={styles.name}>{name}</Text>
            <Text style={styles.status}>
              {type === 'video' ? 'VIDEO CALLING...' : 'AUDIO CALLING...'}
            </Text>
          </Animated.View>

          <TouchableOpacity onPress={onCancelPress} style={styles.hangupBtn}>
            <MaterialIcons name="call-end" size={34} color="#fff" />
          </TouchableOpacity>

        </BlurView>
      </ImageBackground>
    </Animated.View>
  );
};

export default NewCallScreen;

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 100 },
  centerContent: { alignItems: 'center' },
  avatarWrapper: { justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 30 },
  status: { color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 8, textTransform: 'uppercase', letterSpacing: 2 },
  hangupBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF3B30', shadowOpacity: 0.5, shadowRadius: 15, elevation: 8
  }
});