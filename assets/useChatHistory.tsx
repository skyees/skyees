import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';

interface Message {
  _id: string;
  senderId: string;
  receiverId?: string;
  roomId?: string;
  text: string;
  createdAt: string;
}

const useChatHistory = (id: string, isRoom: boolean, socketRef: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.warn('No token found. User might be logged out.');
          return;
        }

        const endpoint = isRoom
          ? `http://192.168.31.230:3000/api/messages/room/${id}`
          : `http://192.168.31.230:3000/api/messages/private/${id}`;

        const res = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const sortedMessages = res.data.sort(
          (a: Message, b: Message) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        setMessages(sortedMessages);
        console.log('Fetched messages:', sortedMessages);
      } catch (error) {
        console.error('Fetch messages error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [id, isRoom]);

  useEffect(() => {
    if (!socketRef?.current) return;

    const handleNewMessage = (newMessage: Message) => {
      const match = isRoom
        ? newMessage.roomId === id
        : newMessage.senderId === id || newMessage.receiverId === id;

      if (match) {
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const socket = socketRef.current;
    socket.on(isRoom ? 'room-message' : 'private-message', handleNewMessage);

    return () => {
      socket.off(isRoom ? 'room-message' : 'private-message', handleNewMessage);
    };
  }, [id, isRoom, socketRef]);

  return { messages, loading };
};

export default useChatHistory;
