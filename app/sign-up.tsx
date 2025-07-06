import { router, Link } from "expo-router";
import { Text, TextInput, View, Pressable, StatusBar, Dimensions } from "react-native";
import { useState } from "react";
import { useSession } from "@/context";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get('window');

/**
 * SignUp component handles new user registration
 * @returns {JSX.Element} Sign-up form component
 */
export default function SignUp() {
  // ============================================================================
  // Hooks & State
  // ============================================================================
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { signUp } = useSession();

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles the registration process
   * @returns {Promise<Models.User<Models.Preferences> | null>}
   */
  const handleRegister = async () => {
    try {
      return await signUp(email, password, name);
    } catch (err) {
      console.log("[handleRegister] ==>", err);
      return null;
    }
  };

  /**
   * Handles the sign-up button press
   */
  const handleSignUpPress = async () => {
    const resp = await handleRegister();
    if (resp) {
      router.replace("/(app)/(drawer)/(tabs)/");
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
          <View className="items-center mb-12">
            {/* App Icon */}
            <View className="w-20 h-20 bg-yellow-400/20 rounded-2xl items-center justify-center mb-6">
              <Ionicons name="person-add" size={32} color="#ffd33d" />
            </View>
            
            <Text className="text-3xl font-bold text-white mb-3 text-center">
              Create Account
            </Text>
            <Text className="text-base text-gray-400 text-center">
              Sign up to get started
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-2xl p-6 w-full max-w-[350px] shadow-lg mb-8">
            <Text className="text-gray-800 text-xl font-bold mb-6 text-center">Sign Up</Text>
            
            {/* Form Section */}
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2 ml-1">
                  Name
                </Text>
                <View className="relative">
                  <TextInput
                    placeholder="Your full name"
                    value={name}
                    onChangeText={setName}
                    textContentType="name"
                    autoCapitalize="words"
                    className="w-full p-4 pl-12 border border-gray-300 rounded-xl text-base bg-gray-50"
                    placeholderTextColor="#9ca3af"
                    style={{ height: 52 }}
                  />
                  <View className="absolute left-4 top-0 bottom-0 justify-center">
                    <Ionicons name="person" size={18} color="#6b7280" />
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2 ml-1 mt-2">
                  Email
                </Text>
                <View className="relative">
                  <TextInput
                    placeholder="name@mail.com"
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
                <Text className="text-sm font-medium text-gray-700 mb-2 ml-1 mt-2">
                  Password
                </Text>
                <View className="relative">
                  <TextInput
                    placeholder="Create a password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="newPassword"
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

            {/* Sign Up Button */}
            <Pressable
              onPress={handleSignUpPress}
              className="w-full py-4 rounded-xl mt-6"
              style={{ backgroundColor: '#ffd33d' }}
            >
              <Text className="text-black font-semibold text-base text-center">
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Sign In Link */}
          <View className="flex-row items-center">
            <Text className="text-white">Already have an account?</Text>
            <Link href="/sign-in" asChild>
              <Pressable className="ml-2">
                <Text style={{ color: '#ffd33d' }} className="font-semibold">Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Bottom Decoration */}
        <View className="absolute bottom-0 left-0 right-0 h-32 opacity-10">
          <View className="flex-row justify-between items-end h-full px-6">
            <View className="w-16 h-16 bg-yellow-400 rounded-full" />
            <View className="w-8 h-8 bg-green-400 rounded-full mb-8" />
            <View className="w-12 h-12 bg-blue-400 rounded-full mb-4" />
          </View>
        </View>
      </View>
    </>
  );
}