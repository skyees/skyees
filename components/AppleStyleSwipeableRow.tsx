import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

const AppleStyleSwipeableRow = ({ children, onPin, onMute }) => {
  const renderRightActions = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity style={[styles.action, styles.pin]} onPress={onPin}>
        <Ionicons name="pin" size={22} color="#fff" />
        <Text style={styles.actionText}>Pin</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.action, styles.mute]} onPress={onMute}>
        <Ionicons name="volume-mute" size={22} color="#fff" />
        <Text style={styles.actionText}>Mute</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      {children}
    </Swipeable>
  );
};

export default AppleStyleSwipeableRow;

const styles = StyleSheet.create({
  actionsContainer: {
    width: 160,
    flexDirection: "row",
  },
  action: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pin: { backgroundColor: "#25D366" },
  mute: { backgroundColor: "#888" },
  actionText: { color: "#fff", marginTop: 4, fontWeight: "600" },
});
