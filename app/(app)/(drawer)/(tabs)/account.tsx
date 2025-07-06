import React from "react";
import { View, Text, Pressable, ScrollView, Image, StatusBar, Dimensions } from "react-native";
import { useSession } from "@/context";
import { router } from "expo-router";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get('window');

export default function AccountScreen() {
  const { user, signOut } = useSession();

  if (!user) return null;

  const {
    displayName,
    email,
    photoURL,
    uid,
    metadata,
    providerData,
  } = user;

  const creationTime = metadata?.creationTime
    ? format(new Date(metadata.creationTime), "dd MMMM yyyy, HH:mm")
    : "Unknown";

  const lastLogin = metadata?.lastSignInTime
    ? format(new Date(metadata.lastSignInTime), "dd MMMM yyyy, HH:mm")
    : "Unknown";

  const provider = providerData?.[0]?.providerId || "Unknown";

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case "google.com": return "logo-google";
      case "facebook.com": return "logo-facebook";
      case "apple.com": return "logo-apple";
      case "password": return "mail";
      default: return "person";
    }
  };

  const getProviderName = (providerId: string) => {
    switch (providerId) {
      case "google.com": return "Google";
      case "facebook.com": return "Facebook";
      case "apple.com": return "Apple";
      case "password": return "Email & Password";
      default: return "Unknown";
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  const accountAge = metadata?.creationTime 
    ? Math.floor((Date.now() - new Date(metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f1117" />
      <ScrollView className="flex-1 bg-[#0f1117]" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="bg-[#1a1d29] px-6 pt-16 pb-8 border-b border-gray-800">
          <View className="items-center">
            {/* Avatar Section */}
            <View className="items-center mb-6">
              {photoURL ? (
                <View className="relative">
                  <Image
                    source={{ uri: photoURL }}
                    className="w-24 h-24 rounded-full border-4 border-gray-700"
                    style={{ width: 96, height: 96 }}
                  />
                  <View className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-2 border-[#1a1d29]"></View>
                </View>
              ) : (
                <View className="w-24 h-24 rounded-full bg-yellow-400/20 border-4 border-yellow-400/30 items-center justify-center">
                  <Ionicons name="person" size={40} color="#fbbf24" />
                  <View className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-2 border-[#1a1d29]"></View>
                </View>
              )}
            </View>

            <Text className="text-white text-2xl font-bold text-center">
              {displayName || "Pengguna"}
            </Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">{email}</Text>
            
            {/* Online Status */}
            <View className="mt-3 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
              <Text className="text-green-400 text-xs font-semibold">● ONLINE</Text>
            </View>
          </View>
        </View>

        <View className="px-6 pt-6">
          {/* Account Stats */}
          <View className="bg-[#1a1d29] rounded-2xl p-6 mb-6 border border-gray-800">
            <Text className="text-white text-lg font-bold mb-4">Statistik Akun</Text>
            <View className="flex-row justify-between">
              <StatItem
                icon="calendar"
                label="Hari Bergabung"
                value={accountAge.toString()}
                color="#6366f1"
              />
              <StatItem
                icon="shield-checkmark"
                label="Status"
                value="Aktif"
                color="#10b981"
              />
              <StatItem
                icon={getProviderIcon(provider)}
                label="Provider"
                value={getProviderName(provider)}
                color="#f59e0b"
              />
            </View>
          </View>

          {/* Account Information */}
          <View className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-6 mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="information-circle" size={20} color="#fbbf24" />
              <Text className="text-white text-lg font-bold ml-2">Informasi Akun</Text>
            </View>
            
            <InfoCard
              icon="person"
              label="Nama Lengkap"
              value={displayName || "Tidak diatur"}
              color="#3b82f6"
            />
            <InfoCard
              icon="mail"
              label="Email"
              value={email || "Tidak tersedia"}
              color="#10b981"
            />
            <InfoCard
              icon="key"
              label="User ID"
              value={uid.substring(0, 16) + "..."}
              color="#8b5cf6"
            />
          </View>

          {/* Activity Information */}
          <View className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-6 mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="time" size={20} color="#fbbf24" />
              <Text className="text-white text-lg font-bold ml-2">Aktivitas</Text>
            </View>
            
            <InfoCard
              icon="calendar-outline"
              label="Bergabung Sejak"
              value={creationTime}
              color="#f59e0b"
            />
            <InfoCard
              icon="log-in"
              label="Login Terakhir"
              value={lastLogin}
              color="#ef4444"
              isLast={true}
            />
          </View>

          {/* Quick Actions */}
          <View className="mb-6">
            <Text className="text-white text-lg font-bold mb-4">Aksi Akun</Text>
            <View className="flex-row flex-wrap justify-center gap-3 -mr-1 ">
              <ActionCard
                icon="settings"
                label="Pengaturan"
                description="Kelola preferensi"
                onPress={() => router.push("/explore")}
                color="#6366f1"
              />
              <ActionCard
                icon="shield"
                label="Keamanan"
                description="Ubah password"
                onPress={() => {}}
                color="#10b981"
              />
            </View>
          </View>

          {/* Logout Section */}
          <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="log-out" size={20} color="#ef4444" />
                  <Text className="text-red-400 text-lg font-bold ml-2">Keluar Akun</Text>
                </View>
                <Text className="text-red-300 text-sm">
                  Anda akan keluar dari semua perangkat
                </Text>
              </View>
              <Pressable
                onPress={handleLogout}
                className="bg-red-500/20 active:bg-red-500/30 border border-red-500/30 px-6 py-3 rounded-xl ml-4"
              >
                <Text className="text-red-400 font-semibold text-sm">Logout</Text>
              </Pressable>
            </View>
          </View>

          {/* App Version Info */}
          <View className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                <Text className="text-gray-400 text-sm ml-2">App Version</Text>
              </View>
              <Text className="text-gray-400 text-sm font-mono">v1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="items-center flex-1">
      <View
        className="w-12 h-12 rounded-2xl items-center justify-center mb-3 border"
        style={{ 
          backgroundColor: `${color}20`,
          borderColor: `${color}30`
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text className="text-white text-base font-bold text-center" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-gray-400 text-xs font-medium text-center">{label}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  label,
  value,
  color,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row items-center ${!isLast ? 'mb-4 pb-4 border-b border-gray-800' : ''}`}>
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-4 border"
        style={{ 
          backgroundColor: `${color}20`,
          borderColor: `${color}30`
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-gray-400 text-sm font-medium">{label}</Text>
        <Text className="text-white text-base font-semibold" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  description,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  color: string;
}) {
  const cardWidth = (width - 40) / 2 - 6;
  
  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 active:bg-[#2a2d39]"
      style={{ width: cardWidth, minHeight: 80 }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mb-3 border"
        style={{ 
          backgroundColor: `${color}20`,
          borderColor: `${color}30`
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-white text-sm font-bold mb-1">{label}</Text>
      <Text className="text-gray-400 text-xs" numberOfLines={2}>
        {description}
      </Text>
    </Pressable>
  );
}