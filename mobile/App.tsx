import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const API_URL = 'http://192.168.219.103:8000';

type Screen = 'home' | 'camera' | 'player';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const cameraRef = useRef<CameraView>(null);

  // Player state
  const [extractedText, setExtractedText] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('auto');
  const soundRef = useRef<Audio.Sound | null>(null);
  const ttsRequestId = useRef(0);

  const cleanupSound = async (invalidateRequests = true) => {
    if (invalidateRequests) {
      ttsRequestId.current += 1;
      setIsGeneratingAudio(false);
      setAudioReady(false);
      setTtsError(null);
    }
    const currentSound = soundRef.current;
    if (!currentSound) return;
    try {
      await currentSound.stopAsync();
    } catch {
      // ignore stop errors
    }
    try {
      await currentSound.unloadAsync();
    } catch {
      // ignore unload errors
    }
    soundRef.current = null;
    setSound(null);
    setIsPlaying(false);
  };

  useEffect(() => {
    checkServer();
  }, []);

  useEffect(() => {
    return () => {
      const currentSound = soundRef.current;
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, []);

  const checkServer = async () => {
    setServerStatus('checking');
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        setServerStatus('connected');
      } else {
        setServerStatus('error');
      }
    } catch {
      setServerStatus('error');
    }
  };

  const base64Encoding = FileSystem.EncodingType?.Base64 ?? 'base64';

  const loadAudioFromBase64 = async (audioBase64: string) => {
    const audioUri = `${FileSystem.cacheDirectory}audio.wav`;
    await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
      encoding: base64Encoding,
    });

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
      if (status.isLoaded) {
        setIsPlaying(status.isPlaying);
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      }
    };

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: false },
      onPlaybackStatusUpdate
    );
    soundRef.current = newSound;
    setSound(newSound);
  };

  const generateAudio = async (text: string, language: string) => {
    const requestId = ++ttsRequestId.current;
    setIsGeneratingAudio(true);
    setAudioReady(false);
    setTtsError(null);

    try {
      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          voice_style: 'warm',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Server error');
      }

      const result = await response.json();
      if (ttsRequestId.current !== requestId) return;

      await cleanupSound(false);
      await loadAudioFromBase64(result.audio_base64);
      setAudioReady(true);
    } catch (error) {
      if (ttsRequestId.current !== requestId) return;
      setTtsError(error instanceof Error ? error.message : 'Failed to generate audio');
      setAudioReady(false);
    } finally {
      if (ttsRequestId.current === requestId) {
        setIsGeneratingAudio(false);
      }
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    setLoadingText('Capturing...');

    try {
      await cleanupSound();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('Failed to capture');

      setLoadingText('Processing image...');
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: base64Encoding,
      });

      setLoadingText('Extracting text...');
      const response = await fetch(`${API_URL}/api/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          language: 'auto',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Server error');
      }

      const result = await response.json();
      if (!result.text || !result.text.trim()) {
        throw new Error('No text found in the image');
      }

      setExtractedText(result.text);
      setDetectedLanguage(result.detected_language || 'auto');
      setScreen('player');

      void generateAudio(result.text, result.detected_language || 'auto');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process');
    } finally {
      setIsProcessing(false);
      setLoadingText('');
    }
  };

  const playPause = async () => {
    if (!sound || !audioReady) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  const goHome = async () => {
    await cleanupSound();
    setExtractedText('');
    setDetectedLanguage('auto');
    setScreen('home');
  };

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <Text style={styles.title}>Storybook Reader</Text>
        <Text style={styles.subtitle}>
          Take a photo of a storybook page{'\n'}and hear it read aloud
        </Text>

        <TouchableOpacity
          style={[styles.bigButton, serverStatus !== 'connected' && styles.buttonDisabled]}
          onPress={() => {
            if (serverStatus !== 'connected') {
              Alert.alert('Server not connected', 'Please wait or check connection');
              return;
            }
            if (!permission?.granted) {
              requestPermission();
              return;
            }
            setScreen('camera');
          }}
        >
          <Text style={styles.bigButtonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statusButton} onPress={checkServer}>
          <View style={[styles.statusDot, {
            backgroundColor: serverStatus === 'connected' ? '#4CAF50' :
                           serverStatus === 'error' ? '#F44336' : '#FFC107'
          }]} />
          <Text style={styles.statusText}>
            {serverStatus === 'connected' ? 'Server Ready' :
             serverStatus === 'error' ? 'Server Offline (tap to retry)' : 'Connecting...'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // CAMERA SCREEN
  if (screen === 'camera') {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.containerDark}>
          <Text style={styles.whiteText}>Camera permission required</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.containerDark}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* Guide frame */}
        <View style={styles.overlay}>
          <View style={styles.guideFrame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => setScreen('home')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Capture button */}
        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={isProcessing}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>

        {/* Loading overlay */}
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        )}
      </View>
    );
  }

  // PLAYER SCREEN
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <TouchableOpacity style={styles.headerBack} onPress={goHome}>
        <Text style={styles.headerBackText}>← Home</Text>
      </TouchableOpacity>

      <Text style={styles.playerTitle}>Extracted Text</Text>

      <ScrollView style={styles.textBox}>
        <Text style={styles.extractedText}>{extractedText}</Text>
      </ScrollView>

      {isGeneratingAudio && (
        <Text style={styles.audioStatus}>Generating audio...</Text>
      )}
      {ttsError && (
        <Text style={styles.audioError}>{ttsError}</Text>
      )}

      <View style={styles.playerControls}>
        <TouchableOpacity
          style={[styles.playButton, !audioReady && styles.buttonDisabled]}
          onPress={playPause}
          disabled={!audioReady}
        >
          <Text style={styles.playButtonText}>
            {audioReady ? (isPlaying ? '⏸ Pause' : '▶ Play') : 'Preparing Audio...'}
          </Text>
        </TouchableOpacity>

        {ttsError && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => generateAudio(extractedText, detectedLanguage)}
          >
            <Text style={styles.retryButtonText}>Retry Audio</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.newButton}
          onPress={async () => {
            await cleanupSound();
            setScreen('camera');
          }}
        >
          <Text style={styles.newButtonText}>Take Another Photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    padding: 20,
  },
  containerDark: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 60,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 50,
  },
  bigButton: {
    backgroundColor: '#4A90D9',
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowColor: '#bdc3c7',
  },
  bigButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
    padding: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#7f8c8d',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  whiteText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: '80%',
    aspectRatio: 0.75,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
  },
  captureContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  headerBack: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  headerBackText: {
    color: '#4A90D9',
    fontSize: 16,
  },
  playerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  textBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  extractedText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
  },
  playerControls: {
    width: '100%',
    gap: 12,
  },
  audioStatus: {
    color: '#7f8c8d',
    fontSize: 14,
    marginBottom: 8,
  },
  audioError: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 8,
  },
  playButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  newButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  newButtonText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  retryButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});
