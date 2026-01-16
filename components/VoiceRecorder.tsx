import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

// ========= ADDED: Cloudinary Configuration =========
const CLOUD_NAME = "dn5m2txky";
const UPLOAD_PRESET = "rajkiranv";

const uploadToCloudinary = async (uri: string) => {
  const data = new FormData();
  data.append('file', {
    uri,
    name: `audio-${Date.now()}.m4a`,
    type: 'audio/m4a',
  } as any);
  data.append('upload_preset', UPLOAD_PRESET);
  data.append('resource_type', 'video'); // Cloudinary uses the 'video' resource type for audio

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      {
        method: 'POST',
        body: data,
      }
    );
    const cloudData = await res.json();
    if (cloudData.secure_url) {
      return cloudData.secure_url;
    } else {
      console.error("Cloudinary upload failed:", cloudData);
      throw new Error("Cloudinary upload failed");
    }
  } catch (error) {
    console.error("Error uploading to cloudinary", error);
    throw error;
  }
};
// ===================================================

interface VoiceRecorderProps {
  visible: boolean;
  onClose: () => void;
  onSend: (message: any) => void;
  userId: string;
}

const VoiceRecorder = ({ visible, onClose, onSend, userId }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setLoading(true);
    try {
      await recording?.stopAndUnloadAsync();
      const uri = recording?.getURI();
      if (!uri) throw new Error('No URI found');

      // Correctly call the upload function
      const audioUrl = await uploadToCloudinary(uri);

      onSend([
        {
          _id: Date.now().toString(),
          createdAt: new Date(),
          user: { _id: userId },
          audio: audioUrl,
        },
      ]);
     console.log('Recording audioUrl', audioUrl);
    } catch (err) {
      console.error('Recording error:', err);
    } finally {
      setRecording(null);
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color="#000" />
          ) : (
            <>
              <Text style={styles.label}>
                {recording ? 'Recording... Tap to stop' : 'Tap mic to start recording'}
              </Text>
              <TouchableOpacity
                style={styles.micButton}
                onPress={recording ? stopRecording : startRecording}
              >
                <Ionicons name={recording ? 'stop-circle' : 'mic'} size={64} color="#ff4040" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default VoiceRecorder;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: 250,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
  },
  label: {
    marginBottom: 20,
    fontSize: 16,
  },
  micButton: {
    marginBottom: 20,
  },
  cancelBtn: {
    marginTop: 10,
  },
});
