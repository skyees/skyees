import Colors from '@/constants/Colors';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useSegments, useRouter, Stack } from 'expo-router'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TouchableOpacity } from 'react-native';

const TabsLayout = () => {


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
      {/* 1. The Call History List (The main view for this tab) */}
       <Stack.Screen
        name="index"
        options={{
          title: 'Calls',
          headerLargeTitle: true,
          headerTitleAlign: 'center',
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

        
     
    </Stack>
    </GestureHandlerRootView>
  );
};

export default TabsLayout;