// app/(app)/(drawer)/rfidManager.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  get,
} from "firebase/database";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useSession } from "@/context";

// Type definitions
interface AccessLog {
  uid: string;
  granted: boolean;
  timestamp: number;
}

interface SavedDevice {
  id: string;
  name: string;
  type: string;
  ip?: string;
  discoveredAt?: number;
}

interface DeviceState {
  isLocked: boolean;
  lastCommand: string;
  timestamp: number;
  triggeredBy?: string;
}

export default function RfidManagerScreen() {
  const navigation = useNavigation();
  const { user } = useSession();
  const { deviceUid, deviceName } = useLocalSearchParams<{
    deviceUid: string;
    deviceName: string;
  }>();

  // State variables
  const [actualDeviceUid, setActualDeviceUid] = useState<string>(deviceUid || "");
  const [deviceIP, setDeviceIP] = useState<string>("192.168.137.17");
  const [status, setStatus] = useState("🔧 Siap terhubung ke ESP32");
  const [registeredUIDs, setRegisteredUIDs] = useState<string[]>([]);
  const [newRFIDs, setNewRFIDs] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [manualUID, setManualUID] = useState("");
  const [managementMode, setManagementMode] = useState(false);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  
  // Connection status states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Saved devices states
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);
  const [showSavedDevicesModal, setShowSavedDevicesModal] = useState(false);
  const [isLoadingSavedDevices, setIsLoadingSavedDevices] = useState(false);
  
  // Device state management
  const [deviceState, setDeviceState] = useState<DeviceState>({
    isLocked: true,
    lastCommand: "init",
    timestamp: Date.now(),
    triggeredBy: undefined
  });
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  
  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRFIDModal, setShowRFIDModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanController, setScanController] = useState<AbortController | null>(null);

  // Component mounted ref
  const isMounted = useRef(true);

  const db = getDatabase();
  const uidPath = `/authorizedRFIDs/${actualDeviceUid}`;
  const pinPath = `/users/${user?.uid}/devices/${actualDeviceUid}/backupPin`;
  const logsPath = `/accessLogs/${actualDeviceUid}`;
  const deviceStatePath = `/deviceStates/${actualDeviceUid}`;
  const deviceMetaPath = `/deviceMeta/${actualDeviceUid}`;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Helper function for timeouts
  const createTimeoutPromise = (ms: number) => {
    return new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
  };

  // Helper function to validate IP address
  const isValidIP = (ip: string): boolean => {
    const pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return pattern.test(ip);
  };

  // Setup connection monitoring
  useEffect(() => {
    // Check LAN connection health
    const checkLANConnection = async () => {
      if (!deviceIP.trim() || !actualDeviceUid) {
        setConnectionStatus('disconnected');
        return;
      }

      try {
        const fetchPromise = fetch(`http://${deviceIP}/discover`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        const response = await Promise.race([fetchPromise, createTimeoutPromise(2000)]);

        if (response.ok) {
          const data = await response.json();
          // Verify it's the correct device and type
          if (data.uid === actualDeviceUid && data.type === "rfid_relay") {
            if (isMounted.current) {
              setConnectionStatus('connected');
              setLastPingTime(new Date());
            }
          } else {
            if (isMounted.current) {
              setConnectionStatus('disconnected');
            }
          }
        } else {
          if (isMounted.current) {
            setConnectionStatus('disconnected');
          }
        }
      } catch (error) {
        if (isMounted.current) {
          setConnectionStatus('disconnected');
        }
      }
    };

    if (actualDeviceUid) {
      if (deviceIP.trim()) {
        // LAN mode - monitor connection
        checkLANConnection();
        
        connectionCheckInterval.current = setInterval(() => {
          checkLANConnection();
        }, 5000);
      } else {
        // WAN mode - no IP means remote control
        setConnectionStatus('disconnected');
      }
    } else {
      setConnectionStatus('disconnected');
    }

    // Cleanup function
    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        connectionCheckInterval.current = null;
      }
    };
  }, [deviceIP, actualDeviceUid]);

  // Check if current user can control the device
  const canControlDevice = () => {
    const currentUser = user?.uid;
    const currentController = deviceState.triggeredBy;
    
    // Can control if: no one has claimed it OR you are the current controller
    return !currentController || currentController === currentUser;
  };

  // Check if current user is the controller (for showing release button)
  const isDeviceController = () => {
    const currentUser = user?.uid;
    const currentController = deviceState.triggeredBy;
    
    return currentController === currentUser;
  };

  // Load saved lock devices
  useEffect(() => {
    if (!user?.uid) return;
    
    const userDevicesRef = ref(db, `users/${user.uid}/devices`);
    const unsubscribe = onValue(userDevicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Filter only lock/RFID devices
        const lockDevices = Object.entries(data)
          .filter(([_, device]: [string, any]) => 
            device.type === "lock" || device.type === "rfid_relay"
          )
          .map(([id, device]: [string, any]) => ({
            id,
            ...device
          }));
        if (isMounted.current) {
          setSavedDevices(lockDevices);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Firebase listeners
  useEffect(() => {
    if (!actualDeviceUid) return;

    const uidListener = onValue(ref(db, uidPath), (snap) => {
      const data = snap.val();
      if (isMounted.current) {
        setRegisteredUIDs(data ? Object.keys(data) : []);
      }
    });

    const logsListener = onValue(ref(db, logsPath), (snap) => {
      const data = snap.val();
      if (data && isMounted.current) {
        const logs = Object.values(data).sort((a: any, b: any) => b.timestamp - a.timestamp);
        setAccessLogs(logs.slice(0, 10) as AccessLog[]);
      }
    });

    // Device state listener
    const stateListener = onValue(ref(db, deviceStatePath), (snap) => {
      const data = snap.val();
      if (data && isMounted.current) {
        setDeviceState({
          isLocked: data.isLocked ?? true,
          lastCommand: data.lastCommand ?? "init",
          timestamp: data.timestamp ?? Date.now(),
          triggeredBy: data.triggeredBy
        });
      }
    });

    return () => {
      uidListener();
      logsListener();
      stateListener();
    };
  }, [actualDeviceUid]);

  // Initialize device from navigation params
  useEffect(() => {
    if (deviceUid && !actualDeviceUid) {
      setActualDeviceUid(deviceUid);
      // If we have a saved device with IP, try to connect
      if (savedDevices.length > 0) {
        const device = savedDevices.find(d => d.id === deviceUid);
        if (device?.ip) {
          setDeviceIP(device.ip);
        }
      }
    }
  }, [deviceUid, savedDevices]);

  // Management mode polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (managementMode && deviceIP.trim() && actualDeviceUid && connectionStatus === 'connected') {
      interval = setInterval(fetchNewRFIDs, 2000);
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [managementMode, deviceIP, actualDeviceUid, connectionStatus]);

  // Connect to a saved device - Always discover by UID
  const connectToSavedDevice = async (device: SavedDevice) => {
    setIsLoadingSavedDevices(true);
    
    try {
      // Set the device UID and close modal first
      setActualDeviceUid(device.id);
      setShowSavedDevicesModal(false);
      
      // Set initial status
      if (isMounted.current) {
        setStatus(`🔍 Mencari ${device.name} di jaringan...`);
      }
      
      // Give UI time to update before starting scan
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Start scanning for the device
      await scanForSpecificDevice(device.id, device.name);
      
    } catch (error) {
      Alert.alert("❌ Error", "Gagal memulai pencarian perangkat");
      // Reset if error
      if (isMounted.current) {
        setActualDeviceUid("");
        setStatus("🔧 Siap terhubung ke ESP32");
      }
    } finally {
      if (isMounted.current) {
        setIsLoadingSavedDevices(false);
      }
    }
  };

  // Device connection check
  const checkDeviceConnection = async () => {
    if (!deviceIP.trim()) {
      setStatus("❌ Masukkan IP address ESP32");
      return;
    }

    if (!isValidIP(deviceIP)) {
      setStatus("❌ Masukkan IP address yang valid");
      return;
    }

    setStatus("🔍 Testing koneksi...");
    setConnectionStatus('checking');
    
    try {
      const fetchPromise = fetch(`http://${deviceIP}/discover`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      const response = await Promise.race([fetchPromise, createTimeoutPromise(5000)]);

      if (response.ok) {
        const data = await response.json();
        
        if (data.uid && isMounted.current) {
          setActualDeviceUid(data.uid);
        }
        
        if (data.type === "rfid_relay") {
          if (isMounted.current) {
            setStatus(`✅ Terhubung ke SmartLock`);
            setConnectionStatus('connected');
          }
        } else {
          if (isMounted.current) {
            setStatus(`❌ Bukan perangkat SmartLock`);
            setConnectionStatus('disconnected');
          }
        }
      } else {
        if (isMounted.current) {
          setStatus(`❌ HTTP Error: ${response.status}`);
          setConnectionStatus('disconnected');
        }
      }
    } catch (error: any) {
      if (isMounted.current) {
        if (error.message === 'Timeout') {
          setStatus("❌ Timeout - Periksa koneksi WiFi");
        } else {
          setStatus("❌ Network error");
        }
        setConnectionStatus('disconnected');
      }
    }
  };

  // Scan for a specific device by UID
  const scanForSpecificDevice = async (targetUid: string, deviceName?: string) => {
    // Use functional update to handle race conditions
    setIsScanning(prevScanning => {
      if (prevScanning) {
        return prevScanning;
      }
      
      const controller = new AbortController();
      setScanController(controller);
      
      // Start the actual scanning process
      performDeviceScan(targetUid, deviceName, controller);
      
      return true;
    });
  };

  const performDeviceScan = async (targetUid: string, deviceName: string | undefined, controller: AbortController) => {
    // Try common IPs first based on saved devices
    const savedIPs = savedDevices
      .filter(d => d.ip)
      .map(d => d.ip!);
    
    const networkRanges = ['192.168.137', '192.168.1'];
    // Prioritize 185 since it's where your device is
    const priorityIPs = [185, 17, 1, 100, 101, 102, 103, 104, 105, 142, 163, 254];
    const extendedRange = Array.from({ length: 254 }, (_, i) => i + 1)
      .filter(ip => !priorityIPs.includes(ip));

    const allLastOctets = [...priorityIPs, ...extendedRange];
    const standardIPs = networkRanges.flatMap(baseIP => 
      allLastOctets.map(lastOctet => `${baseIP}.${lastOctet}`)
    );
    
    // Put saved IPs first for faster discovery
    const ipSet = new Set(savedIPs);
    standardIPs.forEach(ip => ipSet.add(ip));
    const allIPs = Array.from(ipSet);

    const totalIPs = allIPs.length;
    setScanProgress({ current: 0, total: totalIPs });
    if (isMounted.current) {
      setStatus(`🔍 Mencari ${deviceName || targetUid.substring(0, 8)}...`);
    }

    try {
      const batchSize = 5; // Reduced for better reliability
      let completedIPs = 0;
      let found = false;
      let deviceFound = null;

      // Add small delay between batches to avoid overwhelming the network
      for (let i = 0; i < allIPs.length && !found && !controller.signal.aborted; i += batchSize) {
        const batch = allIPs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (testIP) => {
          if (controller.signal.aborted) return null;
          
          try {
            // Create a dedicated timeout for each request
            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 2500); // Increased timeout
            
            const response = await fetch(`http://${testIP}/discover`, {
              method: 'GET',
              headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              signal: fetchController.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              console.log(`Device found at ${testIP}:`, data);
              
              if (data.uid === targetUid && data.type === "rfid_relay") {
                return { ip: testIP, data };
              }
            }
            return null;
          } catch (error) {
            // Don't log timeout errors
            if (error.name !== 'AbortError') {
              console.error(`Error scanning ${testIP}:`, error);
            }
            return null;
          } finally {
            completedIPs++;
            if (isMounted.current) {
              setScanProgress(prev => ({ ...prev, current: completedIPs }));
            }
          }
        });

        // Wait for all promises in batch without additional timeout wrapper
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Check results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            deviceFound = result.value;
            found = true;
            break;
          }
        }

        // Update progress
        if (!found && !controller.signal.aborted && isMounted.current) {
          const progress = Math.round((completedIPs / totalIPs) * 100);
          setStatus(`🔍 Mencari... ${progress}%`);
        }
        
        // Small delay between batches to avoid network congestion
        if (!found && i + batchSize < allIPs.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Handle found device after loop completes
      if (found && deviceFound && isMounted.current) {
        const { ip, data } = deviceFound;
        setDeviceIP(ip);
        setStatus(`✅ ${deviceName || 'Device'} ditemukan!`);
        setConnectionStatus('connected');
        
        // Update saved device with new IP
        if (user?.uid) {
          try {
            await set(ref(db, `users/${user.uid}/devices/${targetUid}/ip`), ip);
          } catch (error) {
            console.error('Error saving device IP:', error);
          }
        }
        
        // Quick success feedback
        Alert.alert(
          "✅ Terhubung!", 
          `${deviceName || 'Device'} ditemukan di ${ip}`,
          [{ text: "OK" }],
          { cancelable: true }
        );
      }
      
      if (!found && !controller.signal.aborted && isMounted.current) {
        setStatus("❌ Device tidak ditemukan");
        
        // Keep the device UID set for remote mode
        Alert.alert(
          "Device Offline", 
          `${deviceName || 'Device'} tidak ditemukan di jaringan.\n\nAnda dapat menggunakan mode remote untuk kontrol dasar.`,
          [
            { 
              text: "Mode Remote", 
              onPress: () => {
                if (isMounted.current) {
                  setDeviceIP(""); // Clear IP for remote mode
                  setStatus(`📡 Mode Remote - ${deviceName || targetUid.substring(0, 8)}`);
                  setConnectionStatus('disconnected');
                }
              }
            },
            { 
              text: "Coba Lagi", 
              onPress: () => scanForSpecificDevice(targetUid, deviceName) 
            },
            {
              text: "Batal",
              style: "cancel",
              onPress: () => {
                // Reset everything if user cancels
                if (isMounted.current) {
                  setActualDeviceUid("");
                  setDeviceIP("");
                  setStatus("🔧 Siap terhubung ke ESP32");
                }
              }
            }
          ]
        );
      }
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        if (isMounted.current) {
          setStatus("❌ Error saat memindai");
        }
        console.error('Scan error:', error);
      }
    } finally {
      if (isMounted.current) {
        setIsScanning(false);
        setScanController(null);
        setScanProgress({ current: 0, total: 0 });
      }
    }
  };

  // Network scanning
  const scanForESP32 = async () => {
    if (isScanning) {
      if (scanController) {
        scanController.abort();
        setScanController(null);
      }
      setIsScanning(false);
      setStatus("❌ Scan dibatalkan");
      return;
    }

    setIsScanning(true);
    const controller = new AbortController();
    setScanController(controller);
    
    const networkRanges = ['192.168.137', '192.168.1']; // Intentionally hardcoded
    // Prioritize 185 since it's a known device location
    const priorityIPs = [185, 17, 1, 100, 101, 102, 103, 104, 105, 142, 163, 254];
    const extendedRange = Array.from({ length: 254 }, (_, i) => i + 1)
      .filter(ip => !priorityIPs.includes(ip));

    const allLastOctets = [...priorityIPs, ...extendedRange];
    const allIPs = networkRanges.flatMap(baseIP => 
      allLastOctets.map(lastOctet => `${baseIP}.${lastOctet}`)
    );

    const totalIPs = allIPs.length;
    setScanProgress({ current: 0, total: totalIPs });
    setStatus(`🔍 Memindai ${totalIPs} alamat IP...`);

    try {
      const batchSize = 5; // Reduced for reliability
      let completedIPs = 0;
      let found = false;
      let foundDevices = [];

      for (let i = 0; i < allIPs.length && !controller.signal.aborted; i += batchSize) {
        const batch = allIPs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (testIP) => {
          if (controller.signal.aborted) return null;
          
          try {
            // Individual timeout for each request
            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 2500);
            
            const response = await fetch(`http://${testIP}/discover`, {
              method: 'GET',
              headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              signal: fetchController.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              console.log(`Found device at ${testIP}:`, data);
              
              if (data.type === "rfid_relay" && data.uid) {
                return { ip: testIP, data };
              }
            }
            return null;
          } catch (error) {
            // Don't log timeout errors
            if (error.name !== 'AbortError') {
              console.error(`Error scanning ${testIP}:`, error);
            }
            return null;
          } finally {
            completedIPs++;
            if (isMounted.current) {
              setScanProgress(prev => ({ ...prev, current: completedIPs }));
            }
          }
        });

        // Wait for all promises in batch
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Check results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            foundDevices.push(result.value);
            if (!found) {
              const { ip, data } = result.value;
              if (isMounted.current) {
                setActualDeviceUid(data.uid);
                setDeviceIP(ip);
                setStatus(`✅ ESP32 ditemukan di ${ip}!`);
                setConnectionStatus('connected');
              }
              found = true;
              
              Alert.alert(
                "🎉 ESP32 Ditemukan!", 
                `IP Address: ${ip}\nDevice UID: ${data.uid}\nType: ${data.type}`,
                [{ text: "OK" }]
              );
            }
          }
        }

        // Update progress
        if (!controller.signal.aborted && isMounted.current) {
          const progress = Math.round((completedIPs / totalIPs) * 100);
          setStatus(`🔍 Memindai... ${progress}% (${completedIPs}/${totalIPs})`);
        }
        
        // Small delay between batches
        if (i + batchSize < allIPs.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      if (!found && !controller.signal.aborted && isMounted.current) {
        setStatus("❌ ESP32 tidak ditemukan di jaringan");
        Alert.alert(
          "❌ ESP32 Tidak Ditemukan", 
          `Telah memindai ${totalIPs} alamat IP.\n\nPastikan:\n• ESP32 tersambung ke WiFi\n• ESP32 di jaringan yang sama\n• Firmware berjalan dengan benar`,
          [{ text: "OK" }]
        );
      }
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        if (isMounted.current) {
          setStatus("❌ Error saat memindai jaringan");
        }
        console.error('Scan error:', error);
        Alert.alert("❌ Error", "Terjadi kesalahan saat memindai jaringan");
      }
    } finally {
      if (isMounted.current) {
        setIsScanning(false);
        setScanController(null);
        setScanProgress({ current: 0, total: 0 });
      }
    }
  };

  // Fetch new RFIDs from ESP32
  const fetchNewRFIDs = async () => {
    if (!deviceIP.trim() || connectionStatus !== 'connected') return;
    
    try {
      const fetchPromise = fetch(`http://${deviceIP}/new-rfids`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      const response = await Promise.race([fetchPromise, createTimeoutPromise(3000)]);

      if (response.ok) {
        const data = await response.json();
        if (isMounted.current) {
          setNewRFIDs(data.rfids || []);
        }
      }
    } catch (error) {
      // Ignore polling errors but log them
      console.error('Error fetching new RFIDs:', error);
    }
  };

  // Management mode controls
  const startManagementMode = async () => {
    if (!deviceIP.trim() || connectionStatus !== 'connected') {
      Alert.alert(
        "❌ Koneksi LAN Diperlukan", 
        connectionStatus === 'disconnected' 
          ? "Koneksi LAN terputus. Periksa koneksi ESP32 dan pastikan perangkat menyala."
          : "Mode scan RFID memerlukan koneksi langsung ke ESP32 melalui jaringan lokal (LAN).\n\nSaat ini Anda terhubung melalui WAN (Remote/Cloud) yang tidak mendukung fitur ini.\n\nSilakan scan jaringan atau masukkan IP address perangkat untuk menggunakan fitur scan RFID.",
        [
          { text: "Tutup", style: "cancel" },
          { 
            text: "Scan Jaringan", 
            onPress: () => {
              setShowConfigModal(true);
            }
          }
        ]
      );
      return;
    }

    if (!canControlDevice()) {
      Alert.alert("❌ Akses Ditolak", "Perangkat ini sedang dikontrol oleh pengguna lain");
      return;
    }

    try {
      const response = await fetch(`http://${deviceIP}/management-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      if (response.ok) {
        setManagementMode(true);
        setStatus("🏷️ Mode scan aktif");
        Alert.alert("✅ Mode Scan", "Silakan scan kartu RFID di ESP32");
      } else {
        Alert.alert("❌ Error", "Gagal mengaktifkan mode scan");
      }
    } catch (error) {
      Alert.alert("❌ Error", "Gagal mengaktifkan mode scan");
      console.error('Error starting management mode:', error);
    }
  };

  const stopManagementMode = async () => {
    if (!deviceIP.trim()) return;

    try {
      await fetch(`http://${deviceIP}/management-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      setManagementMode(false);
      setStatus("✅ Mode scan dinonaktifkan");
    } catch (error) {
      console.error('Error stopping management mode:', error);
    }
  };

  // RFID operations
  const saveRFIDToFirebase = async (rfidUID: string) => {
    if (!actualDeviceUid) {
      Alert.alert("❌ Error", "Perangkat belum terhubung");
      return;
    }

    if (!canControlDevice()) {
      Alert.alert("❌ Akses Ditolak", "Perangkat ini sedang dikontrol oleh pengguna lain");
      return;
    }

    try {
      await set(ref(db, `${uidPath}/${rfidUID}`), true);
      Alert.alert("✅ Berhasil", `RFID ${rfidUID} disimpan`);
      
      setNewRFIDs(prev => prev.filter(uid => uid !== rfidUID));
      
      if (deviceIP.trim() && connectionStatus === 'connected') {
        fetch(`http://${deviceIP}/clear-rfid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rfid: rfidUID }),
        }).catch((error) => {
          console.error('Failed to clear RFID from device:', error);
        });
      }
    } catch (error) {
      Alert.alert("❌ Error", "Gagal menyimpan RFID");
      console.error('Error saving RFID:', error);
    }
  };

  const addManualUID = async () => {
    if (!manualUID.trim()) {
      Alert.alert("❌ Error", "Masukkan UID yang valid");
      return;
    }

    if (!actualDeviceUid) {
      Alert.alert("❌ Error", "Perangkat belum terhubung");
      return;
    }

    if (!canControlDevice()) {
      Alert.alert("❌ Akses Ditolak", "Perangkat ini sedang dikontrol oleh pengguna lain");
      return;
    }

    const cleanUID = manualUID.trim().toUpperCase();
    
    try {
      await set(ref(db, `${uidPath}/${cleanUID}`), true);
      Alert.alert("✅ Berhasil", "UID berhasil ditambahkan");
      setManualUID("");
      setShowRFIDModal(false);
    } catch (error) {
      Alert.alert("❌ Error", "Gagal menambahkan UID");
      console.error('Error adding manual UID:', error);
    }
  };

  const deleteUID = async (uid: string) => {
    if (!canControlDevice()) {
      Alert.alert("❌ Akses Ditolak", "Perangkat ini sedang dikontrol oleh pengguna lain");
      return;
    }

    Alert.alert("Konfirmasi", `Hapus UID ${uid}?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await remove(ref(db, `${uidPath}/${uid}`));
            Alert.alert("✅ Berhasil", "UID berhasil dihapus");
          } catch (error) {
            Alert.alert("❌ Error", "Gagal menghapus UID");
            console.error('Error deleting UID:', error);
          }
        },
      },
    ]);
  };

  const savePin = async () => {
    if (!pin.trim()) {
      Alert.alert("❌ Error", "Masukkan PIN yang valid");
      return;
    }

    if (!canControlDevice()) {
      Alert.alert("❌ Akses Ditolak", "Perangkat ini sedang dikontrol oleh pengguna lain");
      return;
    }

    if (!user?.uid) {
      Alert.alert("❌ Error", "User tidak terautentikasi");
      return;
    }

    try {
      await set(ref(db, pinPath), pin.trim());
      Alert.alert("✅ Berhasil", "PIN backup disimpan");
      setPin("");
      setShowPinModal(false);
    } catch (error) {
      Alert.alert("❌ Error", "Gagal menyimpan PIN");
      console.error('Error saving PIN:', error);
    }
  };

  const claimDeviceIfAvailable = async () => {
    if (!deviceState.triggeredBy && user?.uid) {
      // Also update device ownership in deviceMeta
      try {
        await set(ref(db, `${deviceMetaPath}/owner`), user.uid);
      } catch (error) {
        console.error("Error setting device owner:", error);
      }
    }
  };

  const toggleLockState = async () => {
    if (!actualDeviceUid) {
      Alert.alert("❌ Error", "Perangkat belum terhubung");
      return;
    }

    if (!canControlDevice()) {
      Alert.alert(
        "❌ Akses Ditolak", 
        `Perangkat ini sedang dikontrol oleh pengguna lain.\n\nController: ${deviceState.triggeredBy || 'Unknown'}`
      );
      return;
    }

    if (isUpdatingState) {
      return; // Prevent multiple simultaneous commands
    }

    setIsUpdatingState(true);

    try {
      // Claim device if it's not claimed yet
      await claimDeviceIfAvailable();

      const newLockState = !deviceState.isLocked;
      const newState = {
        isLocked: newLockState,
        lastCommand: newLockState ? "manual_lock" : "manual_unlock",
        timestamp: Date.now(),
        triggeredBy: user?.uid || "unknown"
      };

      // Update Firebase state - ESP32 will listen to this
      await set(ref(db, deviceStatePath), newState);
      
      Alert.alert(
        "✅ Perintah Terkirim", 
        `ESP32 akan ${newLockState ? 'mengunci' : 'membuka kunci'} berdasarkan state di Firebase`
      );

    } catch (error) {
      Alert.alert("❌ Error", "Gagal mengirim perintah ke Firebase");
      console.error("Firebase state update error:", error);
    } finally {
      if (isMounted.current) {
        setIsUpdatingState(false);
      }
    }
  };

  const releaseDevice = async () => {
    if (!isDeviceController()) {
      Alert.alert("❌ Error", "Anda bukan controller perangkat ini");
      return;
    }

    Alert.alert(
      "🔓 Release Device Control",
      "Apakah Anda yakin ingin melepaskan kendali perangkat ini?\n\nSetelah dilepas, pengguna lain dapat mengontrol perangkat ini.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Release",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear device controller
              const newState = {
                ...deviceState,
                triggeredBy: null,
                lastCommand: "device_released",
                timestamp: Date.now()
              };
              
              await set(ref(db, deviceStatePath), newState);
              
              // Optionally clear device ownership in deviceMeta
              await remove(ref(db, `${deviceMetaPath}/owner`));
              
              Alert.alert(
                "✅ Device Released", 
                "Perangkat berhasil dilepas. Pengguna lain sekarang dapat mengontrolnya."
              );
              
              setShowReleaseModal(false);
            } catch (error) {
              Alert.alert("❌ Error", "Gagal melepas kontrol perangkat");
              console.error("Release device error:", error);
            }
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('id-ID');
  };

  const getConnectionMode = () => {
    if (!actualDeviceUid) return 'none';
    if (deviceIP.trim()) return 'lan';
    return 'wan';
  };

  const getConnectionStatusDisplay = () => {
    const mode = getConnectionMode();
    
    if (mode === 'none') return null;
    
    if (mode === 'lan') {
      return {
        icon: connectionStatus === 'connected' ? 'wifi' : 'close-circle',
        color: connectionStatus === 'connected' ? '#22c55e' : '#ef4444',
        text: connectionStatus === 'connected' ? `LAN (${deviceIP})` : 'LAN Terputus',
        bgColor: connectionStatus === 'connected' ? 'bg-green-500/20' : 'bg-red-500/20',
        borderColor: connectionStatus === 'connected' ? 'border-green-500' : 'border-red-500'
      };
    }
    
    return {
      icon: 'globe',
      color: '#3b82f6',
      text: 'WAN (Cloud)',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500'
    };
  };

  return (
    <View className="flex-1 bg-[#0f1117]">
      {/* Header with Connection Status */}
      <View className="bg-[#1a1d29] px-4 pt-12 pb-4 border-b border-gray-800">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">RFID Manager</Text>
            <Text className="text-gray-400">{deviceName || "SmartLock ESP32"}</Text>
          </View>
          <View className="flex-row items-center">
            {actualDeviceUid && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Ganti Perangkat?",
                    "Apakah Anda ingin memilih perangkat lain?",
                    [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Ya, Ganti",
                        onPress: () => {
                          // Reset all device-related states
                          setActualDeviceUid("");
                          setDeviceIP("");
                          setStatus("🔧 Siap terhubung ke ESP32");
                          setConnectionStatus('checking');
                          setManagementMode(false);
                          setNewRFIDs([]);
                          if (connectionCheckInterval.current) {
                            clearInterval(connectionCheckInterval.current);
                          }
                        }
                      }
                    ]
                  );
                }}
                className="bg-white/10 p-3 rounded-xl mr-2"
              >
                <Ionicons name="swap-horizontal" size={24} color="white" />
              </Pressable>
            )}
            <Pressable
              onPress={() => navigation.goBack()}
              className="bg-white/10 p-3 rounded-xl"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Connection Status Bar */}
        {actualDeviceUid && (
          <View className={`p-3 rounded-xl ${getConnectionStatusDisplay()?.bgColor} ${getConnectionStatusDisplay()?.borderColor} border`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons 
                  name={getConnectionStatusDisplay()?.icon as any} 
                  size={20} 
                  color={getConnectionStatusDisplay()?.color} 
                />
                <Text className="text-white font-bold ml-2">
                  {getConnectionStatusDisplay()?.text}
                </Text>
                {lastPingTime && getConnectionMode() === 'lan' && connectionStatus === 'connected' && (
                  <Text className="text-gray-400 text-xs ml-2">
                    • Aktif
                  </Text>
                )}
              </View>
              
              {/* Lock Status */}
              <View className="flex-row items-center bg-black/30 px-3 py-1 rounded-full">
                <Ionicons 
                  name={deviceState.isLocked ? "lock-closed" : "lock-open"} 
                  size={14} 
                  color={deviceState.isLocked ? "#ef4444" : "#22c55e"} 
                />
                <Text className={`ml-1 text-xs font-bold ${deviceState.isLocked ? 'text-red-400' : 'text-green-400'}`}>
                  {deviceState.isLocked ? 'Terkunci' : 'Terbuka'}
                </Text>
              </View>
            </View>

            {/* Warning for disconnected LAN */}
            {getConnectionMode() === 'lan' && connectionStatus === 'disconnected' && (
              <View className="mt-2 pt-2 border-t border-red-600/30">
                <Text className="text-red-300 text-xs">
                  ⚠️ Tidak dapat terhubung ke ESP32. Periksa koneksi jaringan.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Device Info Card - Only show if connected */}
        {actualDeviceUid && (
          <View className="bg-[#1a1d29] p-4 rounded-2xl mb-4 border border-gray-800">
            <Text className="text-gray-400 text-sm mb-2">Device UID</Text>
            <Text className="text-white font-mono text-sm">{actualDeviceUid}</Text>
            
            <View className="mt-3 pt-3 border-t border-gray-800">
              <Text className="text-gray-400 text-sm mb-1">Controller</Text>
              <Text className={`font-bold ${!deviceState.triggeredBy ? 'text-green-400' : canControlDevice() ? 'text-blue-400' : 'text-red-400'}`}>
                {!deviceState.triggeredBy ? '🆓 Tidak ada - Siap diklaim' : canControlDevice() ? '✅ Anda' : `🔒 ${deviceState.triggeredBy}`}
              </Text>
            </View>

            {isDeviceController() && (
              <Pressable
                onPress={releaseDevice}
                className="mt-3 bg-red-500/20 border border-red-500 p-2 rounded-lg"
              >
                <Text className="text-red-400 text-center text-sm font-bold">Release Control</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Saved Devices Section - Show when not connected */}
        {!actualDeviceUid && savedDevices.length > 0 && (
          <View className="mb-6">
            <Text className="text-white text-lg font-bold mb-3">Perangkat Tersimpan</Text>
            
            <Pressable
              onPress={() => {
                console.log("Opening saved devices modal...");
                setShowSavedDevicesModal(true);
              }}
              className="bg-green-500 p-4 rounded-2xl active:bg-green-600"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="list" size={24} color="white" />
                <Text className="text-white font-bold text-lg ml-2">
                  Pilih Perangkat ({savedDevices.length})
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Network Scan Section - Show when not connected */}
        {!actualDeviceUid && (
          <View className="mb-6">
            <Text className="text-white text-lg font-bold mb-3">Cari ESP32</Text>
            
            <Pressable
              onPress={scanForESP32}
              className={`p-4 rounded-2xl mb-3 ${isScanning ? 'bg-red-500' : 'bg-yellow-400'}`}
            >
              <View className="flex-row items-center justify-center">
                {isScanning ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-bold text-lg ml-2">Stop Scanning</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={24} color="black" />
                    <Text className="text-black font-bold text-lg ml-2">Scan Jaringan ESP32</Text>
                  </>
                )}
              </View>
            </Pressable>

            {isScanning && (
              <View className="bg-yellow-500/20 p-3 rounded-xl border border-yellow-500">
                <View className="bg-gray-700 rounded-full h-2 mb-2">
                  <View 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ 
                      width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` 
                    }} 
                  />
                </View>
                <Text className="text-yellow-400 text-center text-sm">
                  Scanning {scanProgress.current}/{scanProgress.total} IP addresses...
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => setShowConfigModal(true)}
              className="bg-[#1a1d29] p-3 rounded-xl border border-gray-800"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="settings" size={20} color="white" />
                <Text className="text-white ml-2">Manual IP Configuration</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Main Control Panel - Show when connected */}
        {actualDeviceUid && (
          <>
            {/* Lock Control */}
            <View className="bg-[#1a1d29] p-6 rounded-2xl mb-4 border border-gray-800">
              <Text className="text-white text-lg font-bold mb-4">Kontrol Kunci</Text>
              
              <Pressable
                onPress={toggleLockState}
                className={`p-6 rounded-xl ${
                  !canControlDevice() 
                    ? 'bg-gray-700' 
                    : isUpdatingState 
                      ? 'bg-gray-700' 
                      : deviceState.isLocked 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                }`}
                disabled={!canControlDevice() || isUpdatingState}
              >
                <View className="items-center">
                  {isUpdatingState ? (
                    <ActivityIndicator color="white" size="large" />
                  ) : (
                    <Ionicons 
                      name={deviceState.isLocked ? "lock-open" : "lock-closed"} 
                      size={48} 
                      color="white" 
                    />
                  )}
                  <Text className="text-white font-bold text-xl mt-3">
                    {!canControlDevice() 
                      ? 'Terkunci oleh pengguna lain' 
                      : isUpdatingState 
                        ? 'Mengirim perintah...' 
                        : deviceState.isLocked 
                          ? 'Tap untuk Buka Kunci' 
                          : 'Tap untuk Kunci'}
                  </Text>
                </View>
              </Pressable>

              <View className="mt-4 p-3 bg-black/30 rounded-lg">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-sm">Perintah terakhir:</Text>
                  <Text className="text-white text-sm font-mono">{deviceState.lastCommand}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Update:</Text>
                  <Text className="text-white text-sm">{new Date(deviceState.timestamp).toLocaleTimeString('id-ID')}</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View className="mb-4">
              <Text className="text-white text-lg font-bold mb-3">Aksi Cepat</Text>
              
              <View className="flex-row flex-wrap -mr-3">
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "Pilih Perangkat Lain?",
                      "Anda akan kembali ke halaman pemilihan perangkat.",
                      [
                        { text: "Batal", style: "cancel" },
                        {
                          text: "Ya",
                          onPress: () => {
                            setActualDeviceUid("");
                            setDeviceIP("");
                            setStatus("🔧 Siap terhubung ke ESP32");
                            setConnectionStatus('checking');
                            setManagementMode(false);
                            setNewRFIDs([]);
                            if (connectionCheckInterval.current) {
                              clearInterval(connectionCheckInterval.current);
                            }
                          }
                        }
                      ]
                    );
                  }}
                  className="bg-[#1a1d29] border border-gray-800 p-4 rounded-xl mr-3 mb-3 flex-1 min-w-[45%]"
                >
                  <Ionicons name="swap-horizontal" size={24} color="#22c55e" />
                  <Text className="text-white font-bold mt-2">Ganti Device</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowConfigModal(true)}
                  className="bg-[#1a1d29] border border-gray-800 p-4 rounded-xl mr-3 mb-3 flex-1 min-w-[45%]"
                >
                  <Ionicons name="settings" size={24} color="#3b82f6" />
                  <Text className="text-white font-bold mt-2">Konfigurasi</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowRFIDModal(true)}
                  className={`p-4 rounded-xl mr-3 mb-3 flex-1 min-w-[45%] ${
                    canControlDevice() 
                      ? 'bg-[#1a1d29] border border-purple-500' 
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                  disabled={!canControlDevice()}
                >
                  <Ionicons name="add-circle" size={24} color={canControlDevice() ? "#a855f7" : "#6b7280"} />
                  <Text className={`font-bold mt-2 ${canControlDevice() ? 'text-white' : 'text-gray-500'}`}>
                    Tambah RFID
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowPinModal(true)}
                  className={`p-4 rounded-xl mr-3 mb-3 flex-1 min-w-[45%] ${
                    canControlDevice() 
                      ? 'bg-[#1a1d29] border border-orange-500' 
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                  disabled={!canControlDevice()}
                >
                  <Ionicons name="key" size={24} color={canControlDevice() ? "#f97316" : "#6b7280"} />
                  <Text className={`font-bold mt-2 ${canControlDevice() ? 'text-white' : 'text-gray-500'}`}>
                    PIN Backup
                  </Text>
                </Pressable>

                {accessLogs.length > 0 && (
                  <Pressable
                    onPress={() => setShowLogsModal(true)}
                    className="bg-[#1a1d29] border border-gray-800 p-4 rounded-xl mr-3 mb-3 flex-1 min-w-[45%]"
                  >
                    <Ionicons name="time" size={24} color="#ffd33d" />
                    <Text className="text-white font-bold mt-2">Log Akses</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* RFID Scan Mode */}
            <View className="mb-6">
              <Text className="text-white text-lg font-bold mb-3">Mode Scan RFID</Text>
              
              {getConnectionMode() === 'wan' || (getConnectionMode() === 'lan' && connectionStatus === 'disconnected') ? (
                <View className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <View className="flex-row items-center">
                    <Ionicons name="information-circle" size={24} color="#6b7280" />
                    <Text className="text-gray-400 ml-3 flex-1">
                      {getConnectionMode() === 'wan' 
                        ? 'Mode scan RFID hanya tersedia via koneksi LAN'
                        : 'Koneksi LAN terputus. Periksa ESP32.'}
                    </Text>
                  </View>
                </View>
              ) : !managementMode ? (
                <Pressable
                  onPress={startManagementMode}
                  className={`p-4 rounded-xl ${
                    canControlDevice() ? 'bg-yellow-400' : 'bg-gray-800'
                  }`}
                  disabled={!canControlDevice()}
                >
                  <View className="flex-row items-center justify-center">
                    <Ionicons name="scan" size={24} color={canControlDevice() ? "black" : "#6b7280"} />
                    <Text className={`font-bold text-lg ml-2 ${canControlDevice() ? 'text-black' : 'text-gray-500'}`}>
                      {canControlDevice() ? 'Aktifkan Mode Scan' : 'Mode Scan Terkunci'}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View className="bg-yellow-500/20 p-4 rounded-xl border border-yellow-500">
                  <View className="flex-row items-center mb-3">
                    <ActivityIndicator color="#ffd33d" size="small" />
                    <Text className="text-yellow-400 font-bold ml-2">Mode Scan Aktif</Text>
                  </View>
                  
                  {newRFIDs.length > 0 && (
                    <View className="mb-3">
                      <Text className="text-white mb-2">RFID Terdeteksi:</Text>
                      {newRFIDs.map((rfid, index) => (
                        <View key={index} className="bg-black/30 p-3 rounded-lg mb-2 flex-row justify-between items-center">
                          <Text className="text-white font-mono">{rfid}</Text>
                          <Pressable 
                            onPress={() => saveRFIDToFirebase(rfid)}
                            className="bg-green-500 px-3 py-1 rounded"
                          >
                            <Text className="text-white font-bold">Simpan</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <Pressable 
                    onPress={stopManagementMode} 
                    className="bg-red-500 p-3 rounded-xl"
                  >
                    <Text className="text-white text-center font-bold">Nonaktifkan Mode Scan</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Registered RFIDs */}
            <View className="mb-6">
              <Text className="text-white text-lg font-bold mb-3">
                Kartu Terdaftar ({registeredUIDs.length})
              </Text>

              {registeredUIDs.length === 0 ? (
                <View className="bg-[#1a1d29] p-8 rounded-xl border border-gray-800">
                  <Text className="text-gray-400 text-center">Belum ada kartu terdaftar</Text>
                </View>
              ) : (
                registeredUIDs.map((uid, index) => (
                  <View key={index} className="bg-[#1a1d29] p-4 rounded-xl mb-3 border border-gray-800">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center flex-1">
                        <Ionicons name="card" size={20} color="#ffd33d" />
                        <Text className="text-white font-mono ml-3 flex-1">{uid}</Text>
                      </View>
                      <Pressable 
                        onPress={() => deleteUID(uid)} 
                        className={`px-3 py-1 rounded ${canControlDevice() ? 'bg-red-500' : 'bg-gray-700'}`}
                        disabled={!canControlDevice()}
                      >
                        <Text className="text-white font-bold">
                          {canControlDevice() ? 'Hapus' : 'Terkunci'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Configuration Modal */}
      <Modal visible={showConfigModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-[#1a1d29] p-6 rounded-t-3xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Konfigurasi Perangkat</Text>
              <Pressable onPress={() => setShowConfigModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <TextInput
              value={deviceIP}
              onChangeText={setDeviceIP}
              placeholder="IP Address ESP32"
              placeholderTextColor="#6b7280"
              className="bg-black/30 rounded-xl px-4 py-3 mb-4 text-white border border-gray-700"
            />

            <View className="flex-row mb-4">
              <Pressable 
                onPress={checkDeviceConnection} 
                className="bg-blue-500 px-4 py-3 rounded-xl mr-3 flex-1"
              >
                <Text className="text-white text-center font-bold">Test Koneksi</Text>
              </Pressable>
              
              <Pressable 
                onPress={scanForESP32} 
                className={`px-4 py-3 rounded-xl flex-1 ${isScanning ? 'bg-red-500' : 'bg-orange-500'}`}
              >
                <Text className="text-white text-center font-bold">
                  {isScanning ? 'Stop Scan' : 'Auto Scan'}
                </Text>
              </Pressable>
            </View>

            {isScanning && (
              <View className="mb-4">
                <View className="bg-gray-700 rounded-full h-2 mb-2">
                  <View 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ 
                      width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` 
                    }} 
                  />
                </View>
                <Text className="text-gray-400 text-center text-sm">
                  {scanProgress.current}/{scanProgress.total} IP addresses
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Saved Devices Modal */}
      <Modal 
        visible={showSavedDevicesModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowSavedDevicesModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-[#1a1d29] p-6 rounded-t-3xl max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Perangkat Tersimpan</Text>
              <Pressable 
                onPress={() => {
                  console.log("Closing saved devices modal...");
                  setShowSavedDevicesModal(false);
                }}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {savedDevices.length === 0 ? (
                <Text className="text-gray-400 text-center py-8">
                  Belum ada perangkat lock yang tersimpan
                </Text>
              ) : (
                savedDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    onPress={() => {
                      if (!isLoadingSavedDevices) {
                        connectToSavedDevice(device);
                      }
                    }}
                    className="bg-black/30 p-4 rounded-xl mb-3 border border-gray-700 active:bg-black/50"
                    disabled={isLoadingSavedDevices}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                          <Ionicons name="lock-closed" size={20} color="#ffd33d" />
                          <Text className="text-white font-bold ml-2">{device.name}</Text>
                        </View>
                        <Text className="text-gray-400 text-sm">ID: {device.id}</Text>
                        {device.ip && (
                          <Text className="text-gray-500 text-xs">Last IP: {device.ip}</Text>
                        )}
                        {device.discoveredAt && (
                          <Text className="text-gray-500 text-xs">
                            Ditambahkan: {new Date(device.discoveredAt).toLocaleDateString('id-ID')}
                          </Text>
                        )}
                      </View>
                      {isLoadingSavedDevices ? (
                        <ActivityIndicator size="small" color="#ffd33d" />
                      ) : (
                        <Ionicons 
                          name="chevron-forward" 
                          size={24} 
                          color="#ffd33d" 
                        />
                      )}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <View className="mt-4 pt-3 border-t border-gray-700">
              <Text className="text-gray-400 text-sm text-center">
                💡 Pilih perangkat untuk mencari di jaringan lokal
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* RFID Modal */}
      <Modal visible={showRFIDModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-[#1a1d29] p-6 rounded-t-3xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Tambah RFID Manual</Text>
              <Pressable onPress={() => setShowRFIDModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            {!canControlDevice() && (
              <View className="bg-red-500/20 border border-red-500 p-3 rounded-xl mb-4">
                <Text className="text-red-400 text-center">
                  Perangkat dikontrol oleh pengguna lain
                </Text>
              </View>
            )}

            <TextInput
              value={manualUID}
              onChangeText={setManualUID}
              placeholder="Masukkan UID RFID (contoh: A1B2C3D4)"
              placeholderTextColor="#6b7280"
              className="bg-black/30 rounded-xl px-4 py-3 mb-4 text-white border border-gray-700"
              autoCapitalize="characters"
              editable={canControlDevice()}
            />

            <Pressable 
              onPress={addManualUID} 
              className={`px-4 py-3 rounded-xl ${canControlDevice() ? 'bg-yellow-400' : 'bg-gray-700'}`}
              disabled={!canControlDevice()}
            >
              <Text className={`text-center font-bold ${canControlDevice() ? 'text-black' : 'text-gray-400'}`}>
                {canControlDevice() ? 'Tambah UID' : 'Akses Ditolak'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-[#1a1d29] p-6 rounded-t-3xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">PIN Backup</Text>
              <Pressable onPress={() => setShowPinModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            {!canControlDevice() && (
              <View className="bg-red-500/20 border border-red-500 p-3 rounded-xl mb-4">
                <Text className="text-red-400 text-center">
                  Perangkat dikontrol oleh pengguna lain
                </Text>
              </View>
            )}

            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="Masukkan PIN backup (contoh: 1234)"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              className="bg-black/30 rounded-xl px-4 py-3 mb-4 text-white border border-gray-700"
              editable={canControlDevice()}
            />

            <Pressable 
              onPress={savePin} 
              className={`px-4 py-3 rounded-xl ${canControlDevice() ? 'bg-yellow-400' : 'bg-gray-700'}`}
              disabled={!canControlDevice()}
            >
              <Text className={`text-center font-bold ${canControlDevice() ? 'text-black' : 'text-gray-400'}`}>
                {canControlDevice() ? 'Simpan PIN' : 'Akses Ditolak'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Logs Modal */}
      <Modal visible={showLogsModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-[#1a1d29] p-6 rounded-t-3xl max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Log Akses Terakhir</Text>
              <Pressable onPress={() => setShowLogsModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <ScrollView>
              {accessLogs.slice(0, 10).map((log, index) => (
                <View key={index} className="bg-black/30 p-4 rounded-xl mb-3 border border-gray-700">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-white font-mono">{log.uid}</Text>
                    <Text className={`font-bold ${log.granted ? 'text-green-400' : 'text-red-400'}`}>
                      {log.granted ? '✅ Berhasil' : '❌ Ditolak'}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-sm">
                    {formatTimestamp(log.timestamp)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}