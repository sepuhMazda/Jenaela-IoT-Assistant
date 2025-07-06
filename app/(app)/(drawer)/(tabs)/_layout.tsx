import { Tabs } from "expo-router";
import React from "react";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { DrawerNavigationProp } from "@react-navigation/drawer";

import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  // Create reusable header left component
  const HeaderLeft = () => (
    <Pressable
      onPress={() => navigation.openDrawer()}
      style={{ marginLeft: 16 }}
    >
      <Ionicons name="menu" size={24} color="white" />
    </Pressable>
  );

  return (
<Tabs
  screenOptions={{
    tabBarActiveTintColor: '#ffd33d',
    headerStyle: {
      backgroundColor: '#1a1d29',
    },
    headerShadowVisible: false,
    headerTintColor: '#fff',
    tabBarStyle: {
      backgroundColor: '#1a1d29',
    },
  }}
>

      <Tabs.Screen
        name="index"
        options={{
          // Disable header for custom animated header
          headerShown: false,
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "home" : "home-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          href: null,
          headerShown: true,
          headerLeft: HeaderLeft,
          title: "Manual",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "toggle" : "toggle-outline"}
              color={color}
            />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="rfidManager"
        options={{
          href: null,
          headerShown: false,
          headerLeft: HeaderLeft,
          title: "RFID",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "card" : "card-outline"}
              color={color}
            />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          headerShown: true,
          headerLeft: HeaderLeft,
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "person" : "person-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}