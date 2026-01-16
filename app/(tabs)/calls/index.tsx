
import Colors from '@/constants/Colors';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';
import { defaultStyles } from '@/constants/Styles';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { format } from 'date-fns';
import Animated, {
  CurvedTransition,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SwipeableRow from '@/components/SwipeableRow';
import * as Haptics from 'expo-haptics';
import useSocket from '@/utils/socket'; // FIX: Re-added the missing import

const transition = CurvedTransition.delay(100);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const Page = () => {
  const [selectedOption, setSelectedOption] = useState('All');
  const [isEditing, setIsEditing] = useState(false);
  const editing = useSharedValue(-30);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const socket = useSocket();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();

  const [allItems, setAllItems] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState([]);
  // ✅ 1. Stable Data Fetching
  useEffect(() => {
    if (!isLoaded || !user?.id) {
      if (isLoaded) setLoading(false); // Only stop loading if Clerk is done
      return;
    }
    setLoading(true);

    const fetchAndEnrichCalls = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const callsResponse = await axios.get(`${API_URL}/api/calls/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rawCalls = callsResponse.data;

        const enrichedCalls = await Promise.all(
          rawCalls.map(async (call: any) => {
            const otherUserId = call.callerId === user.id ? call.receiverId : call.callerId;
            if (!otherUserId) return { ...call, name: 'Unknown', img: null };

            try {
              const userResponse = await axios.get(`${API_URL}/api/users/${otherUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              return { ...call, name: userResponse.data.username, img: userResponse.data.profilePic };
            } catch (error) {
              return { ...call, name: 'Unknown User', img: null };
            }
          })
        );

      const sortedCalls = enrichedCalls.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );

            setCalls(sortedCalls.slice(0, 20));
        setAllItems(sortedCalls);
      } catch (error) {
        console.error('❌ Error fetching calls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndEnrichCalls();
  }, [isLoaded, user?.id]);



  // ✅ 2. Stable, SINGLE Socket Listener Hook
  useEffect(() => {
    if (!socket || !isLoaded || !user?.id) {
      return;
    }

    socket.emit('register', user.id);
    console.log(`🟢 Socket registered for user: ${user.id}`);



    const onCallAdded = async (newCall: any) => {
      console.log('➕ Call added received:', newCall);
       try {
        const token = await getToken();
        const otherUserId = newCall.callerId === user.id ? newCall.receiverId : newCall.callerId;
        const userResponse = await axios.get(`${API_URL}/api/users/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const enrichedCall = { ...newCall, name: userResponse.data.username, img: userResponse.data.profilePic };
        setAllItems((prev) => [enrichedCall, ...prev]);
      } catch (error) {
        const enrichedCall = { ...newCall, name: 'Unknown', img: null };
        setAllItems((prev) => [enrichedCall, ...prev]);
      }
    };

    const onCallEnded = (endedCall: any) => {
      console.log('🔚 Call ended received:', endedCall);
      setAllItems((prevItems) =>
        prevItems.map((item) => (item._id === endedCall._id ? { ...item, ...endedCall } : item))
      );
    };


    socket.on('call-added', onCallAdded);
    socket.on('call-ended', onCallEnded);

    return () => {

      socket.off('call-added', onCallAdded);
      socket.off('call-ended', onCallEnded);
    };
  }, [socket, isLoaded, user?.id]);

  // ✅ 3. Filtering Logic
  useEffect(() => {
    if (selectedOption === 'All') {
      setItems(allItems);
    } else {
      setItems(allItems.filter((call) => call.missed && call.callerId !== user?.id));
    }
  }, [allItems, selectedOption, user?.id]);

  const onSegmentChange = (option: string) => {
    setSelectedOption(option);
  };

  const removeCall = (toDelete: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllItems((prev) => prev.filter((item) => item._id !== toDelete._id));
  };

  const onEdit = () => {
    const editingNew = !isEditing;
    editing.value = editingNew ? 0 : -30;
    setIsEditing(editingNew);
  };

  const animatedRowStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  if (loading && !items.length) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SegmentedControl options={['All', 'Missed']} selectedOption={selectedOption} onOptionPress={onSegmentChange} />
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={onEdit} disabled={!isLoaded}>
              <Text style={{ color: Colors.primary, fontSize: 18, opacity: !isLoaded ? 0.5 : 1 }}>
                {isEditing ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Animated.View style={defaultStyles.block} layout={transition}>
          <Animated.FlatList
            skipEnteringExitingAnimations
            data={items}
            scrollEnabled={false}
            itemLayoutAnimation={transition}
            keyExtractor={(item) => item._id.toString()}
            ItemSeparatorComponent={() => <View style={defaultStyles.separator} />}
            renderItem={({ item, index }) => (
              <SwipeableRow onDelete={() => removeCall(item)}>
                <Animated.View entering={FadeInUp.delay(index * 20)} exiting={FadeOutUp} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AnimatedTouchableOpacity style={[animatedRowStyles, { paddingLeft: 8 }]} onPress={() => removeCall(item)}>
                    <Ionicons name="remove-circle" size={24} color={Colors.red} />
                  </AnimatedTouchableOpacity>
                  <Animated.View style={[defaultStyles.item, { paddingLeft: 20 }, animatedRowStyles]}>
                    {item.img ? (
                      <Image source={{ uri: item.img }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 18, color: '#555', fontWeight: 'bold' }}>
                          {item.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 18, color: item.missed && item.callerId !== user?.id ? Colors.red : '#000' }}>
                        {item.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Ionicons name={item.video ? 'videocam' : 'call'} size={16} color={Colors.gray} />
                        <Text style={{ color: Colors.gray, flex: 1 }}>{item.callerId === user?.id ? 'Outgoing' : 'Incoming'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Text style={{ color: Colors.gray }}>{format(new Date(item.startedAt), 'MM.dd.yy')}</Text>
                      <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
                    </View>
                  </Animated.View>
                </Animated.View>
              </SwipeableRow>
            )}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ccc' },
});

export default Page;
