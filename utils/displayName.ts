// utils/displayName.ts
export const resolveDisplayName = (
  msgUser: any,
  currentUserId?: string,
  contactMap?: Record<string, string>
): string => {
  if (!msgUser) return "Contact";

  const id = msgUser.senderId;
  const name =  msgUser.senderName;
  const phone = msgUser.senderPhone;

  // If it's the current user
  if (id === currentUserId) return "You";

  // If name exists and isn't just an auto-generated ID
  if (name && !String(name).startsWith("user_")) return name;

  // If phone matches a contact
  const cleanedPhone = phone?.replace(/\D/g, "");
  if (cleanedPhone && contactMap && contactMap[cleanedPhone]) {
    return contactMap[cleanedPhone];
  }

  // Fallback
  return "Contact";
};

export default resolveDisplayName;