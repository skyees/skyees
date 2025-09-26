import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';

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

        const  recording  = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
        await recording.startAsync();



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

      const audioUrl = await uploadToCloudinary(uri, 'audio');
      onSend([
        {
          _id: Date.now().toString(),
          createdAt: new Date(),
          user: { _id: userId },
          audio: audioUrl,
        },
      ]);
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