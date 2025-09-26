// components/VideoRecorder.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const CLOUD_NAME = "dn5m2txky";
const UPLOAD_PRESET = "rajkiranv";

// Cloudinary upload function
async function uploadToCloudinary(uri: string, _type: "video" | "image") {
  const formData = new FormData();
  formData.append("file", { uri, type: "video/mp4", name: "video.mp4" });
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
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
  onSend: (payload: { video: string } | null) => void;
};

export default function VideoRecorder({
  visible,
  onClose,
  onSend,
}: VideoRecorderProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  // Request permission on mount
  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setRecording(true);
      const video = await cameraRef.current.recordAsync();
      setVideoUri(video.uri);
    } catch (err) {
      console.error("Recording error:", err);
      Alert.alert("Recording error", String(err));
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    try {
      const uploadedUrl = await uploadToCloudinary(videoUri, "video");
      onSend({ video: uploadedUrl });
      setVideoUri(null);
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload failed", String(err));
    }
  };

  // Permissions not granted or null
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.centered}>
          <Text style={{ color: "white" }}>Requesting camera permission…</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Camera permission denied. Please allow camera access.
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
        {videoUri ? (
          <>
            <Video
              source={{ uri: videoUri }}
              style={styles.preview}
              useNativeControls
              resizeMode="contain"
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setVideoUri(null)}>
                <Ionicons name="refresh" size={40} color="orange" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpload}>
                <Ionicons name="send" size={40} color="green" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={40} color="red" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.preview}
            facing="back" // must be string
            isActive={visible} // important for SDK 53
          >
            <View style={styles.controls}>
              {!recording ? (
                <TouchableOpacity onPress={startRecording}>
                  <Ionicons name="radio-button-on" size={70} color="white" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={stopRecording}>
                  <Ionicons name="square" size={70} color="red" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={{ marginLeft: 20 }}>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  preview: { flex: 1, width: "100%" },
  controls: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  errorText: { color: "white", fontSize: 18, textAlign: "center" },
});
