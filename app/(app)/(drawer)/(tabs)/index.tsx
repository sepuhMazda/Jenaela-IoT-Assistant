import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Dimensions, StatusBar, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/context";
import { db } from "@/lib/firebase-config";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Types
type Device = {
  id: string;
  name?: string;
  state: boolean;
  type?: string;
  isRFID?: boolean;
  rfidCount?: number;
  lastAccess?: number;
  ip?: string;
};

type IconName = keyof typeof Ionicons.glyphMap;

// Constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40) / 2 - 6;
const DEVICE_CARD_WIDTH = 140;

const COLORS = {
  background: '#0f1117',
  cardBg: '#1a1d29',
  border: '#374151',
  primary: '#ffd33d',
  success: '#10b981',
  danger: '#ef4444',
  info: '#6366f1',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
};

const DEVICE_TYPE_ICONS: Record<string, IconName> = {
  light: "bulb",
  lock: "lock-closed",
  fan: "refresh",
  tv: "tv",
  ac: "snow",
  rfid: "card",
  rfid_relay: "key",
};

// Utility functions
const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Selamat pagi";
  if (hour < 18) return "Selamat siang";
  return "Selamat malam";
};

const getDeviceTypeIcon = (type: string): IconName => {
  return DEVICE_TYPE_ICONS[type] || "hardware-chip";
};

// Components
function StatCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: IconName;
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
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-white text-xl font-bold">{value}</Text>
      <Text className="text-gray-400 text-sm font-medium">{label}</Text>
    </View>
  );
}

