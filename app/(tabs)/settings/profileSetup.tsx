import React, { useState } from "react";
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useProfile } from "@/src/contexts/ProfileContext";
import PickImageModal from '@/components/PickImageModal';

const CLOUD_NAME = "dn5m2txky";
const UPLOAD_PRESET = "rajkiranv";

export default function ProfileSetupScreen() {
  // Corrected to use username and profilePic from the context
  const {
    username,
    status,
    profilePic,
    setUsername,
    setStatus,
    setProfilePic,
    saveProfile,
    loading,
  } = useProfile();

  const [showModal, setShowModal] = useState(false);

  const handlePick = (uri: string) => {
    uploadToCloudinary(uri);
  };

  const uploadToCloudinary = async (uri: string) => {
    const data = new FormData();
    data.append("file", {
      uri,
      name: "profile.jpg",
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

    const cloudData = await res.json();
    if (cloudData.secure_url) {
      // Corrected to use setProfilePic
      setProfilePic(cloudData.secure_url);
    } else {
      console.log("Upload failed:", cloudData);
    }
  };

  if (loading) return <Text>Loading profile...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile Info</Text>
      <TouchableOpacity onPress={() => setShowModal(true)}>
        {/* Corrected to use profilePic */}
        {profilePic ? (
          <Image source={{ uri: profilePic }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>+</Text>
          </View>
        )}
        <Text>Change Profile Photo</Text>
      </TouchableOpacity>

      {/* Corrected to use username and setUsername */}
      <TextInput
        style={styles.input}
        placeholder="Your Name"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Status (e.g. Hey there!)"
        value={status}
        onChangeText={setStatus}
      />
      <TouchableOpacity style={styles.button} onPress={saveProfile}>
        <Text style={styles.buttonText}>Save Profile</Text>
      </TouchableOpacity>
      <>
        <PickImageModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          onPick={handlePick}
        />
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 32,
    color: "#075E54", // WhatsApp teal
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#25D366", // WhatsApp green
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  avatarPlaceholderText: {
    fontSize: 40,
    color: "#999999",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#25D366", // WhatsApp green
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 20,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
