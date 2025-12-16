import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAnimations, useFBX, useTexture } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { CharState } from '../types';

interface Props {
  baseUrl: string;
  idleUrl: string;
  walkUrl: string;
  runUrl: string;
  danceUrl: string;
  targetPos: THREE.Vector3 | null;
  isRunning: boolean;
  onStop: (finalPos: THREE.Vector3) => void;
  isCelebrating: boolean;
  stairConfig: { startZ: number, slopeEndZ: number, wallZ: number, height: number };
}

// Standard Camera offset (Close follow)
const CAM_OFFSET = new THREE.Vector3(0, 3, 6);

// Celebration Camera offset (Pulled back, wider view)
// Z=16 puts camera far back. Y=5 looks down slightly.
const CELEBRATION_OFFSET = new THREE.Vector3(0, 5, 16);

export default function SmartCharacter({ 
  baseUrl, idleUrl, walkUrl, runUrl, danceUrl, 
  targetPos, isRunning, onStop, isCelebrating, stairConfig
}: Props) {
  const group = useRef<THREE.Group>(null);
  const [charState, setCharState] = useState<CharState>(CharState.IDLE);
  const [modelScale, setModelScale] = useState<number>(0.01);
  const { camera } = useThree();

  // --- Load Assets ---
  const baseFbx = useFBX(baseUrl);
  const idleFbx = useFBX(idleUrl);
  const walkFbx = useFBX(walkUrl);
  const runFbx = useFBX(runUrl);
  const danceFbx = useFBX(danceUrl);

  const model = useMemo(() => {
    let clone: THREE.Object3D;
    try {
        // @ts-ignore
        clone = SkeletonUtils.clone(baseFbx);
    } catch (e) {
        clone = baseFbx.clone();
    }
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false; 
      }
    });
    return clone;
  }, [baseFbx]);

  useLayoutEffect(() => {
    // Optimize scale calculation by limiting expensive operations
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true); // true parameter skips updateMatrixWorld
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.001) {
        setModelScale(1.8 / size.y);
    }
  }, [model]);

  const animations = useMemo(() => {
    const modelBones = new Map<string, string>(); 
    model.traverse((obj) => {
        if (obj.type === 'Bone') {
            const simpleName = obj.name.replace(/^.*:/, '').toLowerCase();
            modelBones.set(simpleName, obj.name);
        }
    });

    const processClip = (originalClip: THREE.AnimationClip, name: string, stripPosition: boolean) => {
        const clip = originalClip.clone();
        clip.name = name;
        const newTracks: THREE.KeyframeTrack[] = [];
        const rootBoneKeywords = ['hips', 'root', 'pelvis', 'torso', 'spine'];

        clip.tracks.forEach((track) => {
            const lastDot = track.name.lastIndexOf('.');
            const boneName = track.name.substring(0, lastDot);
            const property = track.name.substring(lastDot + 1);
            const simpleBoneName = boneName.replace(/^.*:/, '').toLowerCase();
            const targetBoneName = modelBones.get(simpleBoneName);
            const isRootBone = rootBoneKeywords.some(k => simpleBoneName.includes(k));

            if (targetBoneName) {
                if (stripPosition && isRootBone && property === 'position') {
                    const values = track.values;
                    const times = track.times;
                    const newValues = new Float32Array(values.length);
                    for (let i = 0; i < values.length; i += 3) {
                        newValues[i] = 0;             
                        newValues[i+1] = values[i+1]; 
                        newValues[i+2] = 0;           
                    }
                    track = new THREE.VectorKeyframeTrack(`${targetBoneName}.${property}`, times as any, newValues as any);
                } else {
                    track.name = `${targetBoneName}.${property}`;
                }
                newTracks.push(track);
            }
        });
        clip.tracks = newTracks;
        return clip;
    };

    const clips: THREE.AnimationClip[] = [];
    if (idleFbx.animations[0]) clips.push(processClip(idleFbx.animations[0], CharState.IDLE, true));
    if (walkFbx.animations[0]) clips.push(processClip(walkFbx.animations[0], CharState.WALK, true));
    if (runFbx.animations[0]) clips.push(processClip(runFbx.animations[0], CharState.RUN, true));
    if (danceFbx.animations[0]) clips.push(processClip(danceFbx.animations[0], CharState.DANCE, true));
    return clips;
  }, [model, idleFbx, walkFbx, runFbx, danceFbx]);

  const { actions } = useAnimations(animations, { current: model } as React.MutableRefObject<THREE.Object3D>);

  // --- State Logic ---
  useEffect(() => {
    if (isCelebrating) {
        setCharState(CharState.DANCE);
    } else if (targetPos) {
      setCharState(isRunning ? CharState.RUN : CharState.WALK);
    } else {
      // Only return to Idle if NOT dancing/celebrating
      if (charState !== CharState.DANCE) {
          setCharState(CharState.IDLE);
      }
    }
  }, [targetPos, isRunning, charState, isCelebrating]);

  // --- Animation Playing ---
  useEffect(() => {
    const currentAction = actions[charState];
    const fadeDuration = 0.3;
    
    Object.keys(actions).forEach((key) => {
        const act = actions[key];
        if (act && key !== charState) act.fadeOut(fadeDuration);
    });

    if (currentAction) {
        currentAction.reset().fadeIn(fadeDuration).play();
        currentAction.setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [charState, actions]);

  // --- Frame Loop (Movement + Camera) ---
  useFrame((state, delta) => {
    if (!group.current) return;
    const currentPos = group.current.position;

    // Reuse vectors to avoid memory allocation
    const tempVec3 = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();

    // 1. Celebration override
    if (isCelebrating) {
        // Simplified rotation calculation
        tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
        group.current.quaternion.slerp(tempQuat, Math.min(5 * delta, 0.5));

        // Position Fix: Move character to the CENTER of the platform
        const centerZ = (stairConfig.slopeEndZ + stairConfig.wallZ) / 2;
        tempVec3.set(0, stairConfig.height, centerZ);
        group.current.position.lerp(tempVec3, Math.min(0.05, delta * 0.5));
    } 
    // 2. Movement Logic
    else if (targetPos) {
      tempVec3.set(targetPos.x, 0, targetPos.z); // flatTarget
      const flatCurrent = new THREE.Vector3(currentPos.x, 0, currentPos.z);
      
      const dist = flatCurrent.distanceTo(tempVec3);
      
      if (dist < 0.2) {
        onStop(currentPos.clone());
        setCharState(CharState.IDLE);
      } else {
        const dir = tempVec3.subVectors(tempVec3, flatCurrent).normalize();
        tempQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        group.current.quaternion.slerp(tempQuat, Math.min(10 * delta, 1));

        const speed = isRunning ? 5.0 : 2.0;
        const moveDist = Math.min(speed * delta, 0.5); // Cap maximum movement per frame
        
        // Move X and Z
        currentPos.x += dir.x * moveDist;
        currentPos.z += dir.z * moveDist;
      }
    }

    // 3. Height Calculation (Stairs vs Platform)
    if (!isCelebrating) {
        if (currentPos.z < stairConfig.slopeEndZ) {
            // On the flat platform - direct assignment is faster
            currentPos.y = stairConfig.height;
        } else {
            // On the stairs (Slope)
            const slopeLength = stairConfig.startZ - stairConfig.slopeEndZ;
            const progress = (stairConfig.startZ - currentPos.z) / slopeLength;
            const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
            currentPos.y = clampedProgress * stairConfig.height;
        }
    }

    // 4. Camera Follow Logic - Simplified for mobile
    const activeOffset = isCelebrating ? CELEBRATION_OFFSET : CAM_OFFSET;
    
    tempVec3.copy(currentPos).add(activeOffset);
    
    // Camera lerp with frame rate compensation
    camera.position.lerp(tempVec3, Math.min(isCelebrating ? 0.02 : 0.05, delta * 0.5));
    
    tempVec3.copy(currentPos).setY(currentPos.y + 1.5);
    camera.lookAt(tempVec3);
  });

  // --- Interaction Handler ---
  const handlePointerDown = (e: any) => {
    e.stopPropagation(); // Stop scene click
    
    if (isCelebrating) return; // Ignore clicks if already finished

    if (targetPos) {
         onStop(group.current?.position.clone() || new THREE.Vector3()); // Stop moving
         setCharState(CharState.IDLE);
    } else {
         // Toggle Dance
         if (charState === CharState.DANCE) setCharState(CharState.IDLE);
         else setCharState(CharState.DANCE);
    }
  };

  return (
    <group ref={group} position={[0,0, stairConfig.startZ]}>
        <primitive 
            object={model} 
            scale={modelScale} 
            onPointerDown={handlePointerDown}
        />
    </group>
  );
}