import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

/**
 * DrawerLayout implements the root drawer navigation for the app.
 * This layout wraps the tab navigation and other screens accessible via the drawer menu.
 */
const DrawerLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          // 🎨 Match drawer style with TabLayout
          drawerStyle: {
            backgroundColor: "#25292e", // same as tabBar & header background
          },
          drawerLabelStyle: {
            color: "#ffffff", // white text
            //fontWeight: "bold",
          },
          headerStyle: {
            backgroundColor: "#25292e", // dark header
          },
          headerTintColor: "#ffffff", // white icons and title
          headerTitleStyle: {
            //fontWeight: "bold",
            color: "#ffffff",
          },
        }}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            drawerLabel: "Account",
            headerShown: false, // tabs handle their own header
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: "Profile",
            title: "Your Profile",
          }}
        />
        <Drawer.Screen
          name="about"
          options={{
            drawerLabel: "About",
            title: "About This App",
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
};

export default DrawerLayout;
