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

const Incoming = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const socket = useSocket();
  const { getToken } = useAuth();

  const { callerName, callerId, receiverId, callType, _id: callId, callerImg } =
    useLocalSearchParams();

  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const isNavigating = useRef(false);

  // Use standard Animated values
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(0.94)).current;

  // --- ENTRY ---
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });

    // Start Ringtone
    InCallManager.startRingtone('_BUNDLE_');

    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(screenScale, {
        toValue: 1,
        friction: 10,
        tension: 70,
        useNativeDriver: true
      })
    ]).start();

    return () => {
      InCallManager.stopRingtone();
      // Restore Tabs on cleanup
      parent?.setOptions({ tabBarStyle: { display: "flex" } });
    };
  }, []);

  // --- EXIT LOGIC ---
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
        // Ensure the callback is fired outside the animation frame
        setTimeout(next, 0);
    });
  };

  const safeClose = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    InCallManager.stopRingtone();
    InCallManager.stop();

    const parent = navigation.getParent();

    runExitThen(() => {
      parent?.setOptions({ tabBarStyle: { display: "flex" } });
      // Kill current screen and reset to calls tab
      router.replace('/(tabs)/calls');
    });
  };

  useEffect(() => {
    socket?.on('call-ended', safeClose);
    socket?.on('call-cancelled', safeClose);
    return () => {
      socket?.off('call-ended');
      socket?.off('call-cancelled');
    };
  }, [socket]); // Added socket dependency

  const onAccept = async () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    InCallManager.stopRingtone();

    try {
      const token = await getToken();
      await axios.put(
        `${API_URL}/api/calls/accept`,
        { callId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      runExitThen(() => {
        router.replace({
          pathname: '/(tabs)/calls/Call',
          params: {
            callerName,
            callerId,
            receiverId,
            type: callType,
            callId,
            isCaller: 'false',
            image: callerImg,
            origin: 'calls'
          },
        });
      });

    } catch {
      safeClose();
    }
  };

  const onDecline = async () => {
    try {
      const token = await getToken();
      await axios.put(
        `${API_URL}/api/calls/end`,
        { callId, status: 'missed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {}

    safeClose();
  };

  const avatarUri =
    callerImg && typeof callerImg === "string" && callerImg.trim() !== ""
      ? { uri: callerImg }
      : require("@/assets/images/user-default.jpg");

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity, transform: [{ scale: screenScale }] }]}>
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
            <TouchableOpacity onPress={onDecline} style={[styles.actionBtn, styles.declineBtn]}>
              <MaterialIcons name="call-end" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onAccept} style={[styles.actionBtn, styles.acceptBtn]}>
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