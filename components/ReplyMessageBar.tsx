import Colors from '@/constants/Colors';
import resolveDisplayName from '@/utils/displayName';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, Text } from 'react-native';
import { IMessage } from 'react-native-gifted-chat';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

type ReplyMessageBarProps = {
  clearReply: () => void;
  message: IMessage | null;
  currentUserId?: string;
  contactMap?: Record<string, string>;
  isEditing?: boolean;
};

const ReplyMessageBar = ({
  clearReply,
  message,
  currentUserId,
  contactMap,
  isEditing = false,
}: ReplyMessageBarProps) => {
  if (!message) return null;

  const label = isEditing ? "Editing message" : "Replying to";
  const name = resolveDisplayName(message.user, currentUserId, contactMap);

  return (
    <Animated.View
      style={{ height: 50, flexDirection: "row", backgroundColor: "#E4E9EB" }}
      entering={FadeInDown}
      exiting={FadeOutDown}
    >
      <View style={{ height: 50, width: 6, backgroundColor: "#89BC0C" }} />
      <View style={{ flexDirection: "column", flex: 1 }}>
        <Text style={{ color: "#89BC0C", paddingLeft: 10, paddingTop: 5, fontWeight: "600", fontSize: 15 }}>
          {label} {name}
        </Text>
        <Text style={{ color: Colors.gray, paddingLeft: 10, paddingTop: 5 }}>
          {message.text?.length > 40 ? message.text.substring(0, 40) + "..." : message.text}
        </Text>
      </View>
      <View style={{ justifyContent: "center", alignItems: "flex-end", paddingRight: 10 }}>
        <TouchableOpacity onPress={clearReply}>
          <Ionicons name="close-circle-outline" color={Colors.primary} size={28} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};



export default ReplyMessageBar;
