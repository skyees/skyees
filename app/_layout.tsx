import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Link, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import axios from "axios";
import * as SecureStore from 'expo-secure-store';
import { TouchableOpacity, View, Platform, Linking } from 'react-native';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { ProfileProvider } from "@/src/contexts/ProfileContext";
import RNNotificationCall from 'react-native-full-screen-notification-incoming-call';
import useSocket from '@/utils/socket';
import InCallManager from "react-native-incall-manager";
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const setupCallChannel = () => {
  const callModule: any = RNNotificationCall;

  if (
    Platform.OS === 'android' &&
    callModule &&
    typeof callModule.createNotificationChannel === 'function'
  ) {
    callModule.createNotificationChannel({
      channelId: 'com.goboss.skyees.calls',
      channelName: 'Incoming Calls',
      importance: 5,
      showBadge: true,
      vibrate: true,
    });
  } else {
    console.log("⚠️ Call module not linked — skipping channel setup");
  }
};
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    // Handle link when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      handleIncomingURL(event.url);
    });

    // Handle link if app was completely closed
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingURL(url);
    });

    return () => subscription.remove();
  }, []);

  const handleIncomingURL = (url: string) => {
    const { path, queryParams } = Linking.parse(url);
    
    // If the link is skyees://join-call
    if (path === 'join-call' && queryParams?.callId) {
      router.push({
        pathname: '/call/Call', // Go to your Call screen
        params: { 
          callId: queryParams.callId,
          isCaller: "false", // They are joining, not starting
          type: "video" 
        }
      });
    }
  };
  // font load error
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // hide splash when fonts ready
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // auth debug logs
  useEffect(() => {
    console.log("Auth state:", { isLoaded, isSignedIn });
    if (user) {
      console.log("User ID:", user.id);
      console.log("Email:", user.primaryEmailAddress?.emailAddress);
    }
  }, [isLoaded, isSignedIn, user]);


const socket = useSocket();

useEffect(() => {
  if (!socket || !user?.id) return;

  const onConnect = () => {
    socket.emit("register", user.id);
  };

  const handleIncomingCall = (data:any) => {
    
    if (data.callerId === user.id) return;
    InCallManager.stopRingtone();
    InCallManager.stop();
setTimeout(() => {
    router.push({
      pathname: "/call/Incoming",
      params: {
        _id: data._id,
        callerId: data.callerId,
        callerName: data.callerName,
        callerImg: data.callerImg || "",
        receiverId: data.receiverId,
        callType: data.callType
      }
    });
    }, 100);
  };

  socket.on("connect", onConnect);
  socket.on("incoming-call", handleIncomingCall);
  if (socket.connected) onConnect();

  return () => {
    socket.off("connect", onConnect);
    socket.off("incoming-call", handleIncomingCall);
  };

}, [socket, user?.id]);


// Inside InitialLayout (app/_layout.tsx)
useEffect(() => {
  if (!isLoaded || !loaded) return;

  const firstSegment = segments[0];
  const inCall = firstSegment === 'call';

  // 🛑 STOP EVERYTHING if we are on a call screen
  if (inCall) return; 

  if (isSignedIn) {
    if (['index', 'otp', 'verify'].includes(firstSegment) || !firstSegment) {
      router.replace('/(tabs)/chats');
    }
  } else if (!['index', 'otp', 'verify'].includes(firstSegment)) {
    router.replace('/');
  }
}, [isLoaded, loaded, isSignedIn, segments]);

  // call notification listeners  ✅ moved BEFORE return
  useEffect(() => {
    setupCallChannel();

   const answerListener = RNNotificationCall.addEventListener('answer', (data) => {
   RNNotificationCall.backToApp();
   router.replace({
     pathname: '/call/Call',
     params: { callId: data.callId, isCaller: 'false' }
    });
  });
    const declineListener = RNNotificationCall.addEventListener('endCall', () => {
      console.log('Call Declined');
    });

    return () => {
      RNNotificationCall.removeEventListener('answer');
      RNNotificationCall.removeEventListener('endCall');
    };
  }, []);

  if (!loaded || !isLoaded) {
    return <View />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Screen
        name="otp"
        options={{
          headerTitle: 'Enter Your Phone Number',
          headerBackVisible: false
        }}
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
          headerStyle: { backgroundColor: Colors.background },
          headerRight: () => (
            <Link href={'/(tabs)/chats'} asChild>
              <TouchableOpacity style={{
                backgroundColor: Colors.lightGray,
                borderRadius: 20,
                padding: 4
              }}>
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

        <Stack.Screen
            name="call/Call"
            options={{
              headerShown: false,
              presentation: "fullScreenModal"
            }}
          />

          <Stack.Screen
            name="call/Incoming"
            options={{
              headerShown: false,
              presentation: "fullScreenModal"
            }}
          />
     
           <Stack.Screen
        name="call/newCall"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade"
        }}
      />

    </Stack>
  );
};

const RootLayoutNav = () => {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ProfileProvider>
        <InitialLayout />
      </ProfileProvider>
    </ClerkProvider>
  );
};

export default RootLayoutNav;
