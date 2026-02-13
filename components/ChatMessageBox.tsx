import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Alert, Animated } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Audio, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { IMessage, MessageProps } from 'react-native-gifted-chat';

type ChatMessageBoxProps = {
  setReplyOnSwipeOpen: (message: IMessage) => void;
  updateRowRef: (ref: any) => void;
  socket: any;
  onMeasure?: (id: string, y: number) => void;
  onReplyPress?: (id: string) => void;
  highlightId?: string | null;
  setEditingMessage: (message: IMessage | null) => void;
  editingMessage: IMessage | null;
  editedText: string;
  setEditedText: (text: string) => void;
} & MessageProps<IMessage>;

const ChatMessageBox = ({
  setReplyOnSwipeOpen,
  updateRowRef,
  highlightId,
  editingMessage,
  onReplyPress,
  socket,
  setEditingMessage,
  editedText,
  setEditedText,
  ...props
}: ChatMessageBoxProps) => {
  const msg = props.currentMessage;
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const isMine = props.position === 'right';
  const isHighlighted = props.highlightId === msg?._id;

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]).start();
    }
  }, [isHighlighted]);

  const renderLeftActions = () => (
    <View style={styles.replySwipe}>
      <Ionicons name="arrow-undo" size={22} color="white" />
    </View>
  );

  const onSwipe = () => {
    if (msg) setReplyOnSwipeOpen(msg);
  };

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

  const renderReplyPreview = () => {
    if (!msg?.replyTo) return null;

    const reply = msg.replyTo;

    let preview =
      reply.text ||
      (reply.image ? "📷 Photo" :
       reply.video ? "📹 Video" :
       reply.audio ? "🎤 Voice" : null);

    if (!preview) return null;

    return (
      <TouchableOpacity
        onPress={() => props.onReplyPress?.(reply._id)}
        activeOpacity={0.7}
        style={styles.replyBubble}
      >
        <Text numberOfLines={2} style={styles.replyPreviewText}>
          {preview}
        </Text>
      </TouchableOpacity>
    );
  };

  // ✅ UPDATED: Exact WhatsApp Style Ticks (Blue for Seen)
  const renderTicks = () => {
    if (!isMine || !msg?.status) return null;

    // 1. Sending -> Clock Icon
    if (msg.status === "sending") 
      return <Ionicons name="time-outline" size={12} color="#777" style={{ marginLeft: 2 }} />;

    // 2. Sent -> Single Tick (Gray)
    if (msg.status === "sent") 
      return <Ionicons name="checkmark" size={16} color="#777" style={{ marginLeft: 2 }} />;

    // 3. Delivered -> Double Tick (Gray)
    if (msg.status === "delivered") 
      return <Ionicons name="checkmark-done" size={16} color="#777" style={{ marginLeft: 2 }} />;

    // 4. Seen -> Double Tick (Blue)
    if (msg.status === "seen")
      return <Ionicons name="checkmark-done" size={16} color="#34B7F1" style={{ marginLeft: 2 }} />;
      
    return null;
  };

  const renderMessageBody = () => {
    const bubbleStyle = [
      styles.bubble,
      {
        backgroundColor: isHighlighted
          ? "#fff3cd"        // highlight flash
          : isMine ? '#dcf8c6' : '#ffffff',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      },
    ];

    // ---- Text ----
    if (msg?.text) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Text style={styles.text}>{msg.text}</Text>
            {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
            <View style={styles.tickRow}>{renderTicks()}</View>
          </View>
        </View>
      );
    }

    // ---- Image ----
    if (msg?.image) {
      return (
        <View style={bubbleStyle}>
          {renderReplyPreview()}
          <Image
            source={{ uri: msg.image }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
            {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
            <View style={styles.tickRow}>{renderTicks()}</View>
          </View>
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
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
            {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
            <View style={styles.tickRow}>{renderTicks()}</View>
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
             <Text style={{color: '#333'}}>▶️ Play Voice Message</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
            {msg.edited && <Text style={styles.editedFlag}>(edited)</Text>}
            <View style={styles.tickRow}>{renderTicks()}</View>
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const container = {
    paddingHorizontal: 8,
    marginVertical: 3,
    alignItems: isMine ? "flex-end" : "flex-start",
  } as const;

  return (
    <GestureHandlerRootView>
      <Swipeable
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={onSwipe}
        ref={updateRowRef}
      >
        <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress}>
          <View
            style={container}
            onLayout={(e) => {
              if (msg?._id) {
                props.onMeasure?.(msg._id, e.nativeEvent.layout.y);
              }
            }}
          >
            {renderMessageBody()}
          </View>
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
    minWidth: 100,
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
  tickRow: {
    marginLeft: 4,
    marginBottom: 2,
  },
  text: {
    color: '#111',
    fontSize: 16,
  },
  replyBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  replyStripe: {
    width: 3,
    height: '100%',
    backgroundColor: '#25D366',
    borderRadius: 2,
    marginRight: 6,
  },
  replyPreviewText: {
    flex: 1,
    fontSize: 12,
    color: '#222',
  },
  editedFlag: {
    fontSize: 10,
    color: 'gray',
    marginRight: 4,
    fontStyle: 'italic',
  },
});

export default ChatMessageBox;