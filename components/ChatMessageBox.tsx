import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Text, Image, Alert, TextInput, Button } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Audio, Video } from 'expo-av';
import Colors from '@/constants/Colors';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import { isSameDay, isSameUser } from 'react-native-gifted-chat/lib/utils';

// Add props for controlled editing state
type ChatMessageBoxProps = {
  setReplyOnSwipeOpen: (message: IMessage) => void;
  updateRowRef: (ref: any) => void;
  socket: any;
  setEditingMessage: (message: IMessage | null) => void;
  editingMessage: IMessage | null;
  editedText: string; // New prop for controlled input
  setEditedText: (text: string) => void; // New prop for controlled input
} & MessageProps<IMessage>;

const ChatMessageBox = ({ setReplyOnSwipeOpen, updateRowRef, socket, setEditingMessage, editingMessage, editedText, setEditedText, ...props }: ChatMessageBoxProps) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isEditing = editingMessage?._id === props.currentMessage?._id;

  const isNextMyMessage =
    props.currentMessage &&
    props.nextMessage &&
    isSameUser(props.currentMessage, props.nextMessage) &&
    isSameDay(props.currentMessage, props.nextMessage);

  const renderRightAction = (progressAnimatedValue: Animated.AnimatedInterpolation<any>) => {
    // ...
    return <View />
  };

  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onSwipeOpenAction = () => {
    if (props.currentMessage) {
      setReplyOnSwipeOpen({ ...props.currentMessage });
    }
  };

  const onSaveEdit = () => {
    if (props.currentMessage?._id && editedText.trim().length > 0) {
        socket.emit('edit-message', { messageId: props.currentMessage._id, newText: editedText });
        setEditingMessage(null); // Exit editing mode
    } else {
        setEditingMessage(null);
    }
  };

  const onCancelEdit = () => {
    setEditingMessage(null);
  };

  const renderCustomMessage = () => {
    const message = props.currentMessage;
    if (!message) return null;

    const bubbleStyle = {
        backgroundColor: props.position === 'right' ? '#dcf8c6' : '#fff',
        padding: 10,
        borderRadius: 10,
        maxWidth: '70%',
        marginVertical: 4,
        alignSelf: props.position === 'right' ? 'flex-end' : 'flex-start',
      };

      if (isEditing && props.position === 'right') {
        return (
            <View style={bubbleStyle}>
                <TextInput
                    value={editedText} // Controlled component
                    onChangeText={setEditedText} // Controlled component
                    autoFocus
                    style={{ marginBottom: 10, padding: 5, backgroundColor: 'white', borderRadius: 5 }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                    <Button title="Cancel" onPress={onCancelEdit} color={Colors.gray} />
                    <Button title="Save" onPress={onSaveEdit} />
                </View>
            </View>
        );
    }

      if (message.video) {
        return <View style={bubbleStyle}><Video source={{ uri: message.video }} style={{ width: 200, height: 200, borderRadius: 8 }} useNativeControls resizeMode={Video.RESIZE_MODE_CONTAIN} isLooping /></View>;
      }
     if (message.audio) {
       const playAudio = async () => {
         try {
           if (sound) {
             await sound.unloadAsync();
             setSound(null);
             setIsPlaying(false);
           }

           const { sound: newSound } = await Audio.Sound.createAsync(
             { uri: message.audio },
             { shouldPlay: true }
           );

           setSound(newSound);
           setIsPlaying(true);

           newSound.setOnPlaybackStatusUpdate((status) => {
             if (status.isLoaded && !status.isPlaying) {
               setIsPlaying(false);
             }
           });

           await newSound.playAsync();
         } catch (error) {
           console.error('🔊 Audio playback error:', error);
           Alert.alert('Playback Error', 'Unable to play audio.');
         }
       };

       return (
         <TouchableOpacity style={bubbleStyle} onPress={playAudio}>
           <Text>{isPlaying ? '⏸️ Playing Audio' : '▶️ Play Audio'}</Text>
         </TouchableOpacity>
       );
     }


      if (message.image) {
        return <View style={bubbleStyle}><Image source={{ uri: message.image }} style={{ width: 200, height: 200, borderRadius: 8 }} /></View>;
      }
      if (message.text) {
        return <View style={bubbleStyle}><Text>{message.text}</Text></View>;
      }
      return <View style={bubbleStyle}><Text>Unsupported message</Text></View>;
  };

  const onLongPress = () => {
    if (props.currentMessage && props.position === 'right' && props.currentMessage.text) {
      const options = ['Edit', 'Delete', 'Cancel'];
      Alert.alert('Message Options', '', options.map(option => ({
        text: option,
        onPress: () => {
          if (option === 'Edit') {
            setEditingMessage(props.currentMessage);
            setEditedText(props.currentMessage?.text || ''); // Initialize text in parent
          }
          if (option === 'Delete') {
            if (props.currentMessage?._id) {
              socket.emit('delete-message', { messageId: props.currentMessage._id });
            }
          }
        },
        style: option === 'Delete' ? 'destructive' : 'default',
      })), { cancelable: true });
    }
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        ref={updateRowRef}
        friction={2}
        rightThreshold={40}
        renderLeftActions={renderRightAction}
        onSwipeableWillOpen={onSwipeOpenAction}
      >
        <TouchableOpacity onLongPress={onLongPress} activeOpacity={0.8}>
          {renderCustomMessage()}
        </TouchableOpacity>
      </Swipeable>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
    container: {
        width: 40,
      },
      replyImageWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      defaultBottomOffset: {
        marginBottom: 2,
      },
      bottomOffsetNext: {
        marginBottom: 10,
      },
      leftOffsetValue: {
        marginLeft: 16,
      },
});

const areEqual = (prevProps: Readonly<ChatMessageBoxProps>, nextProps: Readonly<ChatMessageBoxProps>) => {
  const prevMessage = prevProps.currentMessage;
  const nextMessage = nextProps.currentMessage;

  const isPrevEditing = prevProps.editingMessage?._id === prevMessage?._id;
  const isNextEditing = nextProps.editingMessage?._id === nextMessage?._id;

  // If this message is the one being edited, we need to check if the text has changed.
  if (isPrevEditing || isNextEditing) {
    if (isPrevEditing !== isNextEditing || prevProps.editedText !== nextProps.editedText) {
      return false; // Re-render if editing state or edited text changes
    }
  }

  // Re-render if the message content itself has changed.
  if (
    prevMessage?.text !== nextMessage?.text ||
    prevMessage?.image !== nextMessage?.image ||
    prevMessage?.video !== nextMessage?.video
  ) {
    return false;
  }

  // Re-render if the position (left/right) changes.
  if (prevProps.position !== nextProps.position) {
    return false;
  }

  // For all other cases, assume the props are equal and prevent re-rendering.
  return true;
};

export default React.memo(ChatMessageBox, areEqual);
