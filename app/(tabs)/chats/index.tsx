import { Stack, useRouter } from 'expo-router';
import { View, Text, ScrollView, FlatList } from 'react-native';
import React, { useEffect, useState } from 'react';
import ChatRow from '@/components/ChatRow';
import { useAuth } from "@clerk/clerk-expo";
import { defaultStyles } from '@/constants/Styles';
import axios from "axios";
import useSocket from '@/utils/socket';

const Page = () => {
  const { getToken, isSignedIn } = useAuth();
  const [chats, setChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});   // ✅ TYPING STATE
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const socket = useSocket();

  useEffect(() => {
    const fetchLastMessages = async () => {
      if (!isSignedIn) {
        setChats([]);
        return;
      }

      try {
        const token = await getToken();
        if (!token) return;

        const url = `${apiUrl}/api/chats/list`;
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = response.data;

        // ✅ One-to-one chat formatting
        const oneToOneChats = (data.oneToOne || []).map((c: any) => ({
          type: "oneToOne",
          id: c.userId,
          contactName: c.contactName,
          contactPhoto: c.contactPhoto,
          lastMessageText: c.lastMessageText,
          lastMessageTime: c.lastMessageTime,
          unreadCount: c.unreadCount || 0,
          isMuted: c.isMuted || false,
          isPinned: c.isPinned || false,
          receiverId: c.userId
        }));

        // ✅ Rooms
        const roomChats = (data.rooms || []).map((r: any) => ({
          type: "room",
          id: r.roomId,
          roomName: r.roomName,
          contactPhoto: r.photoUrl,
          lastMessageText: r.lastMessageText,
          lastMessageTime: r.lastMessageTime,
          unreadCount: r.unreadCount || 0,
          isMuted: r.isMuted || false,
          isPinned: r.isPinned || false,
          receiverId: ""
        }));

        let combined = [...oneToOneChats, ...roomChats];

        // ✅ Sort pinned first then by latest message
        combined.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });

        setChats(combined);
      } catch (error) {
        console.error("❌ Error fetching chat list:", error);
      }
    };

    fetchLastMessages();

    // ✅ Fetch again on new message
    const handleNewMessage = () => fetchLastMessages();

    socket.on("private-message", handleNewMessage);
    socket.on("room-message", handleNewMessage);

    // ✅ Online status
    socket.on("user-online", (userId) =>
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }))
    );
    socket.on("user-offline", (userId) =>
      setOnlineUsers((prev) => ({ ...prev, [userId]: false }))
    );

    // ✅ Typing indicator
    socket.on("typing", ({ from }) =>
      setTypingUsers((prev) => ({ ...prev, [from]: true }))
    );
    socket.on("stop-typing", ({ from }) =>
      setTypingUsers((prev) => ({ ...prev, [from]: false }))
    );

    return () => {
      socket.off("private-message", handleNewMessage);
      socket.off("room-message", handleNewMessage);
      socket.off("typing");
      socket.off("stop-typing");
    };
  }, [isSignedIn]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: 100,
        paddingBottom: 40,
        flex: 1,
        backgroundColor: "#fff",
      }}
    >
      <FlatList
        data={chats}
        renderItem={({ item }) => (
          <ChatRow
            {...item}
            isOnline={onlineUsers[item.id]}
            typing={typingUsers[item.id]}
            onPinChat={(id) => console.log("PIN chat", id)}
            onMuteChat={(id) => console.log("MUTE chat", id)}
          />
         )}
        keyExtractor={(item: any) => item?.id?.toString()}
        ItemSeparatorComponent={() => (
          <View style={[defaultStyles.separator, { marginLeft: 90 }]} />
        )}
        scrollEnabled={false}
      />
    </ScrollView>
  );
};

export default Page;
