import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { IMessage } from 'react-native-gifted-chat';

interface EditingMessageBarProps {
  message: IMessage;
  clearEditing: () => void;
}

const EditingMessageBar: React.FC<EditMessageBarProps> = ({ message, clearEditing }) => {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="create-outline" size={20} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Editing Message</Text>
        <Text style={styles.text} numberOfLines={1}>
          {message.text}
        </Text>
      </View>
      <TouchableOpacity onPress={clearEditing}>
        <Ionicons name="close-circle-outline" size={24} color={Colors.gray} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#E5E5E5',
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  iconContainer: {
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  text: {
    color: Colors.gray,
    fontSize: 12,
  },
});

export default EditingMessageBar;