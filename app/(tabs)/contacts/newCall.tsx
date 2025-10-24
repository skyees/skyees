// In F:/whatsapp/app/(tabs)/contacts/newCall.tsx

import { View, Text, StyleSheet, Image, TouchableOpacity, ImageBackground } from 'react-native';
import React, { useEffect } from 'react'; // 1. Import useEffect
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'; // 2. Import useNavigation
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const NewCallScreen = () => {
  const router = useRouter();
  const navigation = useNavigation(); // 3. Get the navigation object
  const { name, image, id } = useLocalSearchParams<{ name: string; image: string; id: string }>();

  // 4. Use useEffect to set the title after the component loads
  useEffect(() => {
    if (name) {
      // This function updates the header title of the current screen
      navigation.setOptions({ title: `Calling ${name}...` });
    }
  }, [name, navigation]); // Re-run this effect if the name or navigation object changes

  const onEndCall = () => {
    console.log(`CALLING SCREEN: Call to ${name} (ID: ${id}) ENDED by user.`);
    router.back();
  };

  return (
    <ImageBackground source={{ uri: image }} style={styles.background} blurRadius={20}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={{ uri: image }} style={styles.avatar} />
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.status}>Ringing...</Text>
          </View>

          <View style={styles.buttonContainer}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity onPress={onEndCall} style={[styles.button, { backgroundColor: '#FF3B30' }]}>
                <Ionicons name="close" size={40} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>End Call</Text>
            </View>
          </View>
        </View>
      </BlurView>
    </ImageBackground>
  );
};

// ... Your styles remain the same
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 100,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 50,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  name: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  status: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  buttonContainer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 60,
  },
  buttonGroup: {
    alignItems: 'center',
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  buttonLabel: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
});

export default NewCallScreen;
