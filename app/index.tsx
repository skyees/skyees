import React, { useRef, useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Link } from 'expo-router';
import {
  Text,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Colors from '@/constants/Colors';

const IndexPage = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  // intro animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim]);

  // FCM setup
  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          const token = await messaging().getToken();
          console.log("----------------------------");
          console.log("🚀 YOUR DEVICE TOKEN:");
          console.log(token);
          console.log("----------------------------");
        }
      } catch (error) {
        console.log("FCM Token Error:", error);
      }
    };

    setupNotifications();
  }, []);

  const openLink = () => {
    // keep placeholder — no logic change
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/welcome.png')}
        style={styles.welcome}
        resizeMode="contain"
      />

      <Animated.Text
        style={[
          styles.headlineBlock,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        <Text style={styles.welcomeSmall}>Welcome to{'\n'}</Text>
        <Text style={styles.skyeesBig}>Skyees{'\n'}</Text>
        <Text style={styles.tagline}>Life. Game. Changer.</Text>
      </Animated.Text>

      <Text style={styles.description}>
        Read our{' '}
        <Text style={styles.link} onPress={openLink}>
          Privacy Policy
        </Text>
        . Tap "Agree & Continue" to accept the{' '}
        <Text style={styles.link} onPress={openLink}>
          Terms of Service
        </Text>
        .
      </Text>

      <Link href="/otp" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Agree & Continue</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  welcome: {
    width: '100%',
    height: 300,
    marginBottom: 40,
  },

  // merged — avoids duplicate key override
  headlineBlock: {
    textAlign: 'center',
    marginVertical: 40,
  },

  welcomeSmall: {
    fontSize: 18,
    fontWeight: '400',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },

  skyeesBig: {
    fontSize: 50,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },

  tagline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },

  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 80,
    color: Colors.gray,
  },

  link: {
    color: Colors.primary,
  },

  button: {
    width: '100%',
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 22,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});

export default IndexPage;
