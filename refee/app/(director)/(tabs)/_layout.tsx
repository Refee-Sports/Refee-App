import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

export default function DirectorTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1F4FCC",
        tabBarInactiveTintColor: "rgba(8,17,28,0.36)",
        tabBarStyle: {
          backgroundColor: "#E5E1D6",
          borderTopWidth: 1,
          borderTopColor: "#08111C",
          paddingTop: 8,
          height: 84,
        },
        // Full labels (was truncating to "TOUR…"): render via tabBarLabel so
        // each label gets the full tab width instead of the icon's box.
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "JetBrainsMono_700Bold",
          fontSize: 8,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="tournaments"
        options={{
          tabBarLabel: "Tournaments",
          tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarLabel: "Messages",
          tabBarIcon: ({ color }) => <Feather name="message-square" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
