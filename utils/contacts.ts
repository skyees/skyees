// utils/contacts.ts
import * as Contacts from "expo-contacts";

export const loadContacts = async () => {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  return data;
};

export const buildContactMap = (contacts: Contacts.Contact[]) => {
  const map: Record<string, string> = {};
  contacts.forEach((contact) => {
    contact.phoneNumbers?.forEach((num) => {
      const cleaned = num.number.replace(/\D/g, "");
      map[cleaned] = contact.name;
    });
  });
  return map;
};

export default { loadContacts, buildContactMap } 
