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
import { useEffect, useState, useMemo, useRef } from 'react';
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
import useSocket from '@/utils/socket';

const transition = CurvedTransition.delay(100);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const Page = () => {
  const [selectedOption, setSelectedOption] = useState('All');
  const [isEditing, setIsEditing] = useState(false);
  const editing = useSharedValue(-30);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const socket = useSocket();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ Prevent duplicate fetch triggers during re-renders
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user?.id || hasFetched.current) {
      if (isLoaded && !user?.id) setLoading(false);
      return;
    }

    const fetchAndEnrichCalls = async () => {
      hasFetched.current = true; 
      setLoading(true);
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
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setAllItems(sortedCalls);
      } catch (error) {
        console.error('❌ Error fetching calls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndEnrichCalls();
  }, [isLoaded, user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    socket.emit('register', user.id);

    const onCallAdded = async (newCall: any) => {
      try {
        const token = await getToken();
        const otherUserId = newCall.callerId === user.id ? newCall.receiverId : newCall.callerId;
        const userResponse = await axios.get(`${API_URL}/api/users/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const enrichedCall = { ...newCall, name: userResponse.data.username, img: userResponse.data.profilePic };
        setAllItems((prev) => [enrichedCall, ...prev]);
      } catch (error) {
        setAllItems((prev) => [{ ...newCall, name: 'Unknown' }, ...prev]);
      }
    };

    const onCallEnded = (endedCall: any) => {
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
  }, [socket, user?.id]);

  // ✅ Memoized filtering prevents unnecessary re-renders of the list
  const items = useMemo(() => {
    if (selectedOption === 'All') return allItems;
    return allItems.filter((call) => call.missed && call.callerId !== user?.id);
  }, [allItems, selectedOption, user?.id]);

  const onEdit = () => {
    const editingNew = !isEditing;
    editing.value = editingNew ? 0 : -30;
    setIsEditing(editingNew);
  };

  const animatedRowStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  // ✅ Defensive Date Formatting to prevent "Invalid Time Value" crash
  const getFormattedDate = (dateString: any) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently'; 
    return format(date, 'MM.dd.yy');
  };

  const removeCall = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllItems(prev => prev.filter(i => i._id !== id));
  };

  if (loading && allItems.length === 0) {
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
            <SegmentedControl 
                options={['All', 'Missed']} 
                selectedOption={selectedOption} 
                onOptionPress={(opt) => setSelectedOption(opt)} 
            />
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={onEdit}>
              <Text style={{ color: Colors.primary, fontSize: 18 }}>
                {isEditing ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Animated.View style={defaultStyles.block} layout={transition}>
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(item) => item._id?.toString() || Math.random().toString()}
            ItemSeparatorComponent={() => <View style={defaultStyles.separator} />}
            renderItem={({ item, index }) => (
              <SwipeableRow onDelete={() => removeCall(item._id)}>
                <Animated.View 
                    entering={FadeInUp.delay(index * 10)} 
                    exiting={FadeOutUp} 
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <AnimatedTouchableOpacity 
                    style={[animatedRowStyles, { paddingLeft: 8 }]} 
                    onPress={() => removeCall(item._id)}
                  >
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
                        <Ionicons name={item.callType === 'video' ? 'videocam' : 'call'} size={16} color={Colors.gray} />
                        <Text style={{ color: Colors.gray, flex: 1 }}>{item.callerId === user?.id ? 'Outgoing' : 'Incoming'}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Text style={{ color: Colors.gray }}>
                        {getFormattedDate(item.createdAt)}
                      </Text>
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