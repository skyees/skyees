import Colors from '@/constants/Colors';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useSegments, useRouter, Stack } from 'expo-router'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react'; 
import useSocket from '@/utils/socket'; 
import { useUser } from '@clerk/clerk-expo';

const TabsLayout = () => {
  const segments = useSegments(); 
  const router = useRouter(); 
  const socket = useSocket(); 
  const { user, isLoaded, isSignedIn } = useUser();

  // --- LOGIC: Hide Tabs on Call Screens ---
  const hideTabBar = 
    segments.includes('Call') || 
    segments.includes('Incoming') || 
    segments.includes('newCall') || 
    segments.includes('incommingCall');

  // --- LOGIC: Socket Registration & Global Listener ---
  useEffect(() => {
    if (!socket || !isLoaded || !isSignedIn || !user) return;

    const onConnect = () => {
      console.log("🔌 Connected! Registering User:", user.id);
      socket.emit("register", user.id); 
    };

    const handleIncomingCall = (data: any) => {
      console.log("🔔 GLOBAL: Incoming call detected!", data);
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/calls/Incoming',
          params: {
            _id: data._id, 
            callerId: data.callerId,
            callerName: data.callerName,
            callerImg: data.callerImg || "", // Fixes Image Crash
            receiverId: data.receiverId,
            callType: data.callType
          }
        });
      }, 100);
    };

    socket.on("connect", onConnect);
    socket.on('incoming-call', handleIncomingCall);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [socket, user, isLoaded, isSignedIn, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
      {/* 1. The Call History List (The main view for this tab) */}
      <Stack.Screen name="index" />

      {/* 2. The Active Video Call (Full Screen Modal) */}
      <Stack.Screen 
        name="Call" 
        options={{ 
          presentation: 'fullScreenModal', // Covers the bottom tabs
          headerShown: false,
          gestureEnabled: false
        }} 
      />

      {/* 3. The Incoming Popup (Transparent Modal) */}
      <Stack.Screen 
        name="Incoming" 
        options={{ 
          presentation: 'transparentModal', // Shows over current content
          headerShown: false,
          animation: 'fade'
        }} 
      />
    </Stack>
    </GestureHandlerRootView>
  );
};

export default TabsLayout;