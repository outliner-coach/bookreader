import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

interface AudioPlayerProps {
  audioBase64: string;
  duration: number;
  onPlaybackComplete?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  duration,
  onPlaybackComplete,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const fileUri = `${FileSystem.cacheDirectory}temp_audio.wav`;
        await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        soundRef.current = newSound;
        if (isMounted) {
          setSound(newSound);
        } else {
          await newSound.unloadAsync();
          soundRef.current = null;
        }
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [audioBase64]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        onPlaybackComplete?.();
      }
    }
  }, [onPlaybackComplete]);

  const togglePlayPause = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const seekTo = async (seconds: number) => {
    if (!sound) return;
    await sound.setPositionAsync(seconds * 1000);
  };

  const changeSpeed = async (speed: number) => {
    if (!sound) return;
    await sound.setRateAsync(speed, true);
    setPlaybackSpeed(speed);
  };

  const restart = async () => {
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5];

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={seekTo}
          minimumTrackTintColor="#4A90D9"
          maximumTrackTintColor="#ddd"
          thumbTintColor="#4A90D9"
        />
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={restart}>
          <Text style={styles.controlIcon}>{"<<"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={togglePlayPause}
        >
          <Text style={styles.playIcon}>{isPlaying ? '||' : '>'}</Text>
        </TouchableOpacity>

        <View style={styles.speedContainer}>
          <Text style={styles.speedLabel}>Speed</Text>
          <View style={styles.speedButtons}>
            {speedOptions.map((speed) => (
              <TouchableOpacity
                key={speed}
                style={[
                  styles.speedButton,
                  playbackSpeed === speed && styles.speedButtonActive,
                ]}
                onPress={() => changeSpeed(speed)}
              >
                <Text
                  style={[
                    styles.speedButtonText,
                    playbackSpeed === speed && styles.speedButtonTextActive,
                  ]}
                >
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  slider: {
    flex: 1,
    marginHorizontal: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    width: 40,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    padding: 12,
    marginHorizontal: 8,
  },
  controlIcon: {
    fontSize: 20,
    color: '#4A90D9',
  },
  playButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  speedContainer: {
    marginLeft: 20,
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  speedButtons: {
    flexDirection: 'row',
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 2,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  speedButtonActive: {
    backgroundColor: '#4A90D9',
  },
  speedButtonText: {
    fontSize: 11,
    color: '#666',
  },
  speedButtonTextActive: {
    color: 'white',
  },
});
