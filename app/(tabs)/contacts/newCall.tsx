import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageBackground,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter} from 'expo-router';
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

  const [status] = useState('initiating');
  const callIdRef = useRef<string | null>(null);
  const isNavigating = useRef(false);

  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);
  const screenOpacity = useSharedValue(0);
  const screenScale = useSharedValue(0.96);
  const callType = type === 'video' ? 'video' : 'audio';
  const avatarSource =
    image && typeof image === 'string' && image.trim().length > 5
      ? { uri: image }
      : require("@/assets/images/user-default.jpg");

  // ---------- ENTRY ----------
  useEffect(() => {

    InCallManager.start({
      media: type === 'video' ? 'video' : 'audio',
      ringback: '_BUNDLE_'
    });

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

  // ---------- EXIT (same model as Incoming) ----------
  const runExit = (next: () => void) => {
    'worklet';
    screenScale.value = withTiming(0.94, { duration: 200 });
    screenOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(next)();
    });
  };

  const safeClose = () => {
  if (isNavigating.current) return;
  isNavigating.current = true;

  InCallManager.stopRingback();
  InCallManager.stop();

  runExit(() => {
    router.replace('/(tabs)/calls');
  });
};
  // ---------- SIGNALING ----------
  useEffect(() => {
    if (status === 'initiating') initiateCall();

    const onAccepted = (data: any) => {
      if (isNavigating.current) return;
      isNavigating.current = true;
      InCallManager.stopRingback();

      runExit(() => {
      router.replace({
        pathname: '/call/Call',
        params: {
          callId: data._id || data.callId,
          callerId: user?.id,
          receiverId,
          callerName: name,
          type,
          isCaller: 'true',
          image,
          origin
        },
      });
    });
    };

    socket.on('call-ended', safeClose);
    socket.on('call-declined', safeClose);
    socket.on('call-accepted', onAccepted);

    return () => {
      socket.off('call-ended');
      socket.off('call-declined');
      socket.off('call-accepted');
    };
  }, [status, socket, user?.id, receiverId, type]);

  const initiateCall = async () => {
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/api/calls`,
        { callerId: user?.id, receiverId, callType: type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      callIdRef.current = String(res.data._id);
    } catch {
      safeClose();
    }
  };

 const onCancelPress = async () => {
  // 1. SILENCE IMMEDIATELY
  // Kill audio drivers first so the user hears the call stop
  try {
    InCallManager.stopRingback();
    InCallManager.stop();
  } catch (e) {
    console.warn("Audio cleanup error", e);
  }

  // 2. SIGNAL THE OTHER SIDE
  // Emit the event so the receiver's screen also closes
  socket?.emit("call-end", { to: receiverId, callId: callIdRef.current });

  // 3. FORCE NAVIGATION (The "Nuclear" Option)
  if (isNavigating.current) return;
  isNavigating.current = true;

  const performExit = () => {
    // Force a replace to the calls tab to clear the modal stack
    router.replace('/(tabs)/calls');
  };

  // Attempt the smooth animation...
  runExit(() => {
    performExit();
  });

  // ...but set a 300ms fallback. If the animation hangs, we force the exit anyway.
  setTimeout(performExit, 300);

  // 4. CLEANUP BACKEND (Non-blocking)
  if (callIdRef.current) {
    getToken().then(token => {
      axios.put(`${API_URL}/api/calls/end`, 
        { callId: callIdRef.current, status: "missed" },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {}); // Catch silently
    });
  }
};

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
      <ImageBackground source={avatarSource} style={styles.background} blurRadius={80}>
        <StatusBar barStyle="light-content" hidden />

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
