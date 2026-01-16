import Colors from '@/constants/Colors';
import { useSignUp, isClerkAPIResponseError, useSignIn } from '@clerk/clerk-expo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field';

const CELL_COUNT = 6;

const Page = () => {
  const { phone, signin } = useLocalSearchParams<{ phone: string; signin: string }>();
  const [code, setCode] = useState('');
  const router = useRouter();

  const ref = useBlurOnFulfill({ value: code, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({ value: code, setValue: setCode });
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { signIn, setActive: setSignInActive } = useSignIn();

  useEffect(() => {
    if (code.length === 6) {
      console.log("🔢 Code entered fully:", code);
      if (signin === 'true') {
        verifySignIn();
      } else {
        verifyCode();
      }
    }
  }, [code]);

const verifyCode = async () => {
  try {
    const result = await signUp!.attemptPhoneNumberVerification({ code });
    console.log("Created session:", result.createdSessionId);
    if (result.status === 'complete') {
      await setSignUpActive!({ session: result.createdSessionId });
      router.replace('/(tabs)/chats');
    } else if (result.status === 'missing_requirements') {
      const updatedSignUp = await signUp!.update({
        username: `user_${Math.floor(Math.random() * 100000)}`,
      });
      if (updatedSignUp.status === 'complete') {
        await setSignUpActive!({ session: updatedSignUp.createdSessionId }); // ✅ fixed
        router.replace('/(tabs)/chats');
      }
    }
  } catch (err) {
    if (isClerkAPIResponseError(err)) {
      if (err.errors[0].message.includes('already been verified') && signUp?.createdSessionId) {
        await setSignUpActive!({ session: signUp.createdSessionId });
        router.replace('/(tabs)/chats');
        return;
      }
      Alert.alert('Error', err.errors[0].message);
    }
  }
};

const verifySignIn = async () => {
  try {
    const result = await signIn!.attemptFirstFactor({ strategy: 'phone_code', code });
    console.log("Created session:", result.createdSessionId);
    if (result.status === 'complete') {
      await setSignInActive!({ session: result.createdSessionId }); // ✅ use result
      router.replace('/(tabs)/chats');
    }
  } catch (err) {
    if (isClerkAPIResponseError(err)) {
      if (err.errors[0].message.includes('already been verified') && signIn?.createdSessionId) {
        await setSignInActive!({ session: signIn.createdSessionId });
        router.replace('/(tabs)/chats');
        return;
      }
      Alert.alert('Error', err.errors[0].message);
    }
  }
};

  const resendCode = async () => {
    try {
      if (signin === 'true') {
        const { supportedFirstFactors } = await signIn!.create({ identifier: phone });
        const firstPhoneFactor: any = supportedFirstFactors.find(f => f.strategy === 'phone_code');
        await signIn!.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: firstPhoneFactor.phoneNumberId });
      } else {
        await signUp!.create({ phoneNumber: phone });
        await signUp!.preparePhoneNumberVerification();
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        Alert.alert('Error', err.errors[0].message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: phone }} />
      <Text style={styles.legal}>We have sent you an SMS with a code to the number above.</Text>
      <Text style={styles.legal}>To complete your phone number verification, please enter the 6-digit activation code.</Text>

      <CodeField
        ref={ref}
        {...props}
        value={code}
        onChangeText={setCode}
        cellCount={CELL_COUNT}
        rootStyle={styles.codeFieldRoot}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        renderCell={({ index, symbol, isFocused }) => (
          <View key={index} onLayout={getCellOnLayoutHandler(index)} style={[styles.cellRoot, isFocused && styles.focusCell]}>
            <Text style={styles.cellText}>{symbol || (isFocused ? <Cursor /> : null)}</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.button} onPress={resendCode}>
        <Text style={styles.buttonText}>Didn't receive a verification code?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20, backgroundColor: Colors.background, gap: 20 },
  legal: { fontSize: 14, textAlign: 'center', color: '#000' },
  button: { width: '100%', alignItems: 'center' },
  buttonText: { color: Colors.primary, fontSize: 18 },
  codeFieldRoot: { marginTop: 20, width: 260, marginLeft: 'auto', marginRight: 'auto', gap: 4 },
  cellRoot: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderBottomColor: '#ccc', borderBottomWidth: 1 },
  cellText: { color: '#000', fontSize: 36, textAlign: 'center' },
  focusCell: { paddingBottom: 4, borderBottomColor: '#000', borderBottomWidth: 2 },
});

export default Page;
