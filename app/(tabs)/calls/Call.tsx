import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Dimensions, Animated, StatusBar,
  ImageBackground, Easing
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import {
  RTCView,
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "react-native-webrtc";
import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-expo";
import useSocket from "@/utils/socket";
import { BlurView } from "expo-blur";
import InCallManager from "react-native-incall-manager";

const { width, height } = Dimensions.get("window");

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let globalPC: RTCPeerConnection | null = null;
let globalLocalStream: any = null;

export default function CallScreen() {
  const params = useLocalSearchParams();
  const { callId, callerId, receiverId, type: initialType, image, callerName } = params;
  const isCaller = params.isCaller === "true";

  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const socket = useSocket();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const targetId = isCaller ? receiverId : callerId;

  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(isCaller ? "Calling..." : "Ringing...");
  const [isLocalBig, setIsLocalBig] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [callType, setCallType] = useState(initialType);
  const [isCameraOff, setIsCameraOff] = useState(initialType === "audio");
  const [audioOutput, setAudioOutput] = useState<'speaker'|'earpiece'>(
    initialType === "video" ? "speaker" : "earpiece"
  );

  const controlsAnim = useRef(new Animated.Value(150)).current;
  const statusAnim = useRef(new Animated.Value(-120)).current;
  const screenOpacity = useRef(new Animated.Value(0)).current;

  const localStreamRef = useRef<any>(null);
  const iceQueue = useRef<RTCIceCandidate[]>([]);
  const hasHungUp = useRef(false);

  // ---------- 1. ULTIMATE STACK CLEAR ----------
  const navigateBack = () => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "flex" }, headerShown: true });
    
    // Clear navigation history and reset to tabs
    if (router.canDismiss()) {
        router.dismissAll();
    }
    router.replace("/(tabs)/calls");
  };

  const hangup = async () => {
    if (hasHungUp.current) return;
    hasHungUp.current = true;

    if (globalPC) {
      globalPC.ontrack = null;
      globalPC.onicecandidate = null;
      globalPC.close();
      globalPC = null;
    }
    if (globalLocalStream) {
      globalLocalStream.getTracks().forEach((t: any) => t.stop());
      globalLocalStream = null;
    }
    localStreamRef.current = null;

    socket?.emit("call-end", { callId, to: targetId });
    InCallManager.stop();
    navigateBack();
  };

  // ---------- 2. HARDWARE & TRANSITION ----------
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" }, headerShown: false });

    // 🔊 VOICE FIX: Always start with 'audio' to activate Mic hardware
    InCallManager.start({ media: 'audio' });
    InCallManager.setForceSpeakerphoneOn(callType === "video");
    InCallManager.setKeepScreenOn(true);

    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(controlsAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
      Animated.spring(statusAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();

    return () => {
      InCallManager.stop();
      parent?.setOptions({ tabBarStyle: { display: "flex" }, headerShown: true });
    };
  }, []);

  // ---------- 3. SIGNALING ----------
  useEffect(() => {
    if (!socket || !user?.id) return;

    const start = async () => {
      try {
        socket.emit("register", user.id);
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720, frameRate: 30, facingMode: "user" },
        });

        if (initialType === "audio") stream.getVideoTracks().forEach(t => t.enabled = false);

        globalLocalStream = stream;
        localStreamRef.current = stream;
        setLocalStreamUrl(stream.toURL());

        const pc = new RTCPeerConnection(configuration);
        globalPC = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        // 🚨 REMOTE STREAM FIX: Capture stream instantly
        pc.ontrack = e => {
          if (e.streams && e.streams[0]) {
            setRemoteStreamUrl(e.streams[0].toURL());
          }
        };

        pc.onicecandidate = e => {
          if (e.candidate) socket.emit("ice-candidate", { callId, to: targetId, candidate: e.candidate });
        };

        pc.onconnectionstatechange = () => {
          setConnectionStatus(pc.connectionState);
          if (pc.connectionState === "connected") {
            Animated.timing(statusAnim, { toValue: -150, duration: 500, useNativeDriver: true }).start();
          }
        };

        socket.on("offer", async ({ offer }) => {
          if (pc.signalingState !== "stable") return;
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", { answer, callId, to: targetId });
          while (iceQueue.current.length) await pc.addIceCandidate(iceQueue.current.shift()!);
        });

        socket.on("answer", async ({ answer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          while (iceQueue.current.length) await pc.addIceCandidate(iceQueue.current.shift()!);
        });

        socket.on("ice-candidate", async ({ candidate }) => {
          const ice = new RTCIceCandidate(candidate);
          if (pc.remoteDescription) await pc.addIceCandidate(ice);
          else iceQueue.current.push(ice);
        });

        socket.on("call-ended", hangup);

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { callId, offer, to: targetId });
        }
      } catch { hangup(); }
    };

    start();
    return () => {
      socket.off("offer"); socket.off("answer");
      socket.off("ice-candidate"); socket.off("call-ended");
    };
  }, [callId]);

  // ---------- 4. BUTTONS ----------
  const toggleMute = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getVideoTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        setIsCameraOff(!t.enabled);
        setCallType(t.enabled ? "video" : "audio");
        InCallManager.setForceSpeakerphoneOn(t.enabled);
      }
    }
  };

  const toggleAudioOutput = () => {
    const next = audioOutput === "speaker" ? "earpiece" : "speaker";
    setAudioOutput(next);
    InCallManager.setForceSpeakerphoneOn(next === "speaker");
    InCallManager.setSpeakerphoneOn(next === "speaker");
  };

  const avatarUri = (image && typeof image === "string" && image.trim() !== "" && image !== "null")
    ? { uri: image }
    : require("@/assets/images/user-default.jpg");

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar hidden />
      <ImageBackground source={avatarUri} style={StyleSheet.absoluteFill} blurRadius={80}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
      </ImageBackground>

      <View style={styles.mainArea}>
        {callType === "video" ? (
          <View style={styles.videoContainer}>
            {remoteStreamUrl ? (
              <TouchableOpacity style={styles.fullscreenWrapper} onPress={() => setIsLocalBig(!isLocalBig)} activeOpacity={1}>
                <RTCView
                  streamURL={isLocalBig ? localStreamUrl! : remoteStreamUrl}
                  style={styles.fullscreen}
                  objectFit="cover"
                  mirror={isLocalBig}
                  zOrder={0}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.centerInfo}>
                <Image source={avatarUri} style={styles.avatarLarge} />
                <Text style={styles.nameText}>{callerName}</Text>
                <ActivityIndicator color="#fff" style={{marginTop: 20}} />
              </View>
            )}

            {localStreamUrl && (
              <TouchableOpacity style={styles.pipWrapper} onPress={() => setIsLocalBig(!isLocalBig)}>
                <RTCView
                  streamURL={isLocalBig ? remoteStreamUrl! : localStreamUrl}
                  style={styles.pipVideo}
                  objectFit="cover"
                  mirror={!isLocalBig}
                  zOrder={1}
                />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.audioContainer}>
            <View style={styles.avatarRing}><Image source={avatarUri} style={styles.avatarLarge} /></View>
            <Text style={styles.callerNameText}>{callerName}</Text>
            <Text style={styles.audioStatusText}>{connectionStatus}</Text>
          </View>
        )}
      </View>

      <Animated.View style={[styles.statusPill, { transform: [{ translateY: statusAnim }] }]}>
        <BlurView intensity={30} tint="dark" style={styles.statusPillInner}>
          <View style={[styles.statusDot, { backgroundColor: connectionStatus === "connected" ? "#34C759" : "#FF9F0A" }]} />
          <Text style={styles.statusPillText}>{connectionStatus}</Text>
        </BlurView>
      </Animated.View>

      <Animated.View style={[styles.controlsContainer, { transform: [{ translateY: controlsAnim }] }]}>
        <BlurView intensity={45} tint="dark" style={styles.controlsDock}>
          <TouchableOpacity onPress={toggleAudioOutput} style={[styles.controlBtn, audioOutput === "speaker" && styles.btnActive]}>
            <Ionicons name={audioOutput === "speaker" ? "volume-high" : "phone-portrait-outline"} size={24} color={audioOutput === "speaker" ? "#000" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleCamera} style={[styles.controlBtn, !isCameraOff && styles.btnActive]}>
            <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={26} color={!isCameraOff ? "#000" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleMute} style={[styles.controlBtn, isMuted && styles.btnActive]}>
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={26} color={isMuted ? "#000" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={hangup} style={[styles.controlBtn, styles.btnEnd]}>
            <MaterialCommunityIcons name="phone-hangup" size={30} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  mainArea: { flex: 1 },
  videoContainer: { flex: 1 },
  fullscreenWrapper: { flex: 1 },
  fullscreen: { width: "100%", height: "100%", backgroundColor: "#121212" },
  centerInfo: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarLarge: { width: 135, height: 135, borderRadius: 68, borderWidth: 3, borderColor: "rgba(255,255,255,0.2)" },
  nameText: { color: "#fff", fontSize: 32, fontWeight: "700", marginTop: 25 },
  pipWrapper: { position: "absolute", top: 50, right: 15, width: 110, height: 160, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "#333" },
  pipVideo: { width: "100%", height: "100%" },
  audioContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarRing: { padding: 5, borderRadius: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", marginBottom: 25 },
  callerNameText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  audioStatusText: { color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 10, textTransform: "uppercase" },
  statusPill: { position: "absolute", top: 50, alignSelf: "center" },
  statusPillInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, overflow: "hidden" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusPillText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  controlsContainer: { position: "absolute", bottom: 40, width: "100%", alignItems: "center" },
  controlsDock: { flexDirection: "row", backgroundColor: "rgba(20,20,20,0.4)", borderRadius: 40, paddingVertical: 12, paddingHorizontal: 25, gap: 20 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  btnActive: { backgroundColor: "#fff" },
  btnEnd: { backgroundColor: "#FF3B30", width: 68, height: 56, borderRadius: 28 }
});