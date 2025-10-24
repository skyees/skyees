
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
  Text, // Added for the editing bar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
import { Swipeable } from 'react-native-gesture-handler';

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
  const [editingMessage, setEditingMessage] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const swipeableRowRef = useRef<Swipeable | null>(null);

  // Fetch Chat User / Room Name
  useEffect(() => {
    const fetchTitle = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/${isGroup ? 'rooms' : 'users'}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTitle(`${data.name || data.roomName || 'Unknown'} ${data.status || ''}`);
      } catch (err) {
        console.error('❌ Fetch Error:', err);
        setTitle('Chat');
      }
    };
    fetchTitle();
  }, [id, isGroup]);

  // Format Messages from History
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
        user: { _id: msg.senderId, name: msg.senderName || 'User' },
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    setImessages(formatted);
  }, [messages, user?.id]);

  // Listen for Real-Time Messages & Edits
  useEffect(() => {
    const messageHandler = (message: any) => {
      if (message.senderId === user?.id) return;
      const newMsg: IMessage = {
        _id: message._id,
        text: message.text ?? '',
        createdAt: new Date(message.createdAt),
        image: message.image,
        audio: message.audio,
        video: message.video,
        user: { _id: message.senderId },
      };
      setImessages((prev) => GiftedChat.append(prev, [newMsg]));
    };

    const editHandler = (editedMsg: any) => {
      setImessages((prev) =>
        prev.map((msg) =>
          msg._id === editedMsg._id ? { ...msg, text: editedMsg.text } : msg
        )
      );
    };

    socket.on('private-message', messageHandler);
    socket.on('room-message', messageHandler);
    socket.on('message-edited', editHandler);

    return () => {
      socket.off('private-message', messageHandler);
      socket.off('room-message', messageHandler);
      socket.off('message-edited', editHandler);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    socket.on('message-edited', (updatedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === updatedMessage._id ? { ...msg, text: updatedMessage.text } : msg
        )
      );
    });

    return () => socket.off('message-edited');
  }, []);

    useEffect(() => {
      if (!socket) return;

      socket.on('message-deleted', ({ messageId }) => {
        console.log('🗑️ Message deleted:', messageId);
        setImessages((prev) => prev.filter((m) => m._id !== messageId));
      });

      return () => {
        socket.off('message-deleted');
      };
    }, [socket]);

  const onSend = useCallback((messages: IMessage[] = []) => {
    const msg = messages[0];

    // 🟩 Case 1: Editing existing message
    if (editingMessage) {
      // Emit edit event
      socket.emit('edit-message', {
        messageId: editingMessage._id,
        newText: msg.text,
      });

      // Update local state instantly
      setImessages((prev) =>
        prev.map((m) =>
          m._id === editingMessage._id
            ? { ...m, text: msg.text, edited: true }
            : m
        )
      );

      // Reset edit state
      setEditingMessage(null);
      setText('');
      return;
    }

    // 🟩 Case 2: Sending new message
    setImessages((prev) => GiftedChat.append(prev, messages));

    const payload = {
      id: msg._id,
      text: msg.text || '',
      senderId: user?.id,
      createdAt: new Date(),
      ...(msg.image && { image: msg.image }),
      ...(msg.audio && { audio: msg.audio }),
      ...(msg.video && { video: msg.video }),
      ...(isGroup && id ? { roomId: id } : { receiverId }),
    };

    socket.emit('new-message', payload);
  },
  [socket, user?.id, receiverId, isGroup, id, editingMessage]);


  // Function to enter edit mode
  const enterEditMode = (message) => {
    setEditingMessage(message);
    setInputText(message.text); // Pre-fill the input with the message text
  };

  // CORRECTED handleLongPress function
  const handleLongPress = (context: any, message: IMessage) => {
    if (message.user?._id !== user?.id) {
      // For other users' messages, only allow reply
      setReplyMessage(message);
      return;
    }
    const options = ['Edit', 'Delete', 'Cancel'];
    const cancelButtonIndex = 2;
    context.actionSheet().showActionSheetWithOptions(
      { options, cancelButtonIndex },
      (buttonIndex: number) => {
        if (buttonIndex === 0) { // Edit
          enterEditMode(message);
          setText(message.text || '');
        } else if (buttonIndex === 1) { // Delete
          socket.emit('delete-message', { messageId: message._id });
        }
      }
    );
  };

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission needed', 'Permission to access the camera roll is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets) {
      const uri = result.assets[0].uri;
      const message: IMessage = {
        _id: Math.random().toString(36),
        text: '',
        createdAt: new Date(),
        user: { _id: user?.id! },
        image: uri,
      };
      onSend([message]);
    }
  };

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={{ backgroundColor: Colors.background }}
      renderActions={() => (
        <TouchableOpacity
          style={{ height: 44, justifyContent: 'center', alignItems: 'center', left: 5, paddingHorizontal: 10 }}
          onPress={handleImagePick}
        >
          <Ionicons name="image-outline" color={Colors.primary} size={28} />
        </TouchableOpacity>
      )}
    />
  );

  // New function to render the editing bar
  const renderChatFooter = () => {
    if (editingMessage) {
      return (
        <View style={styles.editingBar}>
          <View>
            <Text style={styles.editingTitle}>Editing Message</Text>
            <Text numberOfLines={1} style={styles.editingText}>
              {editingMessage.text}
            </Text>
          </View>
          <TouchableOpacity onPress={() => {
            setEditingMessage(null);
            setText('');
          }}>
            <Ionicons name="close-circle" size={24} color={Colors.gray} />
          </TouchableOpacity>
        </View>
      );
    }
    return <ReplyMessageBar clearReply={() => setReplyMessage(null)} message={replyMessage} />;
  };

  const updateRowRef = useCallback((ref: Swipeable | null) => {
    if (ref && replyMessage && ref.props.children?.props?.currentMessage?._id === replyMessage._id) {
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
      <VoiceRecorder visible={showVoiceModal} onClose={() => setShowVoiceModal(false)} onSend={onSend} userId={user?.id} />
      <VideoRecorder visible={showVideoModal} onClose={() => setShowVideoModal(false)} onSend={onSend} userId={user?.id} />
      <Stack.Screen options={{ headerTitle: title }} />
      <ImageBackground source={require('@/assets/images/pattern.png')} style={{ flex: 1, backgroundColor: Colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={66}>
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
                  onLongPress={handleLongPress}
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
  editingBar: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  editingTitle: {
    fontWeight: 'bold',
    color: Colors.primary,
    fontSize: 14,
  },
  editingText: {
    color: Colors.gray,
    fontSize: 14,
    paddingTop: 2,
  },
});

export default ChatPage;
