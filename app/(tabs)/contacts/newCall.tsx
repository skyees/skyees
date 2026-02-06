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
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
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
  withSpring
} from 'react-native-reanimated';
import InCallManager from 'react-native-incall-manager';

const NewCallScreen = () => {
  const { user } = useUser();
  const router = useRouter();
  const navigation = useNavigation();
  const { getToken } = useAuth();
  const socket = useSocket();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const { name, image, id: receiverId, type, origin } = useLocalSearchParams();
  const isNavigating = useRef(false);
  const callIdRef = useRef<string | null>(null);

  // Animation values
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);
  const screenOpacity = useSharedValue(0);
  const screenScale = useSharedValue(0.96);

  const avatarSource = image && typeof image === 'string' && image.trim().length > 5
    ? { uri: image }
    : require("@/assets/images/user-default.jpg");

  // ---------- 1. CLEAN NAVIGATION HELPER ----------
  const handleFinalExit = (target: string | object) => {
    const parent = navigation.getParent();
    // Force reset Tab Bar BEFORE we move to prevent white screen flicker
    parent?.setOptions({ tabBarStyle: { display: "flex" } });

    // Use replace once to prevent stack confusion
    router.replace(target as any);
  };

  // ---------- 2. ENTRY & HARDWARE ----------
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });

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
      ), -1, false
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1500 }),
        withTiming(0.5, { duration: 0 })
      ), -1, false
    );

    return () => {
      InCallManager.stopRingback();
      InCallManager.stop();
      parent?.setOptions({ tabBarStyle: { display: "flex" } });
    };
  }, []);

  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }]
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value
  }));

  // ---------- 3. STABLE EXIT FUNCTION ----------
  const safeClose = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    InCallManager.stop();
    
    // Animate out and then navigate on completion
    screenOpacity.value = withTiming(0, { duration: 250 }, () => {
        // We move the logic to a direct call to handle the transition safely
        setTimeout(() => handleFinalExit('/(tabs)/contacts'), 50);
    });
  };

  // ---------- 4. SIGNALING ----------
  useEffect(() => {
    const initiateCall = async () => {
      try {
        const token = await getToken();
        const res = await axios.post(`${API_URL}/api/calls`, 
          { callerId: user?.id, receiverId, callType: type },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        callIdRef.current = String(res.data._id);
      } catch { safeClose(); }
    };

    initiateCall();

    const onAccepted = (data: any) => {
      if (isNavigating.current) return;
      isNavigating.current = true;
      InCallManager.stopRingback();

      screenOpacity.value = withTiming(0, { duration: 200 }, () => {
        setTimeout(() => {
          handleFinalExit({
            pathname: '/(tabs)/calls/Call',
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
        }, 50);
      });
    };

    socket.on('call-ended', safeClose);
    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', safeClose);

    return () => {
      socket.off('call-accepted');
      socket.off('call-declined');
      socket.off('call-ended');
    };
  }, [socket]);

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
            <Text style={styles.status}>{type === 'video' ? 'VIDEO CALLING...' : 'AUDIO CALLING...'}</Text>
          </Animated.View>
          <TouchableOpacity activeOpacity={0.8} onPress={safeClose} style={styles.hangupBtn}>
            <MaterialIcons name="call-end" size={34} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      </ImageBackground>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 100 },
  centerContent: { alignItems: 'center' },
  avatarWrapper: { justifyContent: 'center', alignItems: 'center' },
  pulseRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 30 },
  status: { color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 8, textTransform: 'uppercase', letterSpacing: 2 },
  hangupBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', elevation: 8 }
});

export default NewCallScreen;