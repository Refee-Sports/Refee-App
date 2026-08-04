import { useState } from "react";
import { Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Tap once for a single day, tap a later day to make a range.
 * Tapping before the current start restarts the selection.
 */
export function CalendarRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
}: {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  onChange: (start: string, end: string) => void;
  minDate?: Date;
}) {
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : today;
  const [viewYear, setViewYear] = useState(
    startDate ? parseInt(startDate.slice(0, 4), 10) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    startDate ? parseInt(startDate.slice(5, 7), 10) - 1 : today.getMonth()
  );

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const navMonth = (delta: number) => {
    Haptics.selectionAsync();
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleDayPress = (d: Date) => {
    if (d < min) return;
    Haptics.selectionAsync();
    const key = toKey(d);
    if (!startDate || (startDate && endDate && startDate !== endDate) || key < startDate) {
      // fresh selection (or restart)
      onChange(key, key);
    } else {
      // extend single day into a range
      onChange(startDate, key);
    }
  };

  return (
    <View className="border-[1.5px] border-ink bg-chalk">
      {/* Month nav */}
      <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-ink-20">
        <Pressable onPress={() => navMonth(-1)} className="w-8 h-8 items-center justify-center active:opacity-60">
          <Text className="text-ink font-mono-bold text-base">←</Text>
        </Pressable>
        <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 2 }}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={() => navMonth(1)} className="w-8 h-8 items-center justify-center active:opacity-60">
          <Text className="text-ink font-mono-bold text-base">→</Text>
        </Pressable>
      </View>

      {/* Weekday header */}
      <View className="flex-row px-2 pt-2">
        {WEEKDAYS.map((w, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text className="font-mono-bold text-[8px] text-ink-40" style={{ letterSpacing: 1 }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View className="px-2 pb-2">
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <View key={week} className="flex-row">
            {cells.slice(week * 7, week * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} className="flex-1 aspect-square" />;
              const key = toKey(d);
              const disabled = d < min;
              const isStart = key === startDate;
              const isEnd = key === endDate;
              const inRange =
                startDate && endDate && key > startDate && key < endDate;
              const selected = isStart || isEnd;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleDayPress(d)}
                  disabled={disabled}
                  className={`flex-1 aspect-square items-center justify-center m-0.5 ${
                    selected
                      ? "bg-signal"
                      : inRange
                        ? "bg-signal/20"
                        : "bg-transparent"
                  } ${selected ? "" : "active:bg-ink/10"}`}
                >
                  <Text
                    className={`font-mono text-[12px] ${
                      selected
                        ? "text-paper font-mono-bold"
                        : disabled
                          ? "text-ink-20"
                          : inRange
                            ? "text-signal font-mono-bold"
                            : "text-ink"
                    }`}
                  >
                    {d.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Selection summary */}
      <View className="border-t border-ink-20 px-3 py-2">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1.5 }}>
          {startDate
            ? startDate === endDate
              ? `SELECTED: ${startDate} (1 DAY)`
              : `SELECTED: ${startDate} → ${endDate}`
            : "TAP A DAY TO START · TAP A LATER DAY FOR A RANGE"}
        </Text>
      </View>
    </View>
  );
}
