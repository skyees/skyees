import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Dimensions, Animated, StatusBar,
  ImageBackground, Modal, FlatList, TextInput, Alert, 
  PanResponder
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import {
  RTCView,
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
} from "react-native-webrtc";
import { useAuth, useUser } from "@clerk/clerk-expo";
import useSocket from "@/utils/socket";
import { BlurView } from "expo-blur";
import InCallManager from "react-native-incall-manager";
import axios from "axios";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function PrivateCallScreen() {
  const params = useLocalSearchParams();
  const { callId, callerId, receiverId, type: initialType, image, callerName } = params;
  const isCaller = params.isCaller === "true";
  // The 'other person' in this 1-on-1 call
  const targetId = String(isCaller ? receiverId : callerId);

  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const socket = useSocket();

  // --- STATE ---
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(isCaller ? "Calling..." : "Connecting...");
  
  // UI States
  const [isLocalBig, setIsLocalBig] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Contacts / Upgrade State
  const [isAddParticipantVisible, setIsAddParticipantVisible] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false); // Shows spinner while switching to Group Mode

  const [callType, setCallType] = useState(initialType || "video");
  const [isCameraOff, setIsCameraOff] = useState(initialType === "audio");
  const [audioOutput, setAudioOutput] = useState<'speaker' | 'earpiece'>(
    initialType === "video" ? "speaker" : "earpiece"
  );

  // --- REFS ---
  const controlsAnim = useRef(new Animated.Value(150)).current;
  const statusAnim = useRef(new Animated.Value(-120)).current;
  const screenOpacity = useRef(new Animated.Value(0)).current;
  
  // P2P Refs (Single Connection for 1-on-1)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceQueue = useRef<RTCIceCandidate[]>([]);
  const hasHungUp = useRef(false);

  // Pan Responder for Draggable PiP
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { pan.flattenOffset(); },
    })
  ).current;

  // ---------- TIMER ----------
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionStatus === "Connected") {
      interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ---------- CONTACTS & UPGRADE LOGIC ----------
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(res.data);
    } catch (err) { console.log("Contacts error:", err); } 
    finally { setLoadingContacts(false); }
  };

  const handleAddParticipant = (selectedUser: any) => {
    setIsAddParticipantVisible(false);
    setIsUpgrading(true); // Show loading UI

    // 1. Tell Server to Upgrade this Call ID to a Group Room
    // 2. Invite the new person
    // 3. Tell the current peer (targetId) to switch screens
    socket.emit("upgrade-to-group-call", {
      callId, 
      originalPeer: targetId,
      newInvitee: selectedUser.clerkId,
      initiatorName: user?.username || user?.firstName
    });

    // 4. We switch ourselves immediately (or wait for ack)
    setTimeout(() => {
        switchToGroupScreen();
    }, 1500); 
  };

  const switchToGroupScreen = () => {
    // Clean up P2P but keep socket alive
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    // Navigate to the WebView/Group Screen
    // Passing the SAME callId so everyone meets in the same "Room"
    router.replace({
        pathname: "/call/GroupCall",
        params: { callId, username: user?.username, groupName: "Skyees Team Call" }
    });
  };

  // ---------- WEBRTC (1-on-1) ----------
  useEffect(() => {
    if (!socket || !user?.id) return;

    const startCall = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: initialType === "video" ? {
            facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: 30
          } : false
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Setup Peer Connection
        const pc = new RTCPeerConnection(configuration);
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit("ice-candidate", { candidate: e.candidate, to: targetId, callId });
        };
        
        pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setConnectionStatus("Connected");
                Animated.timing(statusAnim, { toValue: -150, duration: 500, useNativeDriver: true }).start();
            }
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') hangup();
        };

        
        // SOCKET LISTENERS
        socket.on("offer", async ({ offer }) => {
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { answer, to: targetId, callId });
            // Process queued ICE
            while (iceQueue.current.length) await pc.addIceCandidate(iceQueue.current.shift()!);
        });

        socket.on("answer", async ({ answer }) => {
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on("ice-candidate", async ({ candidate }) => {
            if (pc) {
                if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
                else iceQueue.current.push(new RTCIceCandidate(candidate));
            }
        });

        // --- UPGRADE LISTENER ---
        // If the OTHER person adds someone, we get this event
        socket.on("call-upgraded", () => {
            Alert.alert("Group Call", "Switching to group mode...", [
                { text: "OK", onPress: () => switchToGroupScreen() }
            ]);
            setTimeout(switchToGroupScreen, 2000); // Auto switch
        });

        socket.on("call-ended", () => hangup());

        // INITIATOR LOGIC
        if (isCaller) {
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            socket.emit("offer", { offer, to: targetId, callId });
        }

      } catch (err) { hangup(); }
    };

    startCall();

    return () => {
        socket.off("offer");
        socket.off("answer");
        socket.off("group-call-invite");
        socket.off("ice-candidate");
        socket.off("call-upgraded");
        socket.off("call-ended");
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (pcRef.current) pcRef.current.close();
    };
  }, [socket, callId]);

  // ---------- HARDWARE & UI ----------
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" }, headerShown: false });
    
    InCallManager.start({ media: initialType === 'video' ? 'video' : 'audio', auto: true });
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

  const switchCamera = () => localStreamRef.current?.getVideoTracks().forEach((t: any) => t._switchCamera());
  
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
  };

  const hangup = () => {
    if (hasHungUp.current) return;
    hasHungUp.current = true;
    try {
      if (pcRef.current) pcRef.current.close();
      socket.emit("call-end", { callId, to: targetId });
    } catch (error) {}
    setShowSummary(true);
  };

  const closeAndRedirect = () => {
    setShowSummary(false);
    router.replace("/(tabs)/calls");
  };

  const avatarUri = (image && typeof image === "string" && image !== "null")
    ? { uri: image } : require("@/assets/images/user-default.jpg");

  const localUrl = localStream ? localStream.toURL() : null;
  const remoteUrl = remoteStream ? remoteStream.toURL() : null;

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar hidden />
      <ImageBackground source={avatarUri} style={StyleSheet.absoluteFill} blurRadius={80}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
      </ImageBackground>

      {/* --- ADD PARTICIPANT MODAL --- */}
      <Modal visible={isAddParticipantVisible} transparent animationType="slide">
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Call</Text>
              <TouchableOpacity onPress={() => setIsAddParticipantVisible(false)}>
                <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
              <TextInput 
                placeholder="Search..." 
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            {loadingContacts ? <ActivityIndicator color="#fff"/> : (
                <FlatList
                data={contacts.filter((c:any) => (c.username||c.name)?.toLowerCase().includes(search.toLowerCase()))}
                keyExtractor={(item:any) => item.clerkId}
                renderItem={({ item }:any) => (
                    <TouchableOpacity style={styles.contactItem} onPress={() => handleAddParticipant(item)}>
                    <Image source={item.profilePic ? { uri: item.profilePic } : require("@/assets/images/user-default.jpg")} style={styles.contactAvatar} />
                    <Text style={styles.contactName}>{item.username || item.name}</Text>
                    <Ionicons name="add-circle" size={26} color="#34C759" />
                    </TouchableOpacity>
                )}
                />
            )}
          </View>
        </BlurView>
      </Modal>

      {/* --- UPGRADING SPINNER --- */}
      {isUpgrading && (
          <View style={styles.upgradingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{color:'#fff', marginTop:10}}>Switching to Group Call...</Text>
          </View>
      )}

      {/* --- SUMMARY MODAL --- */}
      <Modal visible={showSummary} transparent animationType="fade">
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          <View style={styles.summaryBox}>
            <Image source={avatarUri} style={styles.summaryAvatar} />
            <Text style={styles.summaryTitle}>Call Ended</Text>
            <Text style={styles.summaryName}>{callerName}</Text>
            <Text style={styles.summaryDuration}>{formatTime(callDuration)}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={closeAndRedirect}><Text style={styles.closeBtnText}>Done</Text></TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* --- TOP BAR --- */}
      <View style={styles.topBar}>
        {callType === "video" && !isCameraOff && (
          <TouchableOpacity style={styles.circleBtn} onPress={switchCamera}>
            <BlurView intensity={40} tint="light" style={styles.topBtnInner}><Ionicons name="camera-reverse" size={26} color="#fff" /></BlurView>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.circleBtn} onPress={() => { setIsAddParticipantVisible(true); fetchContacts(); }}>
          <BlurView intensity={40} tint="light" style={styles.topBtnInner}><Ionicons name="person-add" size={24} color="#fff" /></BlurView>
        </TouchableOpacity>
      </View>

      {/* --- VIDEO AREA (1-on-1) --- */}
      <View style={styles.mainArea}>
        {callType === "video" ? (
          <View style={styles.videoContainer}>
            {/* Remote Video (Full) */}
            {remoteUrl ? (
              <TouchableOpacity style={styles.fullscreenWrapper} onPress={() => setIsLocalBig(!isLocalBig)} activeOpacity={1}>
                <RTCView 
                    streamURL={isLocalBig && localUrl ? localUrl : remoteUrl} 
                    style={styles.fullscreen} objectFit="cover" mirror={isLocalBig} zOrder={0} 
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.centerInfo}>
                <Image source={avatarUri} style={styles.avatarLarge} />
                <Text style={styles.nameText}>{callerName}</Text>
                <Text style={{color: 'rgba(255,255,255,0.5)', marginTop: 10}}>{connectionStatus}</Text>
              </View>
            )}

            {/* Local Video (Draggable PiP) */}
            {localUrl && (
              <Animated.View 
                style={[styles.pipWrapper, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
                {...panResponder.panHandlers}
               >
                <TouchableOpacity onPress={() => setIsLocalBig(!isLocalBig)} style={{ flex: 1 }}>
                    <RTCView 
                        streamURL={isLocalBig && remoteUrl ? remoteUrl : localUrl} 
                        style={styles.pipVideo} objectFit="cover" mirror={!isLocalBig} zOrder={1} 
                    />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={styles.audioContainer}>
            <View style={styles.avatarRing}><Image source={avatarUri} style={styles.avatarLarge} /></View>
            <Text style={styles.callerNameText}>{callerName}</Text>
            <Text style={styles.audioStatusText}>{connectionStatus === "Connected" ? formatTime(callDuration) : connectionStatus}</Text>
          </View>
        )}
      </View>

      {/* --- CONTROLS --- */}
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
          <TouchableOpacity onPress={hangup} style={[styles.controlBtn, styles.btnEnd]}><MaterialCommunityIcons name="phone-hangup" size={30} color="#fff" /></TouchableOpacity>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  topBar: { position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 100 },
  mainArea: { flex: 1 },
  videoContainer: { flex: 1 },
  fullscreenWrapper: { flex: 1 },
  fullscreen: { width: "100%", height: "100%", backgroundColor: "#121212" },
  pipWrapper: { position: "absolute", top: 120, right: 15, width: 110, height: 160, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "#333", zIndex: 10 },
  pipVideo: { width: "100%", height: "100%" },
  centerInfo: { flex: 1, justifyContent: "center", alignItems: "center" },
  audioContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  avatarRing: { padding: 8, borderRadius: 200, borderWidth: 2, borderColor: "rgba(255,255,255,0.1)", marginBottom: 40 },
  avatarLarge: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, borderColor: "rgba(255,255,255,0.2)" },
  callerNameText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  nameText: { color: "#fff", fontSize: 32, fontWeight: "700", marginTop: 30 },
  audioStatusText: { color: "rgba(255,255,255,0.6)", fontSize: 22, marginTop: 12, fontWeight: "600" },
  controlsContainer: { position: "absolute", bottom: 50, width: "100%", alignItems: "center" },
  controlsDock: { flexDirection: "row", backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 40, paddingVertical: 15, paddingHorizontal: 30, gap: 20 },
  controlBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  btnActive: { backgroundColor: "#fff" },
  btnEnd: { backgroundColor: "#FF3B30", width: 72, height: 60, borderRadius: 30 },
  topBtnInner: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  circleBtn: { marginHorizontal: 5 },
  upgradingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, borderRadius: 15, marginBottom: 20 },
  searchInput: { flex: 1, height: 45, color: '#fff', marginLeft: 10 },
  contactItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 18, marginBottom: 12 },
  contactAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  contactName: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '600' },
  summaryBox: { width: width * 0.8, backgroundColor: "rgba(30,30,30,0.8)", borderRadius: 30, padding: 30, alignItems: "center" },
  summaryAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  summaryTitle: { color: "rgba(255,255,255,0.5)", fontSize: 14, textTransform: "uppercase", marginBottom: 8 },
  summaryName: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 15 },
  summaryDuration: { color: "#fff", fontSize: 18, fontWeight: "600" },
  closeBtn: { backgroundColor: "#fff", paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25 },
  closeBtnText: { color: "#000", fontWeight: "700", fontSize: 16 }
});