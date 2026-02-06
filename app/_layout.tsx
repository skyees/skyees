import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Link, router, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import axios from "axios";
import * as SecureStore from 'expo-secure-store';
import { TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { ProfileProvider } from "@/src/contexts/ProfileContext";
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
import { useUser } from "@clerk/clerk-expo";
import RNNotificationCall from 'react-native-full-screen-notification-incoming-call';
import { Platform } from 'react-native';

const setupCallChannel = () => {
  if (Platform.OS === 'android') {
    RNNotificationCall.createNotificationChannel({
      channelId: 'com.goboss.skyees.calls', // Must match your app.json package
      channelName: 'Incoming Calls',
      importance: 5, // 5 = Max/High importance
      showBadge: true,
      vibrate: true,
    });
  }
};

useEffect(() => {
    // 1. Create the channel for Android
    setupCallChannel();

    // 2. Listen for the "Answer" button click
    const answerListener = RNNotificationCall.addEventListener('answer', (data) => {
      console.log('Call Answered:', data);
      
      // Dismiss the lock screen and bring app to foreground
      RNNotificationCall.backToApp(); 

      // Navigate to your specific Call Screen
      router.replace({
        pathname: '/(tabs)/calls/Call',
        params: { callId: data.callId, isCaller: 'false' } 
      });
    });

    // 3. Listen for "Decline"
    const declineListener = RNNotificationCall.addEventListener('endCall', (data) => {
      console.log('Call Declined');
      // Logic to notify your backend the call was declined
    });

    return () => {
      // Clean up listeners on unmount
      RNNotificationCall.removeEventListener('answer');
      RNNotificationCall.removeEventListener('endCall');
    };
  }, []);
// Cache the Clerk JWT
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

const { user } = useUser();

useEffect(() => {
  console.log("Auth state:", { isLoaded, isSignedIn });

  if (user) {
    console.log("User ID:", user.id);
    console.log("Email:", user.primaryEmailAddress?.emailAddress);
  }
}, [isLoaded, isSignedIn, user]);



useEffect(() => {
  if (!isLoaded || !loaded) return;

  // Detect if current route is inside the tabs group
  const inTabsGroup = segments.includes('(tabs)');

  // If signed in but not inside tabs, push them to chats
  if (isSignedIn && !inTabsGroup) {
    router.replace('/(tabs)/chats');
  }

  // If not signed in and trying to access a protected route, send back to login
  if (!isSignedIn && !['index', 'otp', 'verify'].includes(segments[0])) {
    router.replace('/');
  }
}, [isLoaded, loaded, isSignedIn, segments, router]);

  if (!loaded || !isLoaded) {
    return <View />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="otp"
        options={{ headerTitle: 'Enter Your Phone Number', headerBackVisible: false }}
      />
      <Stack.Screen
        name="verify/[phone]"
        options={{
          title: 'Verify Your Phone Number',
          headerShown: true,
          headerBackTitle: 'Edit number',
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(modals)/new-chat"
        options={{
          presentation: 'modal',
          title: 'New Chat',
          headerTransparent: true,
          headerBlurEffect: 'regular',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerRight: () => (
            <Link href={'/(tabs)/chats'} asChild>
              <TouchableOpacity
                style={{ backgroundColor: Colors.lightGray, borderRadius: 20, padding: 4 }}>
                <Ionicons name="close" color={Colors.gray} size={30} />
              </TouchableOpacity>
            </Link>
          ),
          headerSearchBarOptions: {
            placeholder: 'Search name or number',
            hideWhenScrolling: false,
          },
        }}
      />
    </Stack>
  );
};

const RootLayoutNav = () => {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
         <ProfileProvider>
          <InitialLayout  />
         </ProfileProvider>
      
    </ClerkProvider>
  );
};

export default RootLayoutNav;
