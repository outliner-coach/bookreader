import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../services/api';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Player: {
    text: string;
    audioBase64: string;
    duration: number;
    language: string;
  };
};

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [ttsModelLoaded, setTtsModelLoaded] = useState(false);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    setServerStatus('checking');
    try {
      const health = await apiService.checkHealth();
      setServerStatus('connected');
      setTtsModelLoaded(health.tts_model_loaded);
    } catch (error) {
      setServerStatus('disconnected');
    }
  };

  const handleCameraPress = () => {
    if (serverStatus !== 'connected') {
      Alert.alert(
        'Server Unavailable',
        'Cannot connect to the server. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: checkServerHealth },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    navigation.navigate('Camera');
  };

  const getStatusColor = () => {
    switch (serverStatus) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#F44336';
      default:
        return '#FFC107';
    }
  };

  const getStatusText = () => {
    switch (serverStatus) {
      case 'connected':
        return ttsModelLoaded ? 'Ready' : 'Connected (TTS loading...)';
      case 'disconnected':
        return 'Server Offline';
      default:
        return 'Connecting...';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Storybook Reader</Text>
          <Text style={styles.subtitle}>
            Take a photo of any storybook page{'\n'}and hear it read aloud
          </Text>
        </View>

        {/* Main Action Button */}
        <TouchableOpacity
          style={[
            styles.cameraButton,
            serverStatus !== 'connected' && styles.cameraButtonDisabled,
          ]}
          onPress={handleCameraPress}
          activeOpacity={0.8}
        >
          <Text style={styles.cameraIcon}>CAMERA</Text>
          <Text style={styles.cameraButtonText}>Take Photo</Text>
        </TouchableOpacity>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How to use:</Text>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Point camera at a storybook page</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Capture the image</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Listen to the story!</Text>
          </View>
        </View>

        {/* Server Status */}
        <TouchableOpacity style={styles.statusContainer} onPress={checkServerHealth}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 24,
  },
  cameraButton: {
    backgroundColor: '#4A90D9',
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cameraButtonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: '#BDC3C7',
  },
  cameraIcon: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
    fontWeight: '600',
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90D9',
    color: 'white',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  stepText: {
    fontSize: 15,
    color: '#555',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
});
