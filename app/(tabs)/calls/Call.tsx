import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  RTCView,
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "react-native-webrtc";
import axios from "axios";
import Colors from "@/constants/Colors";
import { useAuth } from "@clerk/clerk-expo";
import useSocket from "@/utils/socket";

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

const CallScreen = () => {
  const { callId, callerId, receiverId, callerName, type, isCaller = "false" } =
    useLocalSearchParams<{
      callId: string;
      callerId: string;
      receiverId: string;
      callerName: string;
      type: "video" | "audio";
      isCaller: "true" | "false";
    }>();

  const router = useRouter();
  const { getToken } = useAuth();
  const socket = useSocket();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const isEndingCall = useRef(false);
  const [isLocalBig, setIsLocalBig] = useState(false);


  useEffect(() => {
    if (!socket || !callId || !callerId || !receiverId) return;

    console.log("🎬 Initializing WebRTC setup...");
    console.log("🔍 Role:", isCaller === "true" ? "Caller" : "Receiver");
    console.log("📡 Socket ID:", socket.id);

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    if (isCaller === "false") {
      console.log("📡 Registering offer listener (receiver only)");
      socket.on("offer", async ({ offer }) => {
        console.log("📩 Offer received from caller");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("📡 Remote description set (offer)");
        await flushIceQueue(pc);
        console.log("🧊 ICE queue flushed after offer");
        const answer = await pc.createAnswer();
        console.log("📡 Answer created");
        await pc.setLocalDescription(answer);
        console.log("📡 Local description set (answer)");
        socket.emit("answer", { answer, callId, to: callerId });
        console.log("📡 Answer emitted to caller");
      });

      console.log("🙋 Receiver signaling ready");
      socket.emit("receiver-ready", { callId, to: callerId });
      console.log("📡 receiver-ready emitted to caller");
    }



    if (isCaller === "true") {
      console.log("📡 Registering receiver-ready listener (caller only)");
    socket.on("receiver-ready", async ({ callId: readyId }) => {
    if (readyId !== callId) return;
    console.log("✅ Receiver ready — waiting for local media...");
    const waitForLocalStream = async () => {
     let retries = 0;
     while (
       (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0) &&
       retries < 50
     ) {
       await new Promise((r) => setTimeout(r, 100));
       retries++;
     }
     if (retries >= 50) {
       console.warn("⚠️ Local media not ready — skipping offer");
       return false;
     }
     return true;
   };

   const ready = await waitForLocalStream();
   if (!ready) return;


    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { offer, callId, to: receiverId });
  });

      socket.on("answer", async ({ answer }) => {
        console.log("📩 Answer received from receiver");
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("📡 Remote description set (answer)");
        await flushIceQueue(pc);
        console.log("🧊 ICE queue flushed after answer");
      });
    }

    socket.on("ice-candidate", async ({ candidate }) => {
      console.log("🧊 ICE candidate received");
      const ice = new RTCIceCandidate(candidate);
      if (pc.remoteDescription) {
        await pc.addIceCandidate(ice).catch((e) => console.error("⚠️ addIceCandidate error:", e));
        console.log("🧊 ICE candidate added");
      } else {
        console.log("🧊 Remote not ready, queueing ICE candidate");
        iceCandidateQueue.current.push(ice);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const targetId = isCaller === "true" ? receiverId : callerId;
        console.log("🧊 Emitting ICE candidate to", targetId);
        socket.emit("ice-candidate", { callId, to: targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 ontrack fired");
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        setRemoteStreamUrl(remoteStream.toURL());
        console.log("📡 Remote stream set");

        console.log("🔍 Remote stream tracks:", remoteStream.getTracks());
        console.log("🔍 Remote video tracks:", remoteStream.getVideoTracks());
        console.log("🔊 Remote audio tracks:", remoteStream.getAudioTracks());
        remoteStream.getAudioTracks().forEach((track) => {
          console.log(`🔊 Audio track | enabled: ${track.enabled} | muted: ${track.muted} | state: ${track.readyState}`);
        });
        remoteStream.getVideoTracks().forEach((track) => {
          console.log(`🎥 Remote video track | enabled: ${track.enabled} | state: ${track.readyState}`);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state changed:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setConnected(true);
        console.log("✅ Peer connection established");
      }
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        console.log("⚠️ Peer connection lost — ending call");
        endCall();
      }
    };

    (async () => {
      console.log("🎥 Getting user media...");
      const localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      localStreamRef.current = localStream;
      setLocalStreamUrl(localStream.toURL());
      console.log("🎥 Local stream set");

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
        console.log(`🎥 Track added: ${track.kind} | enabled: ${track.enabled} | state: ${track.readyState}`);
      });

      console.log("🔍 Local stream tracks:", localStream.getTracks());
      console.log("🔍 Local video tracks:", localStream.getVideoTracks());

      if (isCaller === "true") {
        console.log("📞 Caller waiting for receiver...");
      }
    })();

    return () => {
      console.log("🧹 Cleaning up WebRTC and socket listeners");
      socket.off("receiver-ready");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      pc.close();
    };
  }, [socket, callId]);

  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks();
    if (audioTracks && audioTracks.length > 0) {
      audioTracks[0].enabled = !audioTracks[0].enabled;
      setIsMuted(!audioTracks[0].enabled);
      console.log(`🎙️ Microphone ${audioTracks[0].enabled ? "unmuted" : "muted"}`);
    }
  };

const swapViews = () => {
  setIsLocalBig((prev) => !prev);
};



  const flushIceQueue = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length && pc.remoteDescription) {
      const ice = iceCandidateQueue.current.shift();
      if (ice) await pc.addIceCandidate(ice).catch((e) => console.error(e));
    }
  };

  const endCall = async () => {
    if (isEndingCall.current) return;
    isEndingCall.current = true;
    console.log("📞 Ending call...");

    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());

    const token = await getToken();
    const targetId = isCaller === "true" ? receiverId : callerId;
    socket.emit("call-end", { callId, to: targetId });

    await axios.put(
      `${API_URL}/api/calls/end`,
      { callId, status: "ended" },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    router.replace('/(tabs)/contacts');
    router.replace("/(tabs)/calls");
  };


 return (
   <SafeAreaView style={styles.container}>
     {type === "video" ? (
       <View style={styles.videoContainer}>
         {(remoteStreamUrl || localStreamUrl) ? (
           <>
             {/* Fullscreen video */}
             <TouchableOpacity style={styles.fullscreenWrapper} onPress={swapViews}>
               <RTCView
                 streamURL={isLocalBig ? localStreamUrl : remoteStreamUrl}
                 style={styles.fullscreenVideo}
                 objectFit="cover"
                 mirror={isLocalBig}
               />
             </TouchableOpacity>

             {/* PiP video */}
             <TouchableOpacity style={styles.pipWrapper} onPress={swapViews}>
               <RTCView
                 streamURL={isLocalBig ? remoteStreamUrl : localStreamUrl}
                 style={styles.pipVideo}
                 objectFit="cover"
                 mirror={!isLocalBig}
               />
             </TouchableOpacity>
           </>
         ) : (
           <View style={styles.waiting}>
             <Text style={{ color: "#fff" }}>
               {connected ? "Starting..." : `Connecting with ${callerName}...`}
             </Text>
           </View>
         )}
       </View>
     ) : (
       <View style={styles.audioContainer}>
         <Text style={styles.audioText}>
           {connected ? `Voice Call with ${callerName}` : `Connecting with ${callerName}...`}
         </Text>
       </View>
     )}

     <View style={styles.controls}>
       <TouchableOpacity
         style={[styles.controlBtn, { backgroundColor: isMuted ? "#888" : Colors.primary }]}
         onPress={toggleMute}
       >
         <Ionicons name={isMuted ? "mic-off" : "mic"} size={30} color="white" />
       </TouchableOpacity>

       <TouchableOpacity
         style={[styles.controlBtn, { backgroundColor: Colors.red }]}
         onPress={endCall}
       >
         <Ionicons name="call" size={30} color="white" />
       </TouchableOpacity>
     </View>
   </SafeAreaView>
 );

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  videoContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  remoteVideo: { width: "100%", height: "100%" },
    videoContainer: {
      flex: 1,
      backgroundColor: "#000",
    },
    fullscreenWrapper: {
      flex: 1,
    },
    fullscreenVideo: {
      width: "100%",
      height: "100%",
    },
    pipWrapper: {
      position: "absolute",
      bottom: 100,
      right: 20,
      width: 120,
      height: 180,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "#fff",
      elevation: 10,
      backgroundColor: "#000",
    },
    pipVideo: {
      width: "100%",
      height: "100%",
    },
   localVideo: {
    width: 120,
    height: 180,
    position: "absolute",
    bottom: 120,
    right: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  waiting: { flex: 1, justifyContent: "center", alignItems: "center" },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  controlBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  audioContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  audioText: { color: "#fff", fontSize: 20 },
});

export default CallScreen;
