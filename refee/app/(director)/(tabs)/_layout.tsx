import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const TabIcon = ({ name, focused }: { name: any; focused: boolean }) => (
  <Feather name={name} size={20} color={focused ? "#1F4FCC" : "rgba(8,17,28,0.36)"} />
);

const TabLabel = ({ label, focused }: { label: string; focused: boolean }) => (
  <Text
    className={`font-mono-bold text-[8px] uppercase mt-0.5 ${
      focused ? "text-signal" : "text-ink-40"
    }`}
    style={{ letterSpacing: 1 }}
    numberOfLines={1}
  >
    {label}
  </Text>
);

export default function DirectorTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#E5E1D6",
          borderTopWidth: 1,
          borderTopColor: "#08111C",
          paddingTop: 8,
          height: 80,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="tournaments"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabIcon name="grid" focused={focused} />
              <TabLabel label="Tournaments" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabIcon name="message-square" focused={focused} />
              <TabLabel label="Messages" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabIcon name="user" focused={focused} />
              <TabLabel label="Profile" focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
