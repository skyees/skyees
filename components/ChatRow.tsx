import AppleStyleSwipeableRow from '@/components/AppleStyleSwipeableRow';
import Colors from '@/constants/Colors';
import { format, isToday } from 'date-fns';
import { Link } from 'expo-router';
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";

const ChatRow = ({
  type,
  id,
  contactName,
  roomName,
  contactPhoto,
  lastMessageText,
  lastMessageTime,
  receiverId,
  isOnline,
  unreadCount = 0,
  isMuted = false,
  isPinned = false,
  typing = false,
  onPinChat,
  onMuteChat,
}) => {

  const title = type === "room" ? roomName : contactName;

  const avatar =
    contactPhoto ||
    `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(
      title || "Chat"
    )}`;

  const date = lastMessageTime ? new Date(lastMessageTime) : null;
  const formattedTime =
    date && !isNaN(date.getTime())
      ? isToday(date)
        ? format(date, "hh:mm a")
        : format(date, "MM.dd.yy")
      : "";

  // ✅ PREVIEW ICON LOGIC
  const renderPreview = () => {
    if (typing) return "typing…";

    if (!lastMessageText) return "";

    if (lastMessageText.startsWith("[Photo]")) return "📷 Photo";
    if (lastMessageText.startsWith("[Video]")) return "📹 Video";
    if (lastMessageText.startsWith("[Audio]")) return "🎤 Voice Message";
    if (lastMessageText.startsWith("[File]")) return "📎 File";

    return lastMessageText;
  };

  // ✅ Long Press Menu
  const onLongPress = () => {
    Alert.alert(
      "Options",
      title,
      [
        {
          text: isPinned ? "Unpin Chat" : "Pin Chat",
          onPress: () => onPinChat(id),
        },
        {
          text: isMuted ? "Unmute" : "Mute",
          onPress: () => onMuteChat(id),
        },
        {
          text: "Clear Chat",
          onPress: () => Alert.alert("Chat cleared"),
          style: "destructive",
        },
        {
          text: "Delete",
          onPress: () => Alert.alert("Chat deleted"),
          style: "destructive",
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const navLink = {
    pathname: "/(tabs)/chats/[id]",
    params: { id, isRoom: type === "room" ? "true" : "false", receiverId },
  };

  return (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
      <AppleStyleSwipeableRow
        onPin={() => onPinChat(id)}
        onMute={() => onMuteChat(id)}
      >
        <Link href={navLink} asChild>
          <TouchableOpacity style={styles.row} onLongPress={onLongPress}>

            {/* Avatar + online dot */}
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: avatar }} style={styles.avatar} />
              {isOnline && <View style={styles.onlineDot} />}
            </View>

            {/* Name + Preview */}
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={styles.title}>{title}</Text>

                {isPinned && (
                  <Ionicons
                    name="pin"
                    size={16}
                    color="#25D366"
                    style={{ marginLeft: 4, transform: [{ rotate: "45deg" }] }}
                  />
                )}
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.subtitle,
                  unreadCount > 0 && styles.subtitleBold,
                  typing && styles.typingText,
                ]}
              >
                {renderPreview()}
              </Text>
            </View>

            {/* Right side */}
            <View style={styles.rightColumn}>
              <Text
                style={[
                  styles.time,
                  unreadCount > 0 && styles.timeBold,
                ]}
              >
                {formattedTime}
              </Text>

              {isMuted && (
                <Ionicons name="volume-mute" size={18} color={Colors.gray} style={{ marginTop: 4 }} />
              )}

              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

          </TouchableOpacity>
        </Link>
      </AppleStyleSwipeableRow>
    </Animated.View>
  );
};

export default ChatRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    elevation: 2,
  },

  avatarWrapper: {
    width: 55,
    height: 55,
    marginRight: 15,
    position: "relative",
  },

  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
  },

  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#25D366",
    borderWidth: 2,
    borderColor: "#fff",
  },

  textContainer: { flex: 1 },

  titleRow: { flexDirection: "row", alignItems: "center" },

  title: { fontSize: 18, fontWeight: "600" },

  subtitle: { fontSize: 15, color: Colors.gray },

  subtitleBold: { color: "#000", fontWeight: "600" },

  typingText: { color: "#25D366", fontWeight: "700" },

  rightColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
    width: 70,
  },

  time: { fontSize: 12, color: Colors.gray },

  timeBold: { color: "#25D366", fontWeight: "700" },

  badge: {
    marginTop: 4,
    backgroundColor: "#25D366",
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 11,
  },

  badgeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
});
