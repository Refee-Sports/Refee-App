/**
 * The three-cell pitch — 48H payout / 0% ref fees / YOU set the rate.
 * Shared by the welcome hero and the signed-out brand panel so the two can't
 * drift apart.
 */
export function ValueStrip({ size = "compact" }: { size?: "compact" | "hero" }) {
  const hero = size === "hero";
  return (
    <div
      className={`flex border border-paper/20 ${hero ? "lg:max-w-lg" : "max-w-md"}`}
    >
      <ValueCell value="48" accent="H" label="Payout" bordered hero={hero} />
      <ValueCell value="0" accent="%" label="Ref fees" bordered hero={hero} />
      <ValueCell value="YOU" accent="." label="Set rate" hero={hero} />
    </div>
  );
}

function ValueCell({
  value,
  accent,
  label,
  bordered,
  hero,
}: {
  value: string;
  accent: string;
  label: string;
  bordered?: boolean;
  hero?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center py-3 ${hero ? "lg:py-5" : ""} ${
        bordered ? "border-r border-paper/20" : ""
      }`}
    >
      <span
        className={`font-display leading-none text-paper ${
          hero ? "text-[22px] lg:text-[30px]" : "text-[22px]"
        }`}
        style={{ letterSpacing: -1 }}
      >
        {value}
        <span className="text-hi-vis">{accent}</span>
      </span>
      <span
        className={`mt-1 font-mono-bold text-[8px] uppercase text-paper/50 ${
          hero ? "lg:mt-2 lg:text-[9px]" : ""
        }`}
        style={{ letterSpacing: 1.5 }}
      >
        {label}
      </span>
    </div>
  );
}
