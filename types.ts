import { AnimationClip, Group } from 'three';

export enum AppState {
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  SIMULATION = 'SIMULATION',
}

export enum ModelType {
  BASE = 'base',
  IDLE = 'idle',
  WALK = 'walk',
  RUN = 'run',
  DANCE = 'dance',
  WALL_BG = 'wall_bg', // Background Image (Image B)
  WALL_FG = 'wall_fg', // Foreground Overlay (Image A)
}

export interface ModelFile {
  type: ModelType;
  file: File | null;
  url: string | null;
}

export interface ModelAnalysis {
  boneCount: number;
  animations: {
    name: string;
    duration: number;
  }[];
}

export enum CharState {
  IDLE = 'IDLE',
  WALK = 'WALK',
  RUN = 'RUN',
  DANCE = 'DANCE',
}

export enum ModelFormat {
  GLB = 'glb',
  FBX = 'fbx',
}

export interface AnimationSet {
  idle: AnimationClip | null;
  walk: AnimationClip | null;
  run: AnimationClip | null;
  dance: AnimationClip | null;
}