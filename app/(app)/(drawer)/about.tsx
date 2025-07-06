import { View, Text } from "react-native";
import React from "react";

export default function AboutScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-white px-4">
      <Text className="text-2xl font-bold mb-2">About This App</Text>
      <Text className="text-base text-gray-600 text-center">
        This smart home app was built using Expo Router, Firebase, and React Native.
        It lets you manage devices, track logs, and more!
      </Text>
    </View>
  );
}
