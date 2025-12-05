export type Lane = -1 | 0 | 1;

export enum ObstacleType {
  FAMILY = 'Family Problems',
  BESTIE = 'Toxic Bestie',
  SOCIETY = 'Society',
  EGO = 'Ego',
  DISTANCE = 'Long Distance'
}

export interface GameObject {
  id: string;
  z: number; // Position in depth
  lane: Lane | number; // Lane for game objects, number for decorations
  type: 'obstacle' | 'heart' | 'decoration';
  label?: string; // For obstacles
  hit?: boolean;
  decorationType?: 'tree' | 'lamp'; // Specific type for decorations
}

export interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  hearts: number;
  speed: number;
  obstaclesHit: string[];
}