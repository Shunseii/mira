import { useState } from "react";

/**
 * A picker's value that shows the pick at once and hands it on a frame later, so the tap paints
 * before whatever reacts to the change re-renders (re-sorting the whole list takes a while).
 */
export const useInstantChoice = <T,>({ value, onChange }: { value: T; onChange: (value: T) => void }): [T, (value: T) => void] => {
  const [pending, setPending] = useState<{ value: T }>();
  const choose = (next: T) => {
    setPending({ value: next });
    requestAnimationFrame(() =>
      setTimeout(() => {
        onChange(next);
        setPending(undefined);
      }, 0),
    );
  };
  return [pending ? pending.value : value, choose];
};
