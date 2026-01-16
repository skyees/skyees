import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import useSocket  from '@/utils/socket';
import { useUser } from '@clerk/clerk-expo'
const Layout = () => {

   const { user, isLoaded } = useUser();
  const socket = useSocket();
  const router = useRouter();

  useEffect(() => {
    // 1. Ensure user and socket are ready
    if (!isLoaded || !user || !socket) return;

    // 2. Register the user with the socket server
    socket.emit('register', user.id);

    // 3. Listen for Incoming Calls
    const handleIncomingCall = (data: any) => {
      console.log("☎️ Incoming call event received:", data.callType);

      // 🛑 FILTER: If I am the caller, ignore the event (stops double-screen bug)
      if (data.callerId === user.id) return;

      // ✅ Navigate to the Incoming screen
      // Use push to ensure it overlays correctly
      router.push({
        pathname: '/(tabs)/calls/Incoming',
        params: {
          callId: data.callId || data._id,
          callerId: data.callerId,
          callerName: data.callerName,
          callerImg: data.callerImg,
          type: data.callType || data.type, // Handle both naming conventions
        }
      });
    };

    socket.on('incoming-call', handleIncomingCall);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [socket, user, isLoaded]);
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Contacts',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.background },

          headerSearchBarOptions: {
            placeholder: 'Search',
          },
          headerRight:()=>(<TouchableOpacity>
            <Ionicons name="person-circle-outline" size={30} color={Colors.primary}/>
          </TouchableOpacity>),


        }}

      />

    </Stack>
  );
};
export default Layout;
