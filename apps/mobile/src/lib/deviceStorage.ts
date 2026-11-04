import * as SecureStore from "expo-secure-store";

/** Small per-device key/value storage. Native: Keychain/Keystore via expo-secure-store. */
export const deviceStorage = {
  get: (key: string): string | null => SecureStore.getItem(key),
  set: (key: string, value: string): void => SecureStore.setItem(key, value),
  remove: (key: string): void => {
    void SecureStore.deleteItemAsync(key);
  },
};
