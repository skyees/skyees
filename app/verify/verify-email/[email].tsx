import Colors from '@/constants/Colors';
import { useSignUp, isClerkAPIResponseError, useSignIn } from '@clerk/clerk-expo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

const CELL_COUNT = 6;

const Page = () => {
  const { email, signin } = useLocalSearchParams<{ email: string; signin: string }>();
  const [code, setCode] = useState('');
  const router = useRouter();

  const ref = useBlurOnFulfill({ value: code, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: code,
    setValue: setCode,
  });

  const { signUp, setActive } = useSignUp();
  const { signIn } = useSignIn();

  useEffect(() => {
    if (code.length === 6) {
      if (signin === 'true') {
        verifySignIn();
      } else {
        verifySignUp();
      }
    }
  }, [code]);

  const verifySignUp = async () => {
    try {
      await signUp!.attemptEmailAddressVerification({ code });
      await setActive!({ session: signUp!.createdSessionId });
      router.replace('/(tabs)/chats');
    } catch (err) {
      console.log('SignUp verify error', JSON.stringify(err, null, 2));
      if (isClerkAPIResponseError(err)) {
        Alert.alert('Error', err.errors[0].message);
      }
    }
  };

  const verifySignIn = async () => {
    try {
      await signIn!.attemptFirstFactor({
        strategy: 'email_code',
        code,
      });
      await setActive!({ session: signIn!.createdSessionId });
      router.replace('/(tabs)/chats');
    } catch (err) {
      console.log('SignIn verify error', JSON.stringify(err, null, 2));
      if (isClerkAPIResponseError(err)) {
        Alert.alert('Error', err.errors[0].message);
      }
    }
  };

  const resendCode = async () => {
    try {
      if (signin === 'true') {
        await signIn!.create({ identifier: email });
        await signIn!.prepareFirstFactor({
          strategy: 'email_code',
        });
      } else {
        await signUp!.create({ emailAddress: email });
        await signUp!.prepareEmailAddressVerification();
      }
      Alert.alert('Verification code sent', `We sent a new code to ${email}`);
    } catch (err) {
      console.log('Resend error', JSON.stringify(err, null, 2));
      if (isClerkAPIResponseError(err)) {
        Alert.alert('Error', err.errors[0].message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: email }} />
      <Text style={styles.legal}>We sent a verification code to your email.</Text>
      <Text style={styles.legal}>Enter the 6-digit code below to verify your email address.</Text>

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
          <View
            key={index}
            onLayout={getCellOnLayoutHandler(index)}
            style={[styles.cellRoot, isFocused && styles.focusCell]}>
            <Text style={styles.cellText}>{symbol || (isFocused ? <Cursor /> : null)}</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.button} onPress={resendCode}>
        <Text style={styles.buttonText}>Didn’t get a code? Resend</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
    gap: 20,
  },
  legal: {
    fontSize: 14,
    textAlign: 'center',
    color: '#000',
  },
  button: {
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.primary,
    fontSize: 18,
  },
  codeFieldRoot: {
    marginTop: 20,
    width: 260,
    marginLeft: 'auto',
    marginRight: 'auto',
    gap: 4,
  },
  cellRoot: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  cellText: {
    color: '#000',
    fontSize: 36,
    textAlign: 'center',
  },
  focusCell: {
    paddingBottom: 4,
    borderBottomColor: '#000',
    borderBottomWidth: 2,
  },
});

export default Page;
