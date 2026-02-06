import Colors from '@/constants/Colors';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useSegments, useRouter } from 'expo-router'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react'; 
import useSocket from '@/utils/socket'; 
import { useUser } from '@clerk/clerk-expo';

const TabsLayout = () => {
  const segments = useSegments();
  const router = useRouter(); 
  const socket = useSocket(); 
  const { user, isLoaded, isSignedIn } = useUser();

  // --- GLOBAL LISTENERS ---
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
            callerImg: data.callerImg || "", // Prevent Image Crash
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
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.background },
          tabBarActiveTintColor: Colors.primary,
          headerShown: false, // Global header hide
        }}>
        
        {/* TAB 1: UPDATES */}
        <Tabs.Screen
          name="updates"
          options={{
            title: 'Updates',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="update" size={size} color={color} />,
          }}
        />

        {/* TAB 2: CONTACTS (Stack) */}
        {/* This handles 'contacts/index', 'contacts/newCall', 'contacts/incomingCall' automatically */}
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contacts',
            tabBarIcon: ({ size, color }) => <MaterialCommunityIcons name="contacts-outline" size={size} color={color} />,
          }}
        />

        {/* TAB 3: CALLS (Stack) */}
        {/* This handles 'calls/index', 'calls/Call', 'calls/Incoming' automatically */}
        <Tabs.Screen
          name="calls"
          options={{
            title: 'Calls',
            tabBarIcon: ({ size, color }) => <MaterialCommunityIcons name="phone-outline" size={size} color={color} />,
          }}
        />

        {/* TAB 4: CHATS */}
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarIcon: ({ size, color }) => <Ionicons name="chatbubbles" size={size} color={color} />,
            tabBarStyle: {
              backgroundColor: '#fff',
              display: segments[2] === '[id]' ? 'none' : 'flex',
            },
          }}
        />

        {/* TAB 5: NETWORK */}
        <Tabs.Screen
          name="network"
          options={{
            title: 'Network',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="people" size={size} color={color} />,
          }}
        />

        {/* TAB 6: SETTINGS */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ size, color }) => <Ionicons name="cog" size={size} color={color} />,
          }}
        />

      
      </Tabs>
    </GestureHandlerRootView>
  );
};

export default TabsLayout;