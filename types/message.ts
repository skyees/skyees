// types/message.ts
export type ReactionEmoji = "❤️" | "👍" | "😂" | "😮" | "😢" | "🙏";

export type MessageReaction = {
  userId: string;
  emoji: ReactionEmoji;
  reactedAt: string; // ISO timestamp
};

export interface IMessage {
  _id: string;
  text?: string;
  user: { _id: string };
  createdAt: Date | string;
  replyTo?: { _id: string; text?: string; senderId?: string } | null;
  image?: string;
  audio?: string;
  video?: string;
  edited?: boolean;
  reactions?: MessageReaction[]; // ✅ new
}

