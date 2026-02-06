import ChatMessageBox from '@/components/ChatMessageBox';
import ReplyMessageBar from '@/components/ReplyMessageBar';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ImageBackground,
  StyleSheet,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Text,
  Modal,
} from 'react-native';
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
import { useUser, useAuth } from '@clerk/clerk-expo';
import VideoRecorder from '../../../components/VideoRecorder';
import VoiceRecorder from '@/components/VoiceRecorder';
import PickImageModal from '@/components/PickImageModal';
import { Swipeable, TextInput } from 'react-native-gesture-handler';
import 'react-native-get-random-values';
import EmojiSelector from "react-native-emoji-selector";
import ionicons  from "@expo/vector-icons";


import { v4 as uuidv4 } from 'uuid';

const ChatPage = () => {
  const socket = useSocket();
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [imessages, setImessages] = useState<IMessage[]>([]);
  const insets = useSafeAreaInsets();
  const { id, receiverId, isRoom } = useLocalSearchParams();
  const isGroup = isRoom === 'true';
  const [title, setTitle] = useState('Chat');
  const { messages = [] } = useChatHistory(id, isGroup);
  const { user } = useUser();
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const swipeableRowRef = useRef<Swipeable | null>(null);
  const typingTimeout = useRef<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserName, setTypingUserName] = useState("");
 const [showEmojiPicker, setShowEmojiPicker] = useState(false);
