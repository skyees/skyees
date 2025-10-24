import Colors from '@/constants/Colors';
import io from 'socket.io-client';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';
import calls from '@/assets/data/calls.json';
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

const transition = CurvedTransition.delay(100);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const Page = () => {
  const [selectedOption, setSelectedOption] = useState('All');
  const [items, setItems] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const editing = useSharedValue(-30);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const { user } = useUser();
  const { getToken } = useAuth();

  const socket = io(API_URL, { transports: ['websocket'] });

  // ✅ Fetch call list
  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/calls/${user?.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(response.data);
      } catch (error) {
        console.error('❌ Error fetching calls:', error);
      }
    };
    if (user) fetchCalls();
  }, [user]);

  // ✅ Listen for real-time call updates
  useEffect(() => {
    if (!socket) return;

    // Register user ID for socket room
    if (user?.id) socket.emit('register', user.id);

    socket.on('call-added', (newCall) => {
      setItems((prev) => [newCall, ...prev]);
    });

    socket.on('call-ended', (endedCall) => {
      setItems((prev) =>
        prev.map((item) => (item._id === endedCall._id ? endedCall : item))
      );
    });

    return () => {
      socket.off('call-added');
      socket.off('call-ended');
    };
  }, [socket, user]);

  // ✅ Segment filter
  const onSegmentChange = (option: string) => {
    setSelectedOption(option);
    if (option === 'All') {
      setItems(calls);
    } else {
      setItems(calls.filter((call) => call.missed));
    }
  };

  // ✅ Delete handler
  const removeCall = (toDelete: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(items.filter((item) => item.id !== toDelete.id));
  };

  // ✅ Edit mode
  const onEdit = () => {
    const editingNew = !isEditing;
    editing.value = editingNew ? 0 : -30;
    setIsEditing(editingNew);
  };

  const animatedRowStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  const animatedPosition = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SegmentedControl
              options={['All', 'Missed']}
              selectedOption={selectedOption}
              onOptionPress={onSegmentChange}
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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View style={[defaultStyles.block]} layout={transition}>
          <Animated.FlatList
            skipEnteringExitingAnimations
            data={items}
            scrollEnabled={false}
            itemLayoutAnimation={transition}
            keyExtractor={(item) => item._id?.toString() || item.id.toString()}
            ItemSeparatorComponent={() => <View style={defaultStyles.separator} />}
            renderItem={({ item, index }) => (
              <SwipeableRow onDelete={() => removeCall(item)}>
                <Animated.View
                  entering={FadeInUp.delay(index * 20)}
                  exiting={FadeOutUp}
                  style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AnimatedTouchableOpacity
                    style={[animatedPosition, { paddingLeft: 8 }]}
                    onPress={() => removeCall(item)}>
                    <Ionicons name="remove-circle" size={24} color={Colors.red} />
                  </AnimatedTouchableOpacity>

                  <Animated.View
                    style={[defaultStyles.item, { paddingLeft: 20 }, animatedRowStyles]}>
                    <Image source={{ uri: item.img }} style={styles.avatar} />

                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 18, color: item.missed ? Colors.red : '#000' }}>
                        {item.name}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Ionicons
                          name={item.video ? 'videocam' : 'call'}
                          size={16}
                          color={Colors.gray}
                        />
                        <Text style={{ color: Colors.gray, flex: 1 }}>
                          {item.incoming ? 'Incoming' : 'Outgoing'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 6,
                        alignItems: 'center',
                      }}>
                      <Text style={{ color: Colors.gray }}>
                        {format(new Date(item.date), 'MM.dd.yy')}
                      </Text>
                      <Ionicons
                        name="information-circle-outline"
                        size={24}
                        color={Colors.primary}
                      />
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

export default Page;
