
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageBackground, Alert } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-expo';
import useSocket from '@/utils/socket';

type CallStatus = 'initiating' | 'success' | 'failed' | 'cancelled';

const NewCallScreen = () => {
  const { user } = useUser();
  const router = useRouter();
  const navigation = useNavigation();
  const { getToken } = useAuth();
  const socket = useSocket();

  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  // ✅ Added 'type' to params
  const { name, image, id: receiverId, type } = useLocalSearchParams<{ 
    name: string; 
    image: string; 
    id: string; 
    type: 'video' | 'audio' 
  }>();

  const [status, setStatus] = useState<CallStatus>('initiating');

  useEffect(() => {
    // Set header title based on call type
    const callLabel = type === 'video' ? 'Video calling' : 'Calling';
    navigation.setOptions({ title: `${callLabel} ${name}...` });

    if (status === 'initiating') {
      initiateCall();
    }

    const handleCallDeclined = () => {
      if (status === 'initiating') {
        setStatus('cancelled');
        Alert.alert('Call Declined', `${name} is busy.`);
        router.back();
      }
    };

    if (socket) {
      socket.on('call-declined', handleCallDeclined);
    }

    return () => {
      if (socket) {
        socket.off('call-declined', handleCallDeclined);
      }
    };
  }, [status, socket]);

  const initiateCall = async () => {
    try {
      const token = await getToken();
      if (!user?.id) throw new Error("User not available");

      console.log(`📞 Starting ${type} call...`, { callerId: user.id, receiverId });

      // 1. Create call record on backend
      const res = await axios.post(
        `${API_URL}/api/calls`,
        {
          callerId: user.id,
          receiverId,
          callType: type, // ✅ Dynamic type
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const call = res.data;
      console.log("✅ Call record created:", call._id);

      // 2. Navigate to the actual WebRTC Call screen
      if (status === 'initiating') {
        router.replace({
          pathname: '/(tabs)/calls/Call',
          params: {
            callId: String(call._id),
            callerId: String(user.id),
            callerName: user.fullName || 'Me',
            receiverId: String(receiverId),
            type: type, // ✅ Pass type
            isCaller: 'true',
          },
        });
      }
    } catch (err: any) {
      if (status === 'initiating') {
        setStatus('failed');
        console.error("❌ Failed to start call:", err.response ? err.response.data : err.message);
        Alert.alert('Error', 'Failed to start the call. Please try again.');
        router.replace('/(tabs)/contacts');
      }
    }
  };

  const onEndCall = () => {
    if (status === 'initiating') {
      setStatus('cancelled');
      console.log(`CALLING SCREEN: Call to ${name} CANCELLED by user.`);
      router.replace('/(tabs)/contacts');
    }
  };

  return (
    <ImageBackground source={{ uri: image }} style={styles.background} blurRadius={20}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={{ uri: image }} style={styles.avatar} />
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.status}>
                {type === 'video' ? 'Video calling...' : 'Voice calling...'}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onEndCall} style={[styles.button, { backgroundColor: '#FF3B30' }]}>
              <Ionicons name="call" size={40} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Cancel</Text>
          </View>
        </View>
      </BlurView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 100,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 50,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  name: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  status: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  buttonContainer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 60,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  buttonLabel: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
});

export default NewCallScreen;