import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Text, Image } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Audio } from 'expo-av';
import Colors from '@/constants/Colors';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import { isSameDay, isSameUser } from 'react-native-gifted-chat/lib/utils';

type ChatMessageBoxProps = {
  setReplyOnSwipeOpen: (message: IMessage) => void;
  updateRowRef: (ref: any) => void;
} & MessageProps<IMessage>;

const ChatMessageBox = ({ setReplyOnSwipeOpen, updateRowRef, ...props }: ChatMessageBoxProps) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isNextMyMessage =
    props.currentMessage &&
    props.nextMessage &&
    isSameUser(props.currentMessage, props.nextMessage) &&
    isSameDay(props.currentMessage, props.nextMessage);

  const renderRightAction = (progressAnimatedValue: Animated.AnimatedInterpolation<any>) => {
    const size = progressAnimatedValue.interpolate({
      inputRange: [0, 1, 100],
      outputRange: [0, 1, 1],
    });
    const trans = progressAnimatedValue.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, 12, 20],
    });

    return (
      <Animated.View
        style={[
          styles.container,
          { transform: [{ scale: size }, { translateX: trans }] },
          isNextMyMessage ? styles.defaultBottomOffset : styles.bottomOffsetNext,
          props.position === 'right' && styles.leftOffsetValue,
        ]}
      >
        <View style={styles.replyImageWrapper}>
          <MaterialCommunityIcons name="reply-circle" size={26} color={Colors.gray} />
        </View>
      </Animated.View>
    );
  };

  const onSwipeOpenAction = () => {
    if (props.currentMessage) {
      setReplyOnSwipeOpen({ ...props.currentMessage });
    }
  };

  const handlePlayAudio = async () => {
    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (!sound && props.currentMessage?.audio) {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: props.currentMessage.audio },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setSound(null);
        }
      });
    } else if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
    }
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

    if (message.audio) {
      return (
        <TouchableOpacity style={bubbleStyle} onPress={handlePlayAudio}>
          <Text>{isPlaying ? '⏸️ Playing Audio' : '▶️ Play Audio'}</Text>
        </TouchableOpacity>
      );
    }

    if (message.image) {
      return (
        <View style={bubbleStyle}>
          <Image source={{ uri: message.image }} style={{ width: 200, height: 200, borderRadius: 8 }} />
        </View>
      );
    }

    if (message.text) {
      return (
        <View style={bubbleStyle}>
          <Text>{message.text}</Text>
        </View>
      );
    }

    return (
      <View style={bubbleStyle}>
        <Text>Unsupported message</Text>
      </View>
    );
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
        {renderCustomMessage()}
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

export default ChatMessageBox;