function QuickActionCard({ icon, label, description, onPress, color }: {
  icon: IconName;
  label: string;
  description: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 active:bg-[#2a2d39]"
      style={{ width: CARD_WIDTH, minHeight: 100 }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mb-3 border"
        style={{ 
          backgroundColor: `${color}20`,
          borderColor: `${color}30`
        }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-white text-sm font-bold mb-1" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-gray-400 text-xs" numberOfLines={2}>
        {description}
      </Text>
    </Pressable>
  );
}

function DeviceCard({ device, onPress }: {
  device: Device;
  onPress: () => void;
}) {
  const isActive = device.state;
  
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <View
        className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 mr-3"
        style={{ width: DEVICE_CARD_WIDTH }}
      >
        <View className="items-center">
          <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${
            isActive ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-700/50 border border-gray-700'
          }`}>
            <Ionicons
              name={getDeviceTypeIcon(device.type || "other")}
              size={20}
              color={isActive ? COLORS.success : "#6b7280"}
            />
          </View>
          
          <Text className="text-white text-sm font-medium text-center" numberOfLines={2}>
            {device.name}
          </Text>
          
          {device.isRFID && device.rfidCount !== undefined && (
            <Text className="text-gray-400 text-xs mt-1">
              {device.rfidCount} kartu
            </Text>
          )}
          
          <View className={`mt-2 px-2 py-1 rounded-full ${
            isActive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Text className={`text-xs font-medium ${
              isActive ? 'text-green-400' : 'text-red-400'
            }`}>
              {device.isRFID 
                ? (isActive ? 'Terbuka' : 'Terkunci')
                : (isActive ? 'Aktif' : 'Nonaktif')
              }
            </Text>
          </View>
        </View>
        
        <View className="absolute bottom-2 right-2">
          <Ionicons name="chevron-forward-circle" size={16} color="#ffffff20" />
        </View>
      </View>
    </Pressable>
  );
}

// Main Component
export default function HomeScreen() {
  const { signOut, user } = useSession();
  const [devices, setDevices] = useState<Device[]>([]);
  const insets = useSafeAreaInsets();

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";
  const greeting = getTimeGreeting();
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Firebase listeners
  useEffect(() => {
    if (!user) return;

    const devicesRef = ref(db, `users/${user.uid}/devices`);
    const authorizedRFIDsRef = ref(db, `authorizedRFIDs`);
    const deviceStatesRef = ref(db, `deviceStates`);

    let regularDevices: Device[] = [];
    let rfidDevices: Device[] = [];

    const updateDevicesList = () => {
      const allDevices = [...regularDevices];
      rfidDevices.forEach(rfidDevice => {
        if (!allDevices.find(d => d.id === rfidDevice.id)) {
          allDevices.push(rfidDevice);
        }
      });
      setDevices(allDevices);
    };

    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        regularDevices = Object.entries(data).map(([key, value]) => {
          const deviceValue = value as any;
          return {
            id: key,
            name: deviceValue.name || `Perangkat ${key.substring(0, 4)}`,
            state: deviceValue.state ?? false,
            type: deviceValue.type || "other",
            isRFID: deviceValue.type === "rfid_relay",
            ip: deviceValue.ip,
          };
        });
      } else {
        regularDevices = [];
      }
      updateDevicesList();
    });

    const unsubscribeRFIDs = onValue(authorizedRFIDsRef, (snapshot) => {
      const rfidData = snapshot.val();
      if (rfidData) {
        rfidDevices = Object.entries(rfidData).map(([deviceId, rfidCards]) => {
          const rfidCardsObj = rfidCards as Record<string, boolean>;
          const authorizedCount = Object.values(rfidCardsObj).filter(Boolean).length;
          
          return {
            id: deviceId,
            name: `RFID ${deviceId.substring(0, 6)}`,
            state: false, // Default to locked, will be updated by device states
            type: "rfid_relay",
            isRFID: true,
            rfidCount: authorizedCount,
          };
        });
      } else {
        rfidDevices = [];
      }
      updateDevicesList();
    });

    const unsubscribeStates = onValue(deviceStatesRef, (snapshot) => {
      const statesData = snapshot.val();
      if (statesData) {
        // Update regular devices with their lock states
        regularDevices = regularDevices.map(device => {
          if (device.type === "rfid_relay" || device.type === "lock") {
            const deviceState = statesData[device.id];
            if (deviceState) {
              return {
                ...device,
                state: !deviceState.isLocked, // Device is "on" if not locked
                lastAccess: deviceState.timestamp,
              };
            }
          }
          return device;
        });

        // Update RFID devices with their current states
        rfidDevices = rfidDevices.map(device => {
          const deviceState = statesData[device.id];
          if (deviceState) {
            return {
              ...device,
              state: !deviceState.isLocked, // Device is "on" if not locked
              lastAccess: deviceState.timestamp,
            };
          }
          return device;
        });
      }
      updateDevicesList();
    });

    return () => {
      unsubscribeDevices();
      unsubscribeRFIDs();
      unsubscribeStates();
    };
  }, [user]);

  // Computed values
  const stats = {
    total: devices.length,
    onCount: devices.filter(d => d.state).length,
    offCount: devices.length - devices.filter(d => d.state).length,
  };

  const rfidDevices = devices
    .filter(d => d.type === "rfid_relay" || d.type === "lock" || d.isRFID)
    .slice(0, 3);

  // Handlers
  const handleLogout = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  const handleDevicePress = (device: Device) => {
    if (device.type === "rfid_relay" || device.type === "lock" || device.isRFID) {
      router.push({
        pathname: "/rfidManager",
        params: {
          deviceUid: device.id,
          deviceName: device.name || `Device ${device.id.substring(0, 6)}`,
        },
      });
    } else {
      router.push("/manual");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View className="px-6 pt-6 pb-5">
          <View className="bg-[#1a1d29] rounded-2xl p-6 border border-gray-800">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-yellow-400 text-sm font-medium mb-1">{greeting} 👋</Text>
                <Text className="text-white text-2xl font-bold">{displayName}</Text>
                <Text className="text-gray-400 text-sm mt-1">{user?.email}</Text>
              </View>
              <View className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                <Text className="text-green-400 text-xs font-semibold">ONLINE</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-6">
          {/* Statistics Card */}
          <View className="bg-[#1a1d29] rounded-2xl p-6 mb-6 border border-gray-800">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">Statistik Perangkat</Text>
              <Text className="text-gray-400 text-sm">{currentTime}</Text>
            </View>

            <View className="flex-row justify-between">
              <StatCard label="Total" value={stats.total} icon="layers" color={COLORS.info} />
              <StatCard label="Terbuka" value={stats.onCount} icon="flash" color={COLORS.success} />
              <StatCard label="Tertutup" value={stats.offCount} icon="power" color={COLORS.danger} />
            </View>
          </View>

          {/* RFID Devices */}
          {rfidDevices.length > 0 && (
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white text-lg font-bold">Perangkat RFID/Lock</Text>
                <Pressable onPress={() => router.push("/manual")}>
                  <Text className="text-yellow-400 text-sm font-medium">Lihat Semua →</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {rfidDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onPress={() => handleDevicePress(device)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick Actions */}
          <View className="mb-6">
            <Text className="text-white text-lg font-bold mb-4">Aksi Cepat</Text>
            <View className="flex-row flex-wrap justify-center gap-3 -mr-1">
              <QuickActionCard
                icon="toggle"
                label="Perangkat Switch"
                description="Kelola perangkat baru"
                onPress={() => router.push("/manual")}
                color={COLORS.info}
              />
              <QuickActionCard
                icon="card"
                label="Perangkat RFID"
                description="Lihat aktivitas"
                onPress={() => router.push("/rfidManager")}
                color={COLORS.success}
              />
              <QuickActionCard
                icon="settings"
                label="Pengaturan"
                description="Kelola aplikasi"
                onPress={() => router.push("/explore")}
                color={COLORS.warning}
              />
              <QuickActionCard
                icon="analytics"
                label="Analitik"
                description="Lihat statistik"
                onPress={() => router.push("/explore")}
                color={COLORS.purple}
              />
            </View>
          </View>

          {/* System Status */}
          <View className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-3 h-3 bg-green-400 rounded-full mr-3" />
                <View>
                  <Text className="text-white text-sm font-medium">Status Sistem</Text>
                  <Text className="text-gray-400 text-xs">Semua layanan normal</Text>
                </View>
              </View>
              <Pressable
                onPress={handleLogout}
                className="bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-lg"
              >
                <Text className="text-red-400 font-medium text-sm">Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}