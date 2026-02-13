import React, { useEffect, useState } from "react";
import {
  View, StyleSheet, ActivityIndicator, StatusBar, SafeAreaView,
  TouchableOpacity, Text, Alert, Modal, TextInput, FlatList, Image,
  KeyboardAvoidingView, Platform
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Camera } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import axios from "axios";
import useSocket from "@/utils/socket";

const MIROTALK_SERVER_URL = "https://sfu.mirotalk.com";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Hide MiroTalk Native UI Elements via CSS Injection
const HIDE_UI_JS = `
(function() {
  function hide() {
    const ids = ['header','footer','navbar','mirotalk','brand','logo','toolbar','topbar','bottombar','buttons-bar'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display='none';
    });
    // Hide specific class names often used by MiroTalk
    const classes = ['header', 'footer', 'left-navbar', 'right-navbar'];
    classes.forEach(c => {
        const els = document.getElementsByClassName(c);
        for(let el of els) el.style.display='none';
    });
  }
  setInterval(hide, 1000);
})();
true;
`;

export default function CallGroup() {
  const { callId, groupName } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const socket = useSocket();

  const [hasPermission, setHasPermission] = useState(false);

  // Invite Modal
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Features
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState("");
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isHost, setIsHost] = useState(true); // Logic to determine host can be added later

  // 1. Hide Header & Check Permissions
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      if (cam.status === "granted" && mic.status === "granted") {
        setHasPermission(true);
      } else {
        Alert.alert("Permission Error", "Camera and Mic needed.");
        router.back();
      }
    })();
  }, []);

  // 2. Socket Listeners
  useEffect(() => {
    if (socket && callId) {
        socket.emit("join-room", { callId, userId: user?.id });

        // Listen for Chat
        socket.on("group-chat", (message: any) => {
            setChatMessages(prev => [...prev, message]);
            if (!showChat) {
                // Optional: Show a toast or notification dot
            }
        });

        // Listen for Raised Hands
        socket.on("user-raised-hand", ({ user }: any) => {
            Alert.alert("✋ Hand Raised", `${user} raised their hand.`);
        });

        // Listen for Host Actions
        socket.on("group-ended", () => {
            Alert.alert("Call Ended", "The host has ended the meeting.");
            router.replace("/(tabs)/calls");
        });

        socket.on("host-muted-all", () => {
            Alert.alert("Muted", "The host has muted everyone.");
            // You could verify if you can mute local audio via WebView injection here
        });
    }

    return () => {
        socket?.off("group-chat");
        socket?.off("user-raised-hand");
        socket?.off("group-ended");
        socket?.off("host-muted-all");
    };
  }, [socket, callId, showChat]);

  // 3. Functions
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(res.data);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleBulkInvite = () => {
    if (!socket || selectedIds.length === 0) return;
    selectedIds.forEach(uid => {
      socket.emit("group-call-invite", {
        callId, inviteeId: uid, initiatorName: user?.username, type: "video", roomId: callId
      });
    });
    setSelectedIds([]);
    setIsAddModalVisible(false);
    Alert.alert("Success", "Invites sent!");
  };

  // --- CONTROLS ---
  const sendChat = () => {
    if (!msgText.trim()) return;
    const payload = { callId, text: msgText, user: user?.username || "Guest" };
    socket?.emit("group-chat", payload);
    setMsgText("");
  };

  const toggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);
    socket?.emit("raise-hand", { callId, user: user?.username });
    Alert.alert(isHandRaised ? "Hand Lowered" : "Hand Raised", "Others notified.");
  };

  const handleMuteAll = () => {
    Alert.alert("Mute All?", "Mute everyone in the call?", [
        { text: "Cancel", style: "cancel" },
        { text: "Mute", onPress: () => socket?.emit("mute-all", callId) }
    ]);
  };

  const handleEndForAll = () => {
    Alert.alert("End Meeting?", "This will kick everyone out.", [
        { text: "Cancel", style: "cancel" },
        { text: "End", style: "destructive", onPress: () => socket?.emit("group-end", callId) }
    ]);
  };

  // --- RENDER ---
  const roomName = String(Array.isArray(callId) ? callId[0] : callId);
  const title = groupName || "Group Call";
  
  // Random ID to prevent "Username Taken" error on re-join
  const randomId = Math.floor(Math.random() * 9999);
  const displayUser = `${user?.username || "Guest"} ${randomId}`;
  
  const meetingUrl = `${MIROTALK_SERVER_URL}/join/${encodeURIComponent(roomName)}?name=${encodeURIComponent(displayUser)}&audio=true&video=true`;

  if (!hasPermission) return <View style={styles.loading}><ActivityIndicator size="large" color="#34C759"/></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      {/* TOP BAR */}
      <BlurView intensity={50} tint="dark" style={styles.topBar}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={() => setShowChat(true)} style={styles.chatIconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
            {chatMessages.length > 0 && <View style={styles.dot} />}
        </TouchableOpacity>
      </BlurView>

      {/* WEBVIEW */}
      <WebView
        source={{ uri: meetingUrl }}
        style={styles.webview}
        injectedJavaScript={HIDE_UI_JS}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color="#34C759" size="large"/></View>}
        // Handle "Leave" inside WebView
        onNavigationStateChange={(nav) => {
            if (nav.url.includes("thank-you") || nav.url === MIROTALK_SERVER_URL) {
                router.replace("/(tabs)/calls");
            }
        }}
      />

      {/* BOTTOM CONTROLS */}
      <BlurView intensity={80} tint="dark" style={styles.bottomControls}>
        
        {/* Invite */}
        <TouchableOpacity style={styles.ctrl} onPress={() => { setIsAddModalVisible(true); fetchContacts(); }}>
          <Ionicons name="person-add" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Raise Hand */}
        <TouchableOpacity style={[styles.ctrl, isHandRaised && styles.ctrlActive]} onPress={toggleRaiseHand}>
          <Ionicons name="hand-right" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Host: Mute All */}
        {isHost && (
            <TouchableOpacity style={styles.ctrlWarn} onPress={handleMuteAll}>
                <Ionicons name="mic-off" size={22} color="#fff" />
            </TouchableOpacity>
        )}

        {/* Host: End All */}
        {isHost && (
            <TouchableOpacity style={styles.ctrlEnd} onPress={handleEndForAll}>
                <Ionicons name="power" size={22} color="#fff" />
            </TouchableOpacity>
        )}

        {/* Leave (Self) */}
        <TouchableOpacity style={styles.ctrlEnd} onPress={() => router.replace("/(tabs)/calls")}>
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>

      </BlurView>

      {/* --- ADD PARTICIPANT MODAL --- */}
      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite</Text>
                <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                    <Ionicons name="close-circle" size={28} color="#888" />
                </TouchableOpacity>
            </View>
            <FlatList 
                data={contacts}
                keyExtractor={(i:any) => i.clerkId}
                renderItem={({item}) => {
                    const selected = selectedIds.includes(item.clerkId);
                    return (
                        <TouchableOpacity style={[styles.contactItem, selected && styles.contactSelected]} onPress={() => {
                            if(selected) setSelectedIds(p => p.filter(id => id !== item.clerkId));
                            else setSelectedIds(p => [...p, item.clerkId]);
                        }}>
                            <Image source={item.profilePic ? {uri: item.profilePic} : require("@/assets/images/user-default.jpg")} style={styles.contactAvatar}/>
                            <Text style={{color:"#fff", fontSize:16}}>{item.username || item.name}</Text>
                            {selected && <Ionicons name="checkmark-circle" size={22} color="#0A84FF" style={{marginLeft:'auto'}}/>}
                        </TouchableOpacity>
                    );
                }}
            />
            {selectedIds.length > 0 && (
                <TouchableOpacity style={styles.bulkBtn} onPress={handleBulkInvite}>
                    <Text style={{color:"#fff", fontWeight:'bold'}}>Send Invites ({selectedIds.length})</Text>
                </TouchableOpacity>
            )}
          </View>
        </BlurView>
      </Modal>

      {/* --- CHAT MODAL --- */}
      <Modal visible={showChat} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
            <BlurView intensity={95} tint="dark" style={styles.chatWrap}>
                <View style={styles.chatHeader}>
                    <Text style={styles.modalTitle}>Group Chat</Text>
                    <TouchableOpacity onPress={() => setShowChat(false)}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                </View>
                
                <FlatList 
                    data={chatMessages}
                    keyExtractor={(_, i) => String(i)}
                    style={{flex:1}}
                    contentContainerStyle={{padding: 15}}
                    renderItem={({item}) => (
                        <View style={[styles.chatBubble, item.user === user?.username && styles.chatBubbleSelf]}>
                            <Text style={styles.chatUser}>{item.user}</Text>
                            <Text style={styles.chatText}>{item.text}</Text>
                        </View>
                    )}
                />

                <View style={styles.inputArea}>
                    <TextInput 
                        value={msgText} 
                        onChangeText={setMsgText} 
                        style={styles.chatInput} 
                        placeholder="Type a message..." 
                        placeholderTextColor="#aaa"
                    />
                    <TouchableOpacity onPress={sendChat} style={styles.sendBtn}>
                        <Ionicons name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </BlurView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },

  topBar: { 
    position: "absolute", top: 0, width: "100%", 
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, 
    zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems:'center'
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  chatIconBtn: { padding: 5, position: 'relative' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', position: 'absolute', top: 0, right: 0 },

  bottomControls: {
    position: "absolute", bottom: 40, alignSelf: "center",
    flexDirection: "row", paddingVertical: 12, paddingHorizontal: 20, 
    borderRadius: 40, gap: 15, overflow: 'hidden'
  },
  ctrl: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  ctrlActive: { backgroundColor: "#0A84FF" },
  ctrlWarn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FF9500", justifyContent: "center", alignItems: "center" },
  ctrlEnd: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FF3B30", justifyContent: "center", alignItems: "center" },

  // Modals
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { height: "60%", backgroundColor: "#1C1C1E", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  
  contactItem: { flexDirection: 'row', alignItems:'center', padding: 12, backgroundColor: "#2C2C2E", borderRadius: 12, marginBottom: 8 },
  contactSelected: { borderWidth: 1, borderColor: "#0A84FF", backgroundColor: "rgba(10,132,255,0.1)" },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  bulkBtn: { backgroundColor: "#0A84FF", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 10 },

  // Chat
  chatWrap: { flex: 1, paddingTop: 50 },
  chatHeader: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#333' },
  chatBubble: { alignSelf: 'flex-start', backgroundColor: '#333', padding: 10, borderRadius: 12, marginBottom: 10, maxWidth: '80%' },
  chatBubbleSelf: { alignSelf: 'flex-end', backgroundColor: '#0A84FF' },
  chatUser: { color: '#aaa', fontSize: 10, marginBottom: 2 },
  chatText: { color: '#fff', fontSize: 16 },
  inputArea: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderColor: '#333', backgroundColor: '#1C1C1E' },
  chatInput: { flex: 1, backgroundColor: '#333', color: '#fff', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  sendBtn: { marginLeft: 10, justifyContent: 'center', backgroundColor: '#0A84FF', width: 40, height: 40, borderRadius: 20, alignItems: 'center' }
});