const [showEmojiModal, setShowEmojiModal] = useState(false);

  useEffect(() => {
    if (!socket || !user) return;

    const typingHandler = ({ senderId }: { senderId: string }) => {
      if (senderId !== user.id) {
        setIsTyping(true);
        setTypingUserName("typing...");
      }
    };

    const stopTypingHandler = ({ senderId }: { senderId: string }) => {
      if (senderId !== user.id) {
        setIsTyping(false);
        setTypingUserName("");
      }
    };

    socket.on("typing", typingHandler);
    socket.on("stop-typing", stopTypingHandler);

    return () => {
      socket.off("typing", typingHandler);
      socket.off("stop-typing", stopTypingHandler);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    const fetchTitle = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/${isGroup ? 'rooms' : 'users'}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTitle(() => {
          if (isGroup) return data.roomName || data.name || "Group";
          return data.name || data.username || "Chat";
        });
      } catch (err) {
        setTitle('Chat');
      }
    };
    fetchTitle();
  }, [id, isGroup, getToken, apiUrl]);

  useEffect(() => {
    if (!Array.isArray(messages) || !user?.id) return;
    const formatted = messages
      .map((msg: any) => ({
        _id: msg._id,
        text: msg.text ?? '',
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        image: msg.image,
        audio: msg.audio,
        video: msg.video,
        replyTo: msg.replyTo || null,
        edited: msg.edited || false,
        user: { _id: msg.senderId, name: msg.senderName || 'User' },
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    setImessages(formatted);
  }, [messages, user?.id]);

  useEffect(() => {
    if (!socket || !user) return;

    const messageHandler = (incoming: any) => {
      setImessages((prev) => {
        let next = prev;
        if (incoming.clientId) {
          next = next.filter((m) => !( (m as any).__optimistic && m._id === incoming.clientId));
        }
        if (next.some((m) => m._id === incoming._id)) return next;

        let replyObj: any = null;
        if (incoming.replyTo) {
          if (typeof incoming.replyTo === "object") {
            replyObj = incoming.replyTo;
          } else {
            const found = next.find((m) => m._id === incoming.replyTo);
            replyObj = found ? {
              _id: found._id,
              text: found.text,
              image: found.image,
              video: found.video,
              audio: found.audio,
              senderId: found.user?._id,
            } : { _id: incoming.replyTo };
          }
        }

        const formatted = {
          _id: incoming._id,
          text: incoming.text,
          createdAt: new Date(incoming.createdAt),
          user: { _id: incoming.senderId, name: incoming.senderName },
          replyTo: replyObj,
          image: incoming.image,
          video: incoming.video,
          audio: incoming.audio,
          edited: incoming.edited,
        };
        return GiftedChat.append(next, [formatted]);
      });
    };

    socket.on('private-message', messageHandler);
    socket.on('room-message', messageHandler);
    socket.on('message-edited', (editedMsg) => {
      setImessages((prev) => prev.map((msg) => msg._id === editedMsg._id ? { ...msg, text: editedMsg.text, edited: true } : msg));
    });
    socket.on('message-deleted', ({ messageId }) => {
      setImessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => {
      socket.off('private-message');
      socket.off('room-message');
      socket.off('message-edited');
      socket.off('message-deleted');
    };
  }, [socket, user?.id]);

  const handleTyping = (t: string) => {
    setText(t);
    if (!user) return;
    socket.emit("typing", { senderId: user.id, receiverId, roomId: isGroup ? id : null });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop-typing", { senderId: user.id, receiverId, roomId: isGroup ? id : null });
    }, 1200);
  };

  const onSend = useCallback((messages: IMessage[] = []) => {
    if (!user) return;
    const msg = messages[0];
    const clientId = msg._id || uuidv4();

    const optimisticMessage = {
      ...msg,
      _id: clientId,
      user: { _id: user.id },
      createdAt: new Date(),
      __optimistic: true,
      replyTo: replyMessage ? { _id: replyMessage._id, text: replyMessage.text, senderId: replyMessage.user._id } : null,
    };

    
    setImessages((prev) => GiftedChat.append(prev, [optimisticMessage]));

    socket.emit("new-message", {
      id: clientId,
      text: msg.text || "",
      senderId: user.id,
      createdAt: new Date(),
      replyTo: replyMessage?._id || null,
      ...(msg.image && { image: msg.image }),
      ...(msg.audio && { audio: msg.audio }),
      ...(msg.video && { video: msg.video }),
      ...(isGroup ? { roomId: id } : { receiverId }),
    });

    setReplyMessage(null);
  }, [user, replyMessage, socket, isGroup, id, receiverId]);

 // Builds and sends the message
const handleImagePicked = (uriOrUrl: string) => {
  const message: IMessage = {
    _id: uuidv4(),
    text: "",
    createdAt: new Date(),
    user: { _id: user?.id! },
    image: uriOrUrl,
  };
  onSend([message]);
  setShowImageModal(false);
};


  useEffect(() => {
  if (!socket || !user) return;

  socket.on("typing", ({ roomId, senderId }) => {
    // Only show typing if it's not the current user
    if (senderId !== user.id) {
      setIsTyping(true);
      // Optional: clear after a timeout
      setTimeout(() => setIsTyping(false), 3000);
    }
  });

  return () => {
    socket.off("typing");
  };
}, [socket, user?.id]);


const renderInputToolbar = (props: any) => (
  <InputToolbar
    {...props}
    containerStyle={{ backgroundColor: Colors.background }}
    renderActions={() => (
      <TouchableOpacity
        style={{
          height: 44,
          justifyContent: "center",
          alignItems: "center",
          left: 5,
          paddingHorizontal: 10,
        }}
        onPress={() => setShowImageModal(true)}   
      >
        <Ionicons name="image-outline" color={Colors.primary} size={28} />
      </TouchableOpacity>
    )}
  />
);




  const renderChatFooter = () => {
    if (editingMessage) {
      return (
        <View style={styles.editingBar}>
          <Text style={styles.editingTitle}>Editing Message</Text>
          <Text numberOfLines={1} style={styles.editingText}>{editingMessage.text}</Text>
          <TouchableOpacity onPress={() => { setEditingMessage(null); setText(''); }}>
            <Ionicons name="close" size={22} color="gray" />
          </TouchableOpacity>
        </View>
      );
    }
    if (replyMessage) {
      return (
        <View style={styles.replyBar}>
          <Text style={styles.replyTitle}>Replying to {replyMessage.user._id === user?.id ? 'You' : (replyMessage.user.name || 'Contact')}</Text>
          <Text numberOfLines={1} style={styles.replyPreview}>{replyMessage.text || 'Media'}</Text>
          <TouchableOpacity onPress={() => setReplyMessage(null)}>
            <Ionicons name="close" size={22} color="gray" />
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const updateRowRef = useCallback((ref: Swipeable | null) => {
    if (ref && replyMessage && (ref as any)?.props?.children?.props?.currentMessage?._id === replyMessage._id) {
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
           {/* ✅ Render modal here, outside GiftedChat */}
      <PickImageModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
        onPick={handleImagePicked}
      />
      <Modal
  visible={showEmojiModal}
  animationType="slide"
  transparent={false}
  onRequestClose={() => setShowEmojiModal(false)}
>
  <View style={{ flex: 1, backgroundColor: "#fff" }}>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 10 }}>
      <TouchableOpacity onPress={() => setShowEmojiModal(false)}>
        <Ionicons name="close" size={28} color="#000" />
      </TouchableOpacity>
    </View>

    {/* ✅ Emoji Selector inside modal */}
    <EmojiSelector
      onEmojiSelected={(emoji) => setText((prev) => prev + emoji)}
      showSearchBar={false}
      showTabs={true}
      columns={8}
    />
  </View>
</Modal>
      <VoiceRecorder visible={showVoiceModal} onClose={() => setShowVoiceModal(false)} onSend={onSend} userId={user?.id} />
      <VideoRecorder visible={showVideoModal} onClose={() => setShowVideoModal(false)} onSend={onSend} userId={user?.id} />

      <Stack.Screen options={{ headerTitle: isTyping ? typingUserName : title }} />

      <ImageBackground source={require('@/assets/images/pattern.png')} style={{ flex: 1, backgroundColor: Colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={66}>
          <GiftedChat
            messages={imessages}
            onSend={(m) => onSend(m)}
            onInputTextChanged={handleTyping}
            user={{ _id: user?.id! }}
            bottomOffset={insets.bottom}
            renderAvatar={null}
            maxComposerHeight={100}
            text={text}
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
            renderChatFooter={renderChatFooter}
            renderMessage={(props) => (
              <ChatMessageBox
                {...props}
                socket={socket}
                setEditingMessage={setEditingMessage}
                editingMessage={editingMessage}
                editedText={text}
                setEditedText={setText}
                setReplyOnSwipeOpen={setReplyMessage}
                updateRowRef={updateRowRef}
              />
            )}
           isTyping={isTyping} 
          />
        </KeyboardAvoidingView>
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  sendContainer: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 14,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f1f1",
    borderLeftWidth: 3,
    borderLeftColor: "#25D366",
    padding: 8,
  },
  
  replyTitle: { fontWeight: "700", color: "#25D366" },
  replyPreview: { color: "#333", width: "80%" },
  editingBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    borderLeftWidth: 3,
    borderLeftColor: "#ff9800",
    padding: 8,
  },
  editingTitle: { fontWeight: "700", color: "#ff9800" },
  editingText: { color: "#555", flex: 1 },
});

export default ChatPage;