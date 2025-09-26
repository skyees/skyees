import ChatMessageBox from '@/components/ChatMessageBox';
import ReplyMessageBar from '@/components/ReplyMessageBar';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ImageBackground, StyleSheet, View, TouchableOpacity } from 'react-native';

import { Swipeable } from 'react-native-gesture-handler';
import {
  GiftedChat,
  Bubble,
  InputToolbar,
  Send,
  SystemMessage,
  IMessage,
} from 'react-native-gifted-chat';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useChatHistory from '@/assets/useChatHistory';
import useSocket from '@/utils/socket';
import { useUser } from '@clerk/clerk-expo';
import VideoRecorder from '../../../components/VideoRecorder';
import VoiceRecorder from "@/components/VoiceRecorder";
import { useAuth } from "@clerk/clerk-expo";


const ChatPage = () => {
  const socket = useSocket();
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [imessages, setImessages] = useState<IMessage[]>([]);
  const insets = useSafeAreaInsets();
  const { id, receiverId, isRoom } = useLocalSearchParams();
  const isGroup = isRoom === 'true';
  const [title, setTitle] = useState('Chat');
  const roomId = isGroup ? id : null;
  const { messages = [], loading } = useChatHistory(id, isGroup);
  const { user } = useUser();
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
 
  const swipeableRowRef = useRef<Swipeable | null>(null);
  console.log('VideoRecorder is: typeof', typeof VideoRecorder);
  console.log('VideoRecorder is:', VideoRecorder);
  // Fetch Chat User / Room Name
useEffect(() => {
  const fetchTitle = async () => {
    try {
      const token = await getToken(); // 👈 Clerk JWT
      const res = await fetch(
        `http://192.168.31.230:3000/api/${isGroup ? "rooms" : "users"}/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
       console.log("Messages Room/Chat Personal",data);
      setTitle(`${data.name || data.roomName || "Unknown"} ${data.status || ""}`);
    } catch (err) {
      console.error("❌ Fetch Error:", err);
      setTitle("Chat");
    }
  };

  fetchTitle();
 
}, [id, isGroup]);

  // Format Messages
  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0 || !user?.id) return;

    const formatted = messages
      .map(msg => ({
        _id: msg._id,
        text: msg.text ?? '',
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        user: {
          _id: msg.senderId,
          name: msg.senderName || 'User',
        },
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    setImessages(formatted);
  }, [messages, user?.id]);

  // Socket Listeners
  useEffect(() => {
    const handler = (message) => {
      const newMsg = {
        _id: message._id,
        text: message.text ?? '',
        createdAt: new Date(message.createdAt),
        user: { _id: message.senderId },
      };
      setImessages(prev => GiftedChat.append(prev, [newMsg]));
    };

    socket.on("private-message", handler);
    socket.on("room-message", handler);

    return () => {
      socket.off("private-message", handler);
      socket.off("room-message", handler);
    };
  }, [socket]);

  const onSend = useCallback((messages = []) => {
    const msg = messages[0];
    setImessages(prev => GiftedChat.append(prev, messages));

    const payload = {
      id: msg._id,
      text: msg.text,
      senderId: user?.id,
      createdAt: new Date(),
      ...(isGroup && id ? { roomId: id } : { receiverId }),
    };

    socket.emit("new-message", payload);
  }, [socket, user?.id, receiverId, isGroup, id]);

  const renderInputToolbar = (props) => (
    <InputToolbar
      {...props}
      containerStyle={{ backgroundColor: Colors.background }}
      renderActions={() => (
        <View style={{ height: 44, justifyContent: 'center', alignItems: 'center', left: 5 }}>
          <Ionicons name="add" color={Colors.primary} size={28} />
        </View>
      )}
    />
  );

  const updateRowRef = useCallback((ref) => {
    if (
      ref &&
      replyMessage &&
      ref.props.children?.props?.currentMessage?._id === replyMessage._id
    ) {
      swipeableRowRef.current = ref;
    }
  }, [replyMessage]);

  useEffect(() => {
    if (replyMessage && swipeableRowRef.current) {
      swipeableRowRef.current.close();
      swipeableRowRef.current = null;
    }
  }, [replyMessage]);

  return (
    <>
      <VoiceRecorder
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSend={onSend}
        userId={user?.id}
      />

        <VideoRecorder
          visible={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          onSend={onSend}
          userId={user?.id}
          />

      <Stack.Screen options={{ headerTitle: title }} />

      <ImageBackground
        source={require('@/assets/images/pattern.png')}
        style={{ flex: 1, backgroundColor: Colors.background, marginBottom: insets.bottom }}
      >
        <GiftedChat
          messages={imessages}
          onSend={(m) => onSend(m)}
          onInputTextChanged={(t) => setText(t)}
          user={{ _id: user?.id }}
          renderSystemMessage={(props) => (
            <SystemMessage {...props} textStyle={{ color: Colors.gray }} />
          )}
          renderUsernameOnMessage
          bottomOffset={insets.bottom}
          renderAvatar={null}
          maxComposerHeight={100}
          text={text}
          renderBubble={(props) => (
            <Bubble
              {...props}
              textStyle={{ right: { color: '#000' } }}
              wrapperStyle={{
                left: { backgroundColor: '#fff' },
                right: { backgroundColor: Colors.lightGreen },
              }}
            />
          )}
          renderSend={(props) => (
            <View style={styles.sendContainer}>
              {text === '' ? (
                <>
                  <TouchableOpacity onPress={() => setShowVideoModal(true)}>
                    <Ionicons name="camera-outline" color={Colors.primary} size={28} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowVoiceModal(true)}>
                    <Ionicons name="mic-outline" color={Colors.primary} size={28} />
                  </TouchableOpacity>
                </>
              ) : (
                <Send {...props} containerStyle={{ justifyContent: 'center' }}>
                  <Ionicons name="send" color={Colors.primary} size={28} />
                </Send>
              )}
            </View>
          )}
          renderInputToolbar={renderInputToolbar}
          renderChatFooter={() => (
            <ReplyMessageBar clearReply={() => setReplyMessage(null)} message={replyMessage} />
          )}
          onLongPress={(context, message) => setReplyMessage(message)}
          renderMessage={(props) => (
            <ChatMessageBox
              {...props}
              setReplyOnSwipeOpen={setReplyMessage}
              updateRowRef={updateRowRef}
            />
          )}
        />
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  composer: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    paddingHorizontal: 10,
    paddingTop: 8,
    fontSize: 16,
    marginVertical: 4,
  },
  sendContainer: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 14,
  },
});

export default ChatPage;
