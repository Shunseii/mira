import { useEffect, useRef, useState } from "react";

/** How long a sheet shows the tapped option as picked before it starts closing. */
export const PICK_SETTLE_MS = 120;

/** Long enough for the sheet to finish closing, so the reopened sheet starts from the real selection. */
const SHEET_CLOSE_MS = 500;

/**
 * For a sheet that closes when you pick: the tapped option shows as picked at once, then the sheet closes, and only
 * then is the choice applied, so the highlight visibly moves before anything heavy re-renders behind the sheet.
 */
export const useSheetPick = <T,>({
  selected,
  onSelect,
  dismiss,
}: {
  selected: T;
  onSelect: (value: T) => void;
  dismiss: () => void;
}): [T, (value: T) => void] => {
  const [picked, setPicked] = useState<{ value: T }>();
  const settling = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pick = (value: T) => {
    if (settling.current) return;
    settling.current = true;
    setPicked({ value });
    timers.current = [
      setTimeout(() => {
        dismiss();
        requestAnimationFrame(() => onSelect(value));
      }, PICK_SETTLE_MS),
      setTimeout(() => {
        settling.current = false;
        setPicked(undefined);
      }, PICK_SETTLE_MS + SHEET_CLOSE_MS),
    ];
  };

  return [picked ? picked.value : selected, pick];
};
