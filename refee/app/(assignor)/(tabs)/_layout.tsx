import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const tabOptions = {
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
  tabBarShowLabel: true,
  tabBarLabelStyle: {
    fontFamily: "JetBrainsMono_700Bold",
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
};

export default function AssignorTabsLayout() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="tournaments"
        options={{
          tabBarLabel: "Tournaments",
          tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          tabBarLabel: "Roster",
          tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} />,
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
