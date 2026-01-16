import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import io from 'socket.io-client';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';

const IncomingCallScreen = () => {
  const { callId, callerId, callerName, callerImg, type } = useLocalSearchParams();
  const router = useRouter();
  const { getToken, user } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const socket = io(API_URL);

  // Auto-listen for call cancel
  useEffect(() => {
    socket.on('call-cancelled', (id) => {
      if (id === callId) router.back();
    });
    return () => socket.disconnect();
  }, []);

  const handleAccept = async () => {
    const token = await getToken();
    await axios.patch(
      `${API_URL}/api/calls/${callId}`,
      { status: 'accepted' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    socket.emit('call-accepted', { callId, receiverId: user.id });
    router.replace({
      pathname: '/(tabs)/calls/CallScreen',
      params: { callId, callerId, callerName, callerImg, type, isReceiver: true },
    });
  };

  const handleReject = async () => {
    const token = await getToken();
    await axios.patch(
      `${API_URL}/api/calls/${callId}`,
      { status: 'rejected' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    socket.emit('call-rejected', { callId, receiverId: user.id });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: callerImg }} style={styles.avatar} />
      <Text style={styles.name}>{callerName}</Text>
      <Text style={styles.subtitle}>
        {type === 'video' ? 'Video Call' : 'Voice Call'} Incoming...
      </Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.red }]} onPress={handleReject}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.green }]} onPress={handleAccept}>
          <Ionicons name="call" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20 },
  name: { fontSize: 22, fontWeight: '600', color: '#000' },
  subtitle: { color: Colors.gray, marginVertical: 10 },
  buttons: { flexDirection: 'row', gap: 50, marginTop: 50 },
  btn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IncomingCallScreen;
