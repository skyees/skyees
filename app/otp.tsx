import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaskInput from 'react-native-mask-input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { router } from 'expo-router';
import { useSignUp, useSignIn, isClerkAPIResponseError } from '@clerk/clerk-expo';

const IND_PHONE = [
  '+',
  /\d/,
  /\d/,
  ' ',
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  ' ',
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
];

const LoginPage = () => {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 90 : 0;

  const openLink = (url: string) => Linking.openURL(url);

  const sendOTP = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    try {
      await signUp!.create({ phoneNumber });
      await signUp!.preparePhoneNumberVerification();
      router.push(`/verify/${phoneNumber}`);
    } catch (err: any) {
      if (isClerkAPIResponseError(err)) {
        if (err.errors[0].code === 'form_identifier_exists') {
          // User already signed up → sign in
          const { supportedFirstFactors } = await signIn!.create({ identifier: phoneNumber });
          const phoneFactor: any = supportedFirstFactors.find(f => f.strategy === 'phone_code');
          await signIn!.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: phoneFactor.phoneNumberId });
          router.push(`/verify/${phoneNumber}?signin=true`);
        } else {
          Alert.alert('Error', err.errors[0].message);
        }
      }
    }
    setLoading(false);
  };

 const sendMagicLink = async () => {
   if (!email) return Alert.alert('Error', 'Please enter email');
   setLoading(true);
   try {
     // Try SignUp first (for new users)
     await signUp!.create({ emailAddress: email });
     await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });

     router.push(`/verify/verify-email/${email}`);
   } catch (err: any) {
     if (isClerkAPIResponseError(err) && err.errors[0].code === 'form_identifier_exists') {
       // Already registered → SignIn
       const { supportedFirstFactors } = await signIn!.create({ identifier: email });
       const emailFactor: any = supportedFirstFactors.find(f => f.strategy === 'email_code');
       await signIn!.prepareFirstFactor({
         strategy: 'email_code',
         emailAddressId: emailFactor.emailAddressId,
       });
       router.push(`/verify/verify-email/${email}?signin=true`);
     } else {
       Alert.alert('Error', err.errors?.[0]?.message || 'Something went wrong');
     }
   }
   setLoading(false);
 };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ fontSize: 18, padding: 10 }}>Sending OTP...</Text>
          </View>
        )}

        <Text style={styles.description}>
          Skyees will verify your account. Carrier charges may apply.
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text>India</Text>
            <Ionicons name="chevron-forward" size={20} />
          </View>
          <View style={styles.separator} />
          <MaskInput
            style={styles.input}
            keyboardType="numeric"
            autoFocus
            placeholder="+91 your phone number"
            value={phoneNumber}
            onChangeText={(masked) => setPhoneNumber(masked)}
            mask={IND_PHONE}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, phoneNumber ? styles.enabled : styles.disabled]}
          onPress={sendOTP}
          disabled={!phoneNumber || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next</Text>}
        </TouchableOpacity>

        <Text style={styles.orText}>— OR —</Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity
          style={[styles.button, email ? styles.enabled : styles.disabled]}
          onPress={sendMagicLink}
          disabled={!email || loading}
        >
          <Text style={styles.buttonText}>Login with Email</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          You must be <Text style={styles.link}>at least 16 years old</Text> to register. Learn how Skyees works with the{' '}
          <Text style={styles.link} onPress={() => openLink('https://skyees.com/privacy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20, backgroundColor: Colors.background, gap: 20 },
  description: { fontSize: 14, color: Colors.gray, textAlign: 'center', marginBottom: 10 },
  list: { backgroundColor: '#fff', width: '100%', borderRadius: 10, padding: 10 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 6 },
  separator: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: Colors.gray, opacity: 0.5, marginBottom: 10 },
  input: { backgroundColor: '#fff', width: '100%', fontSize: 16, padding: 10, borderRadius: 8, marginBottom: 10 },
  button: { width: '100%', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 10 },
  enabled: { backgroundColor: Colors.primary },
  disabled: { backgroundColor: Colors.lightGray },
  buttonText: { fontSize: 18, fontWeight: '500', color: '#fff' },
  orText: { textAlign: 'center', marginVertical: 10, color: Colors.gray },
  legal: { fontSize: 12, textAlign: 'center', color: '#000', marginTop: 10 },
  link: { color: Colors.primary },
  loading: { ...StyleSheet.absoluteFillObject, zIndex: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
});

export default LoginPage;
