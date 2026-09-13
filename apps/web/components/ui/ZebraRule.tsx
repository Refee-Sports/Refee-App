type Props = {
  variant?: "ink" | "signal" | "hi-vis";
  thin?: boolean;
  noMargin?: boolean;
};

/** Port of the app's ZebraRule — the signature divider. */
export function ZebraRule({ variant = "ink", thin = false, noMargin = false }: Props) {
  const stripe =
    variant === "signal" ? "#1F4FCC" : variant === "hi-vis" ? "#C9F031" : "#08111C";
  const height = thin ? 4 : 12;
  return (
    <div
      className={`w-full ${noMargin ? "" : "my-3"}`}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(90deg, ${stripe} 0, ${stripe} 12px, transparent 12px, transparent 24px)`,
      }}
    />
  );
}
