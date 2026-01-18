import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

export default function PickImageModal({ visible, onClose, onPick }) {
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const CLOUD_NAME = "dn5m2txky";
  const UPLOAD_PRESET = "rajkiranv"; // must be an unsigned preset if you’re not signing

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);

      const filename = `upload_${Date.now()}.jpg`;
      const cleanUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;

      const data = new FormData();
      data.append("file", {
        uri: cleanUri,
        name: filename,
        type: "image/jpeg",
      } as any);
      data.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: data,
        }
      );

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error?.message || "Cloud upload failed.";
        throw new Error(msg);
      }

      setUploading(false);
      const url = json.secure_url || json.url;
      if (!url) throw new Error("No URL returned from Cloudinary.");
      return url;
    } catch (err: any) {
      setUploading(false);
      Alert.alert("Upload failed", err?.message || "Could not upload image.");
      throw err;
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need access to your gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setPreviewUri(result.assets[0].uri); // ✅ save for preview
      try {
        const cloudUrl = await uploadImage(result.assets[0].uri);
        onPick(cloudUrl);
        onClose();
      } catch {}
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setPreviewUri(result.assets[0].uri); // ✅ save for preview
      try {
        const cloudUrl = await uploadImage(result.assets[0].uri);
        onPick(cloudUrl);
        onClose();
      } catch {}
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {uploading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#007AFF" />
              {previewUri && (
                <Image source={{ uri: previewUri }} style={{ width: 80, height: 80, marginTop: 10 }} />
              )}
              <Text style={{ marginTop: 10 }}>Uploading to Cloud...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Choose an option</Text>
              <TouchableOpacity style={styles.option} onPress={pickFromGallery}>
                <Text style={styles.optionText}>Pick from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option} onPress={takePhoto}>
                <Text style={styles.optionText}>Take a Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
  },
  cancel: {
    marginTop: 10,
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: "#f00",
  },
});