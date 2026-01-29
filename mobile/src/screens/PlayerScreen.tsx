import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AudioPlayer } from '../components/AudioPlayer';

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

type PlayerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
};

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
  navigation,
  route,
}) => {
  const { text, audioBase64, duration, language } = route.params;

  const getLanguageLabel = (lang: string): string => {
    switch (lang) {
      case 'ko':
        return 'Korean';
      case 'en':
        return 'English';
      default:
        return lang;
    }
  };

  const handleNewCapture = () => {
    navigation.replace('Camera');
  };

  const handleHome = () => {
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleHome}>
          <Text style={styles.headerButtonText}>{"<"} Home</Text>
        </TouchableOpacity>
        <View style={styles.languageBadge}>
          <Text style={styles.languageBadgeText}>{getLanguageLabel(language)}</Text>
        </View>
      </View>

      {/* Audio Player */}
      <View style={styles.playerContainer}>
        <AudioPlayer
          audioBase64={audioBase64}
          duration={duration}
        />
      </View>

      {/* Extracted Text */}
      <View style={styles.textContainer}>
        <Text style={styles.textLabel}>Extracted Text:</Text>
        <ScrollView style={styles.textScroll} showsVerticalScrollIndicator={true}>
          <Text style={styles.extractedText}>{text}</Text>
        </ScrollView>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.newCaptureButton}
          onPress={handleNewCapture}
          activeOpacity={0.8}
        >
          <Text style={styles.newCaptureButtonText}>Capture Next Page</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '500',
  },
  languageBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  languageBadgeText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  playerContainer: {
    padding: 20,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  textScroll: {
    flex: 1,
  },
  extractedText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  newCaptureButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newCaptureButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
