
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Calls',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.background },
          headerSearchBarOptions: { placeholder: 'Search' },
          headerRight: () => (
            <TouchableOpacity>
              <Ionicons name="call-outline" size={28} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* FIX: This name MUST match the filename 'call.tsx' */}
      <Stack.Screen
        name="Call"
        options={{
          title: 'Call',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />

      <Stack.Screen
        name="Incoming"
        options={{
          title: 'Incoming Call',
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
