import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RTCView, mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import io from 'socket.io-client';
import Colors from '@/constants/Colors';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Optional TURN server (for production)
    // { urls: 'turn:turn.yourserver.com', username: 'user', credential: 'pass' },
  ],
};

const CallScreen = () => {
  const { callId, callerId, callerName, type, isReceiver } = useLocalSearchParams();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const socket = useRef(io(API_URL)).current;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [pc, setPc] = useState(null);

  // ✅ Initialize peer connection
  useEffect(() => {
    const initCall = async () => {
      const newPc = new RTCPeerConnection(configuration);
      setPc(newPc);

      // Get local media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      setLocalStream(stream);
      stream.getTracks().forEach((track) => newPc.addTrack(track, stream));

      newPc.onaddstream = (event) => {
        setRemoteStream(event.stream);
      };

      // WebRTC signaling setup
      socket.on('offer', async (offer) => {
        if (isReceiver) {
          await newPc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await newPc.createAnswer();
          await newPc.setLocalDescription(answer);
          socket.emit('answer', { answer, callId, to: callerId });
        }
      });

      socket.on('answer', async (answer) => {
        await newPc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('ice-candidate', async (candidate) => {
        try {
          await newPc.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ICE candidate', err);
        }
      });

      newPc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, callId });
        }
      };

      // Initiate call if caller
      if (!isReceiver) {
        const offer = await newPc.createOffer();
        await newPc.setLocalDescription(offer);
        socket.emit('offer', { offer, callId, to: callerId });
      }
    };

    initCall();

    // Cleanup
    return () => {
      socket.emit('call-end', { callId });
      localStream?.getTracks().forEach((t) => t.stop());
      remoteStream?.getTracks().forEach((t) => t.stop());
      pc?.close();
      socket.disconnect();
    };
  }, []);

  const endCall = async () => {
    const token = await getToken();
    await axios.patch(
      `${API_URL}/api/calls/${callId}`,
      { status: 'ended' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    socket.emit('call-end', { callId });
    router.replace('/(tabs)/calls');
  };

  return (
    <SafeAreaView style={styles.container}>
      {type === 'video' ? (
        <View style={styles.videoContainer}>
          {remoteStream ? (
            <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} />
          ) : (
            <View style={styles.waiting}><Text style={{ color: '#fff' }}>Waiting for user...</Text></View>
          )}

          {localStream && (
            <RTCView streamURL={localStream.toURL()} style={styles.localVideo} />
          )}
        </View>
      ) : (
        <View style={styles.audioContainer}>
          <Text style={styles.audioText}>Voice Call with {callerName}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: Colors.red }]} onPress={endCall}>
          <Ionicons name="call" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  remoteVideo: { width: '100%', height: '100%' },
  localVideo: { width: 120, height: 180, position: 'absolute', bottom: 20, right: 20, borderRadius: 12 },
  waiting: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { position: 'absolute', bottom: 40, alignSelf: 'center' },
  controlBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  audioText: { color: '#fff', fontSize: 20 },
});

export default CallScreen;
