
import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaskInput from 'react-native-mask-input';
import Colors from '@/constants/Colors';
import { router } from 'expo-router';
import { isClerkAPIResponseError, useSignIn, useSignUp } from '@clerk/clerk-expo';

const IND_PHONE = [
  `+`,
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

const otp = () => {
  // FIX: Start loading as false
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 90 : 0;

  const { signUp } = useSignUp();
  const { signIn, setActive } = useSignIn();

  const openLink = () => {
    Linking.openURL('https://galaxies.dev');
  };

  // Helper to ensure phone is in strict E.164 format
  function normalizePhone(raw: string): string {
    // 1. Remove all non-numeric characters except the leading plus
    const digitsOnly = raw.replace(/[^\d+]/g, '');

    // 2. If it already starts with +, just return it
    if (digitsOnly.startsWith('+')) {
      return digitsOnly;
    }

    // 3. Otherwise, assume India (+91) if it's missing
    return `+91${digitsOnly}`;
  }

   const sendOTP = async () => {
      setLoading(true);
      const fullPhone = normalizePhone(phoneNumber);

      // LOG this to your terminal to verify it looks like +91XXXXXXXXXX
      console.log('Final Phone Format:', fullPhone);

      try {
        await signUp!.create({
          phoneNumber: fullPhone,
        });
        await signUp!.preparePhoneNumberVerification();
        router.push(`/verify/${fullPhone}`);
      } catch (err) {
        if (isClerkAPIResponseError(err)) {
          if (err.errors[0].code === 'form_identifier_exists') {

              console.log("User exists, switching to Sign In for:", fullPhone);
              await trySignIn(fullPhone); // Ensure this is fullPhone, not phoneNumber

          } else {
            setLoading(false);
            Alert.alert('Error', err.errors[0].message);
          }
        } else {
          setLoading(false);
          Alert.alert('Error', 'An unexpected error occurred');
        }
      }
    };

const trySignIn = async (phone: string) => {try {
      // 1. Initialize the sign-in WITHOUT 'strategy' (not allowed here)
      // Clerk will use the Identifier to find the user
      const { supportedFirstFactors } = await signIn!.create({
        identifier: phone,
      });

      // 2. Look for the phone_code factor in the response
      const firstPhoneFactor = supportedFirstFactors.find((factor: any) => {
        return factor.strategy === 'phone_code';
      });

      if (!firstPhoneFactor) {
        throw new Error('This number does not have phone verification enabled.');
      }

      // 3. Prepare the factor (THIS is where 'phone_code' is valid)
      await signIn!.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: (firstPhoneFactor as any).phoneNumberId,
      });

      router.push(`/verify/${phone}?signin=true`);
    } catch (err) {
      console.log('SignIn Error Details:', JSON.stringify(err, null, 2));
      if (isClerkAPIResponseError(err)) {
        Alert.alert('Error', err.errors[0].message);
      } else {
        Alert.alert('Error', 'Could not sign in. Please check if this number is correct.');
      }
    } finally {
      setLoading(false);
    }
  };
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={{ flex: 1 }}>
      <View style={Styles.container}>
        {/* FIX: Show loading overlay when loading is TRUE */}
        {loading && (
          <View style={Styles.loading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ fontSize: 18, padding: 10 }}>Sending Code...</Text>
          </View>
        )}

        <Text style={Styles.description}>
          WhatsApp will need verify your account. Carrier charges may apply.
        </Text>

        <View style={Styles.list}>
          <View style={Styles.listItem}>
            <Text style={Styles.listItemText}>India</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </View>
          <View style={Styles.separator} />
          <MaskInput
            style={Styles.input}
            keyboardType="numeric"
            autoFocus
            placeholder="+91 your phone number"
            value={phoneNumber}
            onChangeText={(masked) => {
              setPhoneNumber(masked);
            }}
            mask={IND_PHONE}
          />
        </View>

        <Text style={Styles.legal}>
          You must be{' '}
          <Text style={Styles.link}>at least 16 years old</Text> to register, learn how WhatsApp
          works with the{' '}
          <Text style={Styles.link} onPress={openLink}>
            Meta Companies
          </Text>
        </Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[Styles.button, phoneNumber !== '' ? Styles.enabled : null, { marginBottom: insets.bottom + 20 }]}
          onPress={sendOTP}
          disabled={phoneNumber === '' || loading}>
          <Text style={[Styles.buttonText, phoneNumber !== '' ? { color: '#fff' } : null]}>Next</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const Styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
    gap: 20,
  },
  description: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
  },
  list: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 10,
    padding: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
  },
  listItemText: {
    fontSize: 18,
    color: Colors.primary,
  },
  separator: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.gray,
    opacity: 0.5,
    marginVertical: 10,
  },
  legal: {
    fontSize: 12,
    textAlign: 'center',
    color: '#000',
  },
  link: {
    color: Colors.primary,
  },
  button: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: Colors.gray,
    fontSize: 20,
    fontWeight: '600',
  },
  enabled: {
    backgroundColor: Colors.primary,
  },
  input: {
    backgroundColor: '#fff',
    width: '100%',
    fontSize: 20,
    padding: 6,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default otp;