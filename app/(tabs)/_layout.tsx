import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useSegments, useRouter } from 'expo-router'; // Added useRouter
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react'; // Added useEffect
import useSocket from '@/utils/socket'; // Added useSocket

const TabsLayout = () => {
  const segments = useSegments();
  const router = useRouter(); // Initialize router
  const socket = useSocket(); // Initialize socket

  // --- ADDED: Global Incoming Call Listener ---
  useEffect(() => {
    if (!socket) return;

  const handleIncomingCall = (data: any) => {
    console.log("🔔 GLOBAL: Incoming call detected!", data);
    setTimeout(()=>{
    router.push({
      pathname: '/(tabs)/calls/Incoming',
      params: {
        _id: data._id, // ✅ FIXED: Log shows the field is _id, not callId
        callerId: data.callerId,
        callerName: data.callerName,
        callerImg: data.callerImg,
        receiverId: data.receiverId,
        callType: data.callType
      }
    });
    },100);
};
    socket.on('incoming-call', handleIncomingCall);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [socket, router]);
  // --------------------------------------------

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.background },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveBackgroundColor: Colors.background,
          tabBarActiveBackgroundColor: Colors.background,
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerShadowVisible: false,
        }}>
        {/* ... your existing tab screens ... */}
        <Tabs.Screen
          name="updates"
          options={{
            title: 'Updates',
            tabBarIcon: ({ size, color }) => (
              <MaterialIcons name="update" size={size} color={color} />
            ),
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contacts',
            tabBarIcon: ({ size, color }) => <MaterialCommunityIcons name="contacts-outline" size={size} color={color} />,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="calls"
          options={{
            title: 'Calls',
            tabBarIcon: ({ size, color }) => <MaterialCommunityIcons name="phone-outline" size={size} color={color} />,
            headerShown: false,
          }}
        />
        {/* ... rest of your screens ... */}
        <Tabs.Screen
          name="network"
          options={{
            title: 'Network',
            tabBarIcon: ({ size, color }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarIcon: ({ size, color }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#fff',
              display: segments[2] === '[id]' ? 'none' : 'flex',
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ size, color }) => <Ionicons name="cog" size={size} color={color} />,
            headerShown: false,
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  );
};

export default TabsLayout;