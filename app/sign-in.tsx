import { router, Link } from "expo-router";
import { Text, TextInput, View, Pressable, StatusBar, Dimensions } from "react-native";
import { useState } from "react";
import { useSession } from "@/context";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get('window');

/**
 * SignIn component handles user authentication through email and password
 * @returns {JSX.Element} Sign-in form component
 */
export default function SignIn() {
  // ============================================================================
  // Hooks & State
  // ============================================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useSession();

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles the sign-in process
   * @returns {Promise<Models.User<Models.Preferences> | null>}
   */
  const handleLogin = async () => {
    try {
      return await signIn(email, password);
    } catch (err) {
      console.log("[handleLogin] ==>", err);
      return null;
    }
  };

  /**
   * Handles the sign-in button press
   */
  const handleSignInPress = async () => {
    setIsLoading(true);
    try {
      const resp = await handleLogin();
      router.replace("/(app)/(drawer)/(tabs)/");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a202c" />
      <View className="flex-1" style={{ backgroundColor: "#25292e" }}>
        {/* Background Gradient */}
        <View 
          className="absolute top-0 left-0 right-0 rounded-b-3xl"
          style={{ 
            height: height * 0.4,
            backgroundColor: '#2d3748'
          }}
        />

        <View className="flex-1 justify-center items-center px-6">
          {/* Welcome Section */}
          <View className="items-center mb-8" style={{ marginTop: -60 }}>
            {/* ESP32 Inspired Logo */}
            <View className="items-center mb-6">
              <View className="relative">
                {/* Main chip body */}
                <View className="w-24 h-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-yellow-400/30 items-center justify-center">
                  {/* Chip pattern */}
                  <View className="w-16 h-10 bg-yellow-400/10 rounded border border-yellow-400/20 items-center justify-center">
                    <Text className="text-yellow-400 text-xs font-bold">ESP32</Text>
                  </View>
                </View>
                
                {/* Connection pins */}
                <View className="absolute -left-1 top-2 w-2 h-2 bg-yellow-400 rounded-full" />
                <View className="absolute -left-1 top-6 w-2 h-2 bg-yellow-400 rounded-full" />
                <View className="absolute -left-1 top-10 w-2 h-2 bg-yellow-400 rounded-full" />
                
                <View className="absolute -right-1 top-2 w-2 h-2 bg-yellow-400 rounded-full" />
                <View className="absolute -right-1 top-6 w-2 h-2 bg-yellow-400 rounded-full" />
                <View className="absolute -right-1 top-10 w-2 h-2 bg-yellow-400 rounded-full" />
                
                {/* WiFi signal indicator */}
                <View className="absolute -top-2 right-2">
                  <View className="flex-row items-end space-x-1">
                    <View className="w-1 h-1 bg-green-400 rounded-full" />
                    <View className="w-1 h-2 bg-green-400 rounded-full" />
                    <View className="w-1 h-3 bg-green-400 rounded-full" />
                  </View>
                </View>
              </View>
              
              {/* App name */}
              <View className="mt-4 px-4 py-2 bg-yellow-400/10 rounded-full border border-yellow-400/30">
                <Text className="text-yellow-400 font-bold text-sm">Jenaela IoT Assistant</Text>
              </View>
            </View>
            
            <View className="items-center mt-2">
              <Text className="text-4xl font-black text-white mb-2 text-center tracking-wide">
                Welcome Back
              </Text>
              <View className="w-16 h-1 bg-yellow-400 rounded-full mb-4" />
              <View className="bg-white/5 px-4 py-2 rounded-full border border-white/10">
                <Text className="text-sm text-yellow-400 text-center font-semibold tracking-wider">
                  PLEASE SIGN IN TO CONTINUE
                </Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-2xl p-6 w-full max-w-[350px] shadow-lg mb-8">
            <Text className="text-gray-800 text-xl font-bold mb-6 text-center">Sign In</Text>
            
            {/* Form Section */}
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2 ml-1">
                  Email
                </Text>
                <View className="relative">
                  <TextInput
                    placeholder="Enter your email here"
                    value={email}
                    onChangeText={setEmail}
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="w-full p-4 pl-12 border border-gray-300 rounded-xl text-base bg-gray-50"
                    placeholderTextColor="#9ca3af"
                    style={{ height: 52 }}
                  />
                  <View className="absolute left-4 top-0 bottom-0 justify-center">
                    <Ionicons name="mail" size={18} color="#6b7280" />
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2 ml-1">
                  Password
                </Text>
                <View className="relative">
                  <TextInput
                    placeholder="Enter your password here"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="password"
                    className="w-full p-4 pl-12 border border-gray-300 rounded-xl text-base bg-gray-50"
                    placeholderTextColor="#9ca3af"
                    style={{ height: 52 }}
                  />
                  <View className="absolute left-4 top-0 bottom-0 justify-center">
                    <Ionicons name="lock-closed" size={18} color="#6b7280" />
                  </View>
                </View>
              </View>
            </View>

            {/* Sign In Button */}
            <Pressable
              onPress={handleSignInPress}
              disabled={isLoading}
              className={`w-full py-4 rounded-xl mt-6 ${isLoading ? 'opacity-70' : ''}`}
              style={{ backgroundColor: '#ffd33d' }}
            >
              <View className="flex-row items-center justify-center">
                {isLoading && (
                  <View className="mr-2">
                    <Ionicons name="refresh" size={16} color="#000" />
                  </View>
                )}
                <Text className="text-black font-semibold text-base text-center">
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Sign Up Link */}
          <View className="flex-row items-center">
            <Text className="text-white">Don't have an account?</Text>
            <Link href="/sign-up" asChild>
              <Pressable className="ml-2">
                <Text style={{ color: '#ffd33d' }} className="font-semibold">Sign Up</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Bottom Decoration */}
        <View className="absolute bottom-0 left-0 right-0 h-32 opacity-10">
          <View className="flex-row justify-between items-end h-full px-6">
            <View className="w-16 h-16 bg-yellow-400 rounded-full" />
            <View className="w-8 h-8 bg-blue-400 rounded-full mb-8" />
            <View className="w-12 h-12 bg-purple-400 rounded-full mb-4" />
          </View>
        </View>
      </View>
    </>
  );
}