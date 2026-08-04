import { View } from "react-native";

type Props = {
  variant?: "ink" | "signal" | "hi-vis";
  thin?: boolean;
  noMargin?: boolean;
};

/**
 * Zebra-stripe rule. Used as section divider and signature pattern.
 * Implemented with overlapping bordered views since RN doesn't have
 * background-image: repeating-linear-gradient.
 */
export function ZebraRule({ variant = "ink", thin = false, noMargin = false }: Props) {
  const stripeColor =
    variant === "signal" ? "#1F4FCC" : variant === "hi-vis" ? "#C9F031" : "#08111C";
  const height = thin ? 4 : 12;
  const stripeWidth = 12;

  // Render ~32 stripes — enough to fill any reasonable container
  const stripes = Array.from({ length: 32 });

  return (
    <View
      className={`flex-row overflow-hidden w-full ${noMargin ? "" : "my-3"}`}
      style={{ height }}
    >
      {stripes.map((_, i) => (
        <View
          key={i}
          style={{
            width: stripeWidth,
            height,
            backgroundColor: i % 2 === 0 ? stripeColor : "transparent",
          }}
        />
      ))}
    </View>
  );
}
