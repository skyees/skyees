// components/VideoRecorder.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Alert,
  Image,
} from "react-native";
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useProfile } from "@/src/contexts/ProfileContext";
import { IMessage } from "react-native-gifted-chat";

const CLOUD_NAME = "dn5m2txky";
const UPLOAD_PRESET = "rajkiranv";

async function uploadToCloudinary(uri: string, type: "video" | "image") {
  const formData = new FormData();
  const fileType = type === "video" ? "video/mp4" : "image/jpeg";
  const fileName = type === "video" ? "video.mp4" : "image.jpg";
  formData.append("file", { uri, type: fileType, name: fileName } as any);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  const json = await res.json();
  return json.secure_url;
}

type VideoRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onSend: (messages: IMessage[]) => void;
  userId?: string;
  userName?: string;
};

export default function VideoRecorder({
  visible,
  onClose,
  onSend,
  userId,
  userName,
}: VideoRecorderProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const { photoUrl } = useProfile();
  const cameraRef = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<"front" | "back">("back");
  const [mode, setMode] = useState<"video" | "picture">("picture");

  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) requestCameraPermission();
      if (!micPermission?.granted) requestMicPermission();
    }
  }, [visible]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      setMode("picture");
      await new Promise(resolve => setTimeout(resolve, 100)); // allow mode to set
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        setPhotoUri(photo.uri);
      }
    } catch (err) {
      console.error("Take picture error:", err);
      Alert.alert("Capture failed", "Could not take a picture.");
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setMode("video");
      await new Promise(resolve => setTimeout(resolve, 100)); // allow mode to set
      setRecording(true);
      const video = await cameraRef.current.recordAsync();
      if (video) {
        setVideoUri(video.uri);
      }
    } catch (err) {
      console.error("Recording error:", err);
      Alert.alert("Recording failed", "An unknown error occurred while recording.");
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const handleUpload = async () => {
    const isPhoto = !!photoUri;
    const uri = photoUri || videoUri;
    if (!uri) return;

    try {
      const uploadedUrl = await uploadToCloudinary(uri, isPhoto ? "image" : "video");
      const message: IMessage = {
        _id: Math.random().toString(36).substring(7),
        text: '',
        [isPhoto ? "image" : "video"]: uploadedUrl,
        createdAt: new Date(),
        user: {
          _id: userId || 'unknown-user',
          name: userName || 'User',
          avatar: photoUrl || undefined,
        },
      };

      onSend([message]);
      setVideoUri(null);
      setPhotoUri(null);
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload failed", "Could not upload the file.");
    }
  };
  
  const resetState = () => {
    setVideoUri(null);
    setPhotoUri(null);
  };

  if (!visible) {
    return null;
  }

  if (!cameraPermission || !micPermission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.centered}>
          <Text style={{ color: "white" }}>Requesting permissions…</Text>
        </View>
      </Modal>
    );
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Camera and Microphone permissions are required.
          </Text>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
            <Ionicons name="close-circle" size={40} color="red" />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {videoUri || photoUri ? (
          <View style={styles.previewContainer}>
            {videoUri && (
              <Video
                source={{ uri: videoUri }}
                style={styles.preview}
                useNativeControls
                isLooping
                resizeMode={Video.RESIZE_MODE_CONTAIN}
              />
            )}
            {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}
            <View style={styles.actions}>
              <TouchableOpacity onPress={resetState}>
                <Ionicons name="refresh" size={40} color="orange" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpload}>
                <Ionicons name="send" size={40} color="green" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={40} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.preview}
            mode={mode}
            facing={cameraType}
            isActive={visible}
          >
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')} style={styles.flipButton}>
                  <Ionicons name="camera-reverse" size={32} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={takePicture}
                onLongPress={startRecording}
                onPressOut={stopRecording}
                style={styles.recordButton}
              >
                <View style={[styles.recordDot, recording && styles.recordDotRecording]}/>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={36} color="white" />
              </TouchableOpacity>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "black", padding: 20 },
  previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  preview: { flex: 1, width: "100%" },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'red',
  },
  recordDotRecording: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  closeButton: {},
  flipButton: {},
  actions: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  errorText: { color: "white", fontSize: 18, textAlign: "center" },
});
