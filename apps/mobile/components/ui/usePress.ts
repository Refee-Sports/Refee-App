import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";
import { motion } from "@refee/design";

/** Follows the OS Reduce Motion setting. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/**
 * The design system's press: snaps to `to` instantly on touch-down and eases
 * back over 120ms on release. No movement under Reduce Motion.
 */
export function usePressScale(to: number) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();
  return {
    scale,
    pressIn: () => {
      if (!reduce) scale.setValue(to);
    },
    pressOut: () => {
      Animated.timing(scale, { toValue: 1, duration: reduce ? 0 : motion.pressOutMs, useNativeDriver: true }).start();
    },
  };
}
