import AppleStyleSwipeableRow from '@/components/AppleStyleSwipeableRow';
import Colors from '@/constants/Colors';
import { format, isToday } from 'date-fns';
import { Link } from 'expo-router';
import { FC } from 'react';
import { View, Text, Image, TouchableHighlight } from 'react-native';

export interface ChatRowProps {
  userId: string;
  type: 'oneToOne' | 'room';
  contactName?: string;
  roomName?: string;
  receiverId:string
  roomId: string;
  lastMessageText: string;
  lastMessageTime: string;
  contactPhoto?: string;
  unreadCount?: number;
}
const ChatRow: FC<ChatRowProps> = ({
  userId,
  receiverId,
  type,
  contactName,
  roomName,
  roomId,
  lastMessageText,
  lastMessageTime,
  contactPhoto,
}) => {
  console.log("front end room id",roomId);

  console.log("front end user id",userId);

  const isRoom = type?.toString() === 'room';
   
  const title = contactName || roomName || 'Unnamed Chat';
  const image = contactPhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(title);

  let formattedTime = '';
  try {
    
    const date = new Date(lastMessageTime);
    formattedTime = isToday(date) ? format(date, 'hh:mm a') : format(date, 'MM.dd.yy');
  } catch {
    formattedTime = '';
  }
 console.log('isroom1',isRoom);
  return (
    <AppleStyleSwipeableRow>
  
         
<Link
  href={{
    pathname: `/(tabs)/chats/${roomId ? roomId : receiverId}`,
    params: {
      isRoom: roomId ? 'true' : 'false',
      receiverId: receiverId,
    },
  }}
  asChild
>
  <TouchableHighlight activeOpacity={0.8} underlayColor={Colors.lightGray}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingVertical: 10 }}>
      <Image source={{ uri: image }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 14 }} />

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: 'bold' }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 16, color: Colors.gray }}>
          {lastMessageText?.length > 40 ? lastMessageText.substring(0, 40) + '...' : lastMessageText}
        </Text>
      </View>

      <Text style={{ color: Colors.gray, paddingRight: 20, alignSelf: 'flex-start' }}>
        {formattedTime}
      </Text>
    </View>
  </TouchableHighlight>
</Link>
    </AppleStyleSwipeableRow>
  );
};

export default ChatRow;