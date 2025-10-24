
import { Stack, useRouter } from 'expo-router';
import { View, Text, ScrollView, FlatList } from 'react-native';
import React, { useEffect, useState } from 'react'; // Removed useCallback
import ChatRow from '@/components/ChatRow';
import { useAuth } from "@clerk/clerk-expo";
import { defaultStyles } from '@/constants/Styles';
import axios from "axios";
import useSocket from '@/utils/socket';

const Page = () => {
    const { getToken, isSignedIn } = useAuth();
    const [chats, setChats] = useState([]);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    const socket = useSocket();

    // ========= THIS IS THE FINAL, CORRECT FIX =========
    useEffect(() => {
        const fetchLastMessages = async () => {
            if (!isSignedIn) {
                setChats([]); // Clear chats if the user signs out
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

                const oneToOneChats = (data.oneToOne || []).map((c: any) => ({
                    ...c,
                    type: 'oneToOne',
                    id: c.userId,
                    roomName: c.contactName,
                    photoUrl: c.contactPhoto,
                }));

                const roomChats = (data.rooms || []).map((r: any) => ({
                    ...r,
                    type: 'room',
                    id: r.roomId,
                }));

                const combined = [...oneToOneChats, ...roomChats];
                combined.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

                setChats(combined);

            } catch (error) {
                console.error("❌ Error fetching chat list:", error);
            }
        };

        // 1. Fetch the initial list of chats
        fetchLastMessages();

        // 2. Set up the socket listener to re-fetch when a new message arrives
        const handleNewMessage = (message: any) => {
            fetchLastMessages();
        };

        socket.on("private-message", handleNewMessage);
        socket.on("room-message", handleNewMessage);

        // 3. Clean up the listeners when the component unmounts or auth state changes
        return () => {
            socket.off("private-message", handleNewMessage);
            socket.off("room-message", handleNewMessage);
        };

    }, [isSignedIn]); // The effect now ONLY re-runs if the user signs in or out. This STOPS the loop.
    // =======================================================

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingTop: 100, paddingBottom: 40, flex: 1, backgroundColor: '#fff' }}>
            <FlatList
                data={chats}
                renderItem={({ item }) => <ChatRow {...item} />}
                keyExtractor={(item: any) => item?.id?.toString() || Math.random().toString()}
                ItemSeparatorComponent={() => (
                    <View style={[defaultStyles.separator, { marginLeft: 90 }]} />
                )}
                scrollEnabled={false}
            />
        </ScrollView>
    );
};
export default Page;
