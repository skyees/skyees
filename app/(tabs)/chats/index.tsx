import { Stack, useRouter } from 'expo-router';
import { View, Text, ScrollView, FlatList } from 'react-native';
import React, { useEffect, useState } from 'react';
import chats from '@/assets/data/chats.json';
import ChatRow from '@/components/ChatRow';
import { useAuth } from "@clerk/clerk-expo";
import { defaultStyles } from '@/constants/Styles';
import axios from "axios";
 const Page = () => {
 const { getToken } = useAuth();
 const router = useRouter();

 const [chats, setChats] = useState([]);

useEffect(() => {
  const fetchLastMessages = async () => {
    try {
      const token = await getToken();

      if (!token) {
        console.warn("No auth token found.");
        return;
      }

      const response = await axios.get("http://192.168.31.230:3000/api/chats/list", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response?.data;

      if (!data || (!Array.isArray(data.oneToOne) && !Array.isArray(data.rooms))) {
        console.warn("Unexpected API response format", data);
        return;
      }

      const oneToOneChats = (data.oneToOne || []).map(c => ({
        ...c,
        type: 'oneToOne',
        id: c.userId, // unified id for navigation
      }));

      const roomChats = (data.rooms || []).map(r => ({
        ...r,
        type: 'room',
        id: r.roomId, // unified id for navigation
      }));

      const combined = [...oneToOneChats, ...roomChats];
      combined.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

      setChats(combined);
      console.log('✅ Chats loaded:', combined);
    } catch (error) {
      console.error("❌ Error fetching chat list:", error);
    }
  };

  fetchLastMessages();
}, []);

  return (
     <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{paddingTop: 100, paddingBottom: 40, flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={chats}
        renderItem={({ item }) => <ChatRow {...item} />}
        keyExtractor={(item, index) => item?.roomId || item?.userId || index?.toString()}
        ItemSeparatorComponent={() => (
          <View style={[defaultStyles.separator, { marginLeft: 90 }]} />
        )}
        scrollEnabled={false}
      />
    </ScrollView>
  );
};
export default Page;


