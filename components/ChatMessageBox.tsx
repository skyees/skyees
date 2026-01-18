import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Alert } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Audio, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { IMessage, MessageProps } from 'react-native-gifted-chat';

type ChatMessageBoxProps = {
  setReplyOnSwipeOpen: (message: IMessage) => void;
  updateRowRef: (ref: any) => void;
  socket: any;
  setEditingMessage: (message: IMessage | null) => void;
  editingMessage: IMessage | null;
  editedText: string;
  setEditedText: (text: string) => void;
} & MessageProps<IMessage>;

const ChatMessageBox = ({
  setReplyOnSwipeOpen,
  updateRowRef,
  socket,
  setEditingMessage,
  editedText,
  setEditedText,
  ...props
}: ChatMessageBoxProps) => {
  const msg = props.currentMessage;
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const isMine = props.position === 'right';

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  // ✅ Swipe reply action
  const renderLeftActions = () => (
    <View style={styles.replySwipe}>
      <Ionicons name="arrow-undo" size={22} color="white" />
    </View>
  );

  const onSwipe = () => {
    if (msg) setReplyOnSwipeOpen(msg);
  };

  // ✅ Long press options
  const onLongPress = () => {
    if (!msg) return;

    const options = isMine
      ? ['Reply', 'Edit', 'Delete', 'Cancel']
      : ['Reply', 'Cancel'];

    Alert.alert(
      'Message Options',
      '',
      options.map((op) => ({
        text: op,
        onPress: () => {
          if (op === 'Reply') setReplyOnSwipeOpen(msg);

          if (op === 'Edit' && isMine) {
            setEditingMessage(msg);
            setEditedText(msg.text || '');
          }

          if (op === 'Delete' && isMine) {
            socket.emit('delete-message', { messageId: msg._id });
          }
        },
        style: op === 'Delete' ? 'destructive' : 'default',
      }))
    );
  };

  // ✅ WhatsApp-style reply preview
  const renderReplyPreview = () => {
    if (!msg?.replyTo) return null;
    const reply = msg.replyTo;

    let preview =
      reply.text ||
      (reply.image
        ? '📷 Photo'
        : reply.video
        ? '📹 Video'
        : reply.audio
        ? '🎤 Voice'
        : 'Message');

    return (
      <View style={styles.replyBubble}>
        <Text style={styles.replySender}>
          {reply.senderId === props.user?._id
          ? 'You'
          : reply.senderName
          ? reply.senderName  
          : 'Unknown'}         
        </Text>
        <Text numberOfLines={6} style={styles.replyPreviewText}>
          {preview}
        </Text>
      </View>
    );
  };

  // ✅ Main message body
  const renderMessageBody = () => {
    const bubbleStyle = [
      styles.bubble,
      {
        backgroundColor: isMine ? '#dcf8c6' : '#ffffff',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      },
    ];

    // ---- Text ----
    if (msg?.text) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <Text style={styles.text}>{msg.text}</Text>
          {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
        </View>
      );
    }

    // ---- Image ----
    if (msg?.image) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <Image source={{ uri: msg.image }} style={styles.mediaImage} />
          {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
        </View>
      );
    }

    // ---- Video ----
    if (msg?.video) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <Video
            source={{ uri: msg.video }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
          />
          {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
        </View>
      );
    }

    // ---- Audio ----
    if (msg?.audio) {
      const play = async () => {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: msg.audio },
          { shouldPlay: true }
        );
        setSound(s);
      };

      return (
        <TouchableOpacity style={bubbleStyle} onPress={play}>
          {renderReplyPreview()}
          <Text>▶️ Play Voice Message</Text>
          {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
        </TouchableOpacity>
      );
    }

    // ---- Contact ----
    if (msg?.contact) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <View style={styles.contactCard}>
            <Ionicons name="person-circle-outline" size={32} color="#128C7E" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.contactName}>
                {msg.contact?.name || 'Contact'}
              </Text>
              <Text style={styles.contactLabel}>Contact Message</Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  // ✅ Alignment container
  const container = {
    width: '100%',
    flexDirection: isMine ? 'row-reverse' : 'row',
    paddingHorizontal: 8,
    marginVertical: 3,
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={onSwipe}
        ref={updateRowRef}
      >
        <TouchableOpacity activeOpacity={0.8} onLongPress={onLongPress}>
          <View style={container}>{renderMessageBody()}</View>
        </TouchableOpacity>
      </Swipeable>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  bubble: {
    padding: 8,
    borderRadius: 10,
    maxWidth: '80%',
  },
  text: {
    color: '#111',
    fontSize: 16,
  },
  mediaImage: {
    width: 230,
    height: 230,
    borderRadius: 8,
  },
  video: {
    width: 230,
    height: 230,
    borderRadius: 8,
  },
  replySwipe: {
    width: 45,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyBubble: {
    backgroundColor: '#e8e8e8',
    borderLeftColor: '#25D366',
    borderLeftWidth: 4,
    padding: 6,
    borderRadius: 6,
    marginBottom: 5,
  },
  replySender: {
    fontWeight: 'bold',
    color: '#25D366',
    fontSize: 13,
  },
  replyPreviewText: {
    color: '#333',
  },
  editedFlag: {
    fontSize: 10,
    color: 'gray',
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#128C7E',
  },
  contactLabel: {
    fontSize: 13,
    color: '#555',
  },
});

export default ChatMessageBox;