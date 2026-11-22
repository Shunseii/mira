/** Items added on Add item since the list last showed, oldest first, for the list to scroll to when it's back. */
let added: string[] = [];

export const noteAddedItem = (itemId: string): void => {
  added = [...added, itemId];
};

/** The items added since the last call, and forgets them: the list scrolls once per visit to Add item. */
export const takeAddedItems = (): string[] => {
  const taken = added;
  added = [];
  return taken;
};
