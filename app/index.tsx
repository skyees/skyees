import React, { useRef, useEffect } from 'react';
import { Link } from 'expo-router';
import {
  Text,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Colors from '@/constants/Colors';

const IndexPage = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

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
  }, []);

  const openLink = () => {
    // Example: Privacy Policy link
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
    styles.headline,
    {
      opacity: fadeAnim,
      transform: [{ translateY: translateYAnim }],
      textAlign: 'center',
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
 headline: {
   textAlign: 'center',
 },
 welcomeSmall: {
   fontSize: 18,
   fontWeight: '400',
   color: '#000',
   marginBottom: 10, // space below
 },
 skyeesBig: {
   fontSize: 50, // bigger font
   fontWeight: '700',
   color: Colors.primary,
   marginBottom: 20, // increased vertical gap
 },
 tagline: {
   fontSize: 24,
   fontWeight: '700',
   color: '#000',
 },
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  headline: { fontSize: 26, fontWeight: '600', marginVertical: 40, textAlign: 'center' },
  welcome: { width: '100%', height: 300, marginBottom: 40 },
  description: { fontSize: 14, textAlign: 'center', marginBottom: 80, color: Colors.gray },
  link: { color: Colors.primary },
  button: { width: '100%', alignItems: 'center' },
  buttonText: { fontSize: 22, color: Colors.primary, fontWeight: 'bold' },
});

export default IndexPage;
