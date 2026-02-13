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
import { FlatList, Swipeable, TextInput } from 'react-native-gesture-handler';
import 'react-native-get-random-values';
import EmojiSelector from "react-native-emoji-selector";
import { v4 as uuidv4 } from 'uuid';

const ChatPage = () => {
  const socket = useSocket();
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [imessages, setImessages] = useState<IMessage[]>([]);
  const insets = useSafeAreaInsets();
  
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const receiverId = Array.isArray(params.receiverId) ? params.receiverId[0] : params.receiverId;
  const isRoom = params.isRoom === 'true';

  const isGroup = isRoom;
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
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listRef = useRef<any>(null);
  const messagePositions = useRef<Record<string, number>>({});
  const handleMeasure = (id: string, y: number) => {
    messagePositions.current[id] = y;
  };
  
  // 1. Socket Connection & Rooms
  useEffect(() => {
    if (!socket || !id) return;
    if (isGroup) {
      socket.emit("join-room", id);
    }
  }, [socket, id, isGroup]);

  // 2. Typing Handlers
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

  // 3. Fetch Title
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

  // 4. Initial Message Load
  useEffect(() => {
    if (!Array.isArray(messages) || !user?.id) return;
    const formatted = messages
      .map((msg: any) => ({
        _id: msg._id,
        text: msg.text ?? '',
        status: msg.status || "sent",
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

  // 5. Socket Registration & Listeners
  useEffect(() => {
    if (socket && user?.id) {
      socket.emit("register", user.id);
    }
  }, [socket, user?.id]);

  useEffect(() => {
    if (!socket || !user) return;

    const messageHandler = (incoming: any) => {
      const data = Array.isArray(incoming) ? incoming[0] : incoming;
      if (!data) return;

      setImessages((prev) => {
        let next = prev;
        const targetClientId = data.clientId || data._id;

        if (targetClientId) {
          next = next.filter((m) => !( (m as any).__optimistic && m._id === targetClientId));
        }
        
        if (next.some((m) => m._id === data._id)) return next;

        let replyObj: any = null;
        if (data.replyTo) {
          if (typeof data.replyTo === "object") {
            replyObj = {
              _id: data.replyTo._id,
              text: data.replyTo.text || "",
              image: data.replyTo.image || null,
              video: data.replyTo.video || null,
              audio: data.replyTo.audio || null,
              senderId: data.replyTo.senderId || data.replyTo.user?._id,
              senderName: data.replyTo.senderName || data.replyTo.user?.name || "",
            };
          } else {
            const found = next.find((m) => m._id === data.replyTo);
            if (found) {
              replyObj = {
                _id: found._id,
                text: found.text,
                image: found.image,
                video: found.video,
                audio: found.audio,
                senderId: found.user?._id,
                senderName: found.user?.name,
              };
            }
          }
        }

        const senderId = data.senderId || data.user?._id;
        const senderName = data.senderName || data.user?.name || 'User';

        const formatted = {
          _id: data._id,
          text: data.text,
          createdAt: new Date(data.createdAt),
          user: { _id: senderId, name: senderName },
          replyTo: replyObj,
          status: data.status || "sent",
          image: data.image,
          video: data.video,
          audio: data.audio,
          edited: data.edited,
        };
        
        return GiftedChat.append(next, [formatted]);
      });
    };

    socket.on("message-delivered", ({ messageId }) => {
      setImessages(prev =>
        prev.map(m =>
          m._id === messageId
            ? { ...m, status: "delivered" }
            : m
        )
      );
    });

    socket.on('private-message', messageHandler);
    socket.on('room-message', messageHandler);
    socket.on('new-message', messageHandler);

    socket.on('message-edited', (editedMsg) => {
      setImessages((prev) => prev.map((msg) => 
        msg._id === editedMsg._id 
          ? { ...msg, text: editedMsg.text, edited: true } 
          : msg
      ));
    });

    socket.on('message-deleted', ({ messageId }) => {
      setImessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => {
      socket.off('private-message');
      socket.off('room-message');
      socket.off('new-message');
      socket.off('message-edited');
      socket.off('message-deleted');
      socket.off('message-delivered'); 
    };
  }, [socket, user?.id]);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("messages-seen", {
      roomId: isGroup ? id : null,
      withUser: !isGroup ? receiverId : null
    });

  }, [id]);

  socket.on("messages-seen-update", () => {
      setImessages(prev =>
        prev.map(m =>
          m.user._id === user.id
            ? { ...m, status: "seen" }
            : m
        )
      );
    });

  const handleTyping = (t: string) => {
    setText(t);
    if (!user) return;
    if (!typingTimeout.current) {
      socket.emit("typing", { senderId: user.id, receiverId, roomId: isGroup ? id : null });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop-typing", { senderId: user.id, receiverId, roomId: isGroup ? id : null });
      typingTimeout.current = null;
    }, 1200);
  };

  const onSend = useCallback((messages: IMessage[] = []) => {
    if (!user) return;
    const msg = messages[0];

    // Handle Edit Mode
    if (editingMessage) {
        setImessages(prev => prev.map(m => 
            m._id === editingMessage._id 
            ? { ...m, text: msg.text, edited: true } 
            : m
        ));

        socket.emit("edit-message", {
            messageId: editingMessage._id,
            text: msg.text,
            roomId: isGroup ? id : undefined,
            receiverId: !isGroup ? receiverId : undefined
        });

        setEditingMessage(null);
        setText('');
        return;
    }

    const clientId = msg._id || uuidv4(); 
    
    const targetUserId = (receiverId && receiverId !== user.id) ? receiverId : id;

    const optimisticMessage = {
      ...msg,
      _id: clientId,
      user: { _id: user.id },
      createdAt: new Date(),
      __optimistic: true,
      status: "sending",
      edited: false,
      replyTo: replyMessage
        ? {
            _id: replyMessage._id,
            text: replyMessage.text,
            image: replyMessage.image,
            video: replyMessage.video,
            audio: replyMessage.audio,
            senderId: replyMessage.user._id,
          }
        : null,
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
      ...(isGroup ? { roomId: id } : { receiverId: targetUserId }),
    });

    setReplyMessage(null);
  }, [user, replyMessage, editingMessage, socket, isGroup, id, receiverId]);

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

  const renderInputToolbar = useCallback((props: any) => (
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
  ), []);

  const renderSendButton = useCallback((props: any) => {
    const isEditing = !!editingMessage;
    
    return (
      <View style={styles.sendContainer}>
        {text.length === 0 && !isEditing ? (
          <>
            <TouchableOpacity onPress={() => setShowVideoModal(true)}>
              <Ionicons name="camera-outline" color={Colors.primary} size={28} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowVoiceModal(true)}>
              <Ionicons name="mic-outline" color={Colors.primary} size={28} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={{ justifyContent: 'center' }}
            onPress={() => {
              if (props.onSend) {
                props.onSend({ text: text.trim() }, true);
              }
            }}
          >
            <Ionicons 
                name={isEditing ? "checkmark-circle" : "send"} 
                color={Colors.primary} 
                size={28} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [text, editingMessage]);

  const renderMessageContainer=(props) => {
    return (
      <FlatList
        {...props}
        ref={listRef}
      />
    );
  }
  
const onReplyPress = useCallback((replyId: string) => {
  const index = imessages.findIndex(m => m._id === replyId);

  if (index === -1) {
    Alert.alert("Original message not loaded yet");
    return;
  }

  setHighlightId(replyId);

  const invertedIndex = index;

  setTimeout(() => {
    listRef.current?.scrollToIndex?.({
      index: invertedIndex,
      animated: true,
    });
  }, 50);

  setTimeout(() => setHighlightId(null), 1800);

}, [imessages]);


const renderMessageItem = useCallback((props: any) => (
  <ChatMessageBox
    {...props}
    socket={socket}
    setEditingMessage={setEditingMessage}
    editingMessage={editingMessage}
    editedText={text}
    setEditedText={setText}
    setReplyOnSwipeOpen={setReplyMessage}
    updateRowRef={updateRowRef}
    onMeasure={handleMeasure}
    onReplyPress={onReplyPress}
    highlightId={highlightId}
  />
), [socket, editingMessage, text, highlightId, onReplyPress]);


  const renderChatFooter = useCallback(() => {
    if (editingMessage) {
      return (
        <View style={styles.editingBar}>
          <Ionicons name="create-outline" size={18} color="#ff9800" />
          <Text numberOfLines={1} style={styles.footerText}>
            Editing: {editingMessage.text}
          </Text>
          <TouchableOpacity onPress={() => {
            setEditingMessage(null);
            setText('');
          }}>
            <Ionicons name="close" size={20} color="gray" />
          </TouchableOpacity>
        </View>
      );
    }

    if (replyMessage) {
      return (
        <View style={styles.replyBar}>
          <Ionicons name="return-up-back" size={18} color="#25D366" />
          <Text numberOfLines={1} style={styles.footerText}>
            Replying to: {replyMessage.text || "Media"}
          </Text>
          <TouchableOpacity onPress={() => setReplyMessage(null)}>
            <Ionicons name="close" size={20} color="gray" />
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [editingMessage, replyMessage]);

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
        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <GiftedChat
            messages={imessages}
            onSend={(m) => onSend(m)}
            onInputTextChanged={handleTyping}
            user={{ _id: user?.id! }}
            bottomOffset={insets.bottom}
            renderAvatar={null}
            maxComposerHeight={100}
            text={text}
            renderSend={renderSendButton}
            renderInputToolbar={renderInputToolbar}
            renderMessage={renderMessageItem}        
            renderChatFooter={renderChatFooter}
            alwaysShowSend={true}
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
  footerText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    marginHorizontal: 8,
  },
  replyBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderLeftWidth: 4,
    borderLeftColor: "#25D366",
    paddingHorizontal: 10,
  },
  editingBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e1",
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
    paddingHorizontal: 10,
  },
});

export default ChatPage;