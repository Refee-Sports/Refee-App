import { useState } from "react";
import { Text, View, Pressable, Modal, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export type DropdownOption = { value: string; label: string };

export function DropdownSelect({
  value,
  options,
  placeholder,
  onSelect,
}: {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen(true);
        }}
        className="border-[1.5px] border-ink bg-chalk px-4 py-3.5 flex-row items-center justify-between active:opacity-70"
      >
        <Text
          className={`font-mono text-[14px] ${selected ? "text-ink" : "text-ink-40"}`}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color="rgba(8,17,28,0.56)" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(8,17,28,0.5)" }}
          onPress={() => setOpen(false)}
        >
          <Pressable className="bg-paper border-t-2 border-ink" style={{ maxHeight: "60%" }}>
            <View className="px-5 py-3 border-b border-ink-20 flex-row items-center justify-between">
              <Text
                className="font-mono-bold text-[10px] text-ink-60 uppercase"
                style={{ letterSpacing: 2 }}
              >
                {placeholder}
              </Text>
              <Pressable onPress={() => setOpen(false)} className="p-1 active:opacity-70">
                <Text className="text-ink font-mono-bold">✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(item.value);
                      setOpen(false);
                    }}
                    className={`px-5 py-3.5 flex-row items-center justify-between border-b border-ink-20 active:opacity-70 ${
                      isSelected ? "bg-signal/10" : ""
                    }`}
                  >
                    <Text
                      className={`font-mono text-[14px] ${
                        isSelected ? "text-signal font-mono-bold" : "text-ink"
                      }`}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Text className="text-signal font-mono-bold">✓</Text>}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
