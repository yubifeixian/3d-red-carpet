import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAnimations, useFBX, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { CharState, ModelFormat } from '../types';

// 为GLTF加载器添加配置
useGLTF.preload('/model/schoolgirl+3d+model.glb');
useGLTF.preload('/model/Idle.glb');
useGLTF.preload('/model/walk.glb');
useGLTF.preload('/model/Slow Run.glb');
useGLTF.preload('/model/Belly Dance.glb');

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
  modelFormat: ModelFormat;
}

// Standard Camera offset (Close follow)
const CAM_OFFSET = new THREE.Vector3(0, 3, 6);

// Celebration Camera offset (Pulled back, wider view)
// Z=16 puts camera far back. Y=5 looks down slightly.
const CELEBRATION_OFFSET = new THREE.Vector3(0, 5, 16);

// Helper to normalize bone names
const normalizeBoneName = (name: string) => {
  // 1. 统一转小写
  let temp = name.toLowerCase();
  // 2. 移除 mixamorig 前缀 (不管是 mixamorig: 还是 mixamorig_ 还是直接 mixamorig)
  temp = temp.replace(/mixamorig:?_?/g, '');
  // 3. 移除常见的路径分隔符前缀，只保留最后一部分
  // 分隔符包括: : (FBX), | (Blender), / (Path), . (Dot notation if used in names)
  const parts = temp.split(/[:|/.]/);
  return parts[parts.length - 1];
};

// 模糊匹配骨骼
const findBoneFuzzy = (boneMap: Map<string, string>, searchName: string) => {
  // 1. 尝试直接匹配
  const direct = boneMap.get(searchName);
  if (direct) return direct;

  // 2. 尝试去掉所有特殊字符后的匹配
  const cleanSearch = searchName.replace(/[^a-zA-Z0-9]/g, '');
  for (const [key, val] of boneMap.entries()) {
    const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanKey === cleanSearch) return val;
    // 3. 尝试包含匹配 (例如 Hips 匹配 MyCharacter_Hips)
    if (cleanKey.endsWith(cleanSearch) || cleanSearch.endsWith(cleanKey)) return val;
  }
  return null;
};

export default function SmartCharacter({
  baseUrl, idleUrl, walkUrl, runUrl, danceUrl,
  targetPos, isRunning, onStop, isCelebrating, stairConfig, modelFormat
}: Props) {
  const group = useRef<THREE.Group>(null);
  const [charState, setCharState] = useState<CharState>(CharState.IDLE);
  const [modelScale, setModelScale] = useState<number>(0.01);
  const { camera } = useThree();

  // --- Load Assets ---
  // Load models based on their format
  const baseFormat = modelFormat;
  const baseGLTF = baseFormat === ModelFormat.GLB ? useGLTF(baseUrl) : null;
  const baseModel = baseFormat === ModelFormat.GLB ? baseGLTF.scene : useFBX(baseUrl);

  const idleModel = baseFormat === ModelFormat.GLB ? useGLTF(idleUrl) : useFBX(idleUrl);

  const walkModel = baseFormat === ModelFormat.GLB ? useGLTF(walkUrl) : useFBX(walkUrl);

  const runModel = baseFormat === ModelFormat.GLB ? useGLTF(runUrl) : useFBX(runUrl);

  const danceModel = baseFormat === ModelFormat.GLB ? useGLTF(danceUrl) : useFBX(danceUrl);

  // Helper to get animations from either GLTF or FBX
  const getAnimations = (model: any) => {
    // Check if it's a GLTF object with animations
    if (model.animations && Array.isArray(model.animations)) {
      return model.animations;
    }
    // Check if it's an FBX object with animations
    if ((model as any).animations && Array.isArray((model as any).animations)) {
      return (model as any).animations;
    }
    return [];
  };

  const model = useMemo(() => {
    let clone: THREE.Object3D;
    try {
        // @ts-ignore
        clone = SkeletonUtils.clone(baseModel);
    } catch (e) {
        clone = baseModel.clone();
    }
    
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false; 
      }
    });
    return clone;
  }, [baseModel, baseFormat]);

  useLayoutEffect(() => {
    // 1. Reset transforms to baseline
    model.scale.set(1, 1, 1);
    model.rotation.set(0, 0, 0); 
    model.position.set(0, 0, 0);

    // GLB Rotation Fix:
    // 用户反馈模型依然是躺着的。这说明 GLB 资源在 Three.js 中渲染时仍然需要旋转修正。
    // 无论资源是否在 Blender 中"修正"过，如果 Three.js 里躺着，我们就必须把它扶正。
    if (baseFormat === 'glb') {
       model.rotation.x = Math.PI / 2;
    }

    // Update matrix to apply the rotation
    model.updateMatrixWorld(true);
    
    // 2. Compute World Bounding Box from SKINNED MESH GEOMETRY
    let mainMesh: THREE.SkinnedMesh | null = null;
    model.traverse((child) => {
        if (!mainMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
            mainMesh = child as THREE.SkinnedMesh;
        }
    });

    if (mainMesh) {
        // Ensure bounding box exists
        if (!mainMesh.geometry.boundingBox) mainMesh.geometry.computeBoundingBox();
        const geoBox = mainMesh.geometry.boundingBox;

        if (geoBox) {
            const worldBox = geoBox.clone().applyMatrix4(mainMesh.matrixWorld);
            const size = new THREE.Vector3();
            worldBox.getSize(size);
            
            if (size.y > 0.001) {
                const scaleFactor = 1.8 / size.y;
                setModelScale(scaleFactor);

                // Position Fix: 恢复自动对齐逻辑
                // 既然模型需要旋转，那么它的原点和边界框也很可能需要修正才能对齐地面。
                if (baseFormat === 'glb') {
                    // 居中修正 (防止偏移/闪现)
                    // 注意：这里的 center 是基于 worldBox 的，已经包含了旋转
                    // 我们需要反向移动 model 来抵消偏移
                    const center = new THREE.Vector3();
                    worldBox.getCenter(center);
                    
                    model.position.x = -center.x * scaleFactor;
                    model.position.z = -center.z * scaleFactor;
                    
                    // 高度修正：将脚底板放在 0 的位置
                    model.position.y = -worldBox.min.y * scaleFactor;
                }
            }
        }
    } else {
        // Fallback
        const box = new THREE.Box3().setFromObject(model, true);
        const size = new THREE.Vector3();
        box.getSize(size);
        if (size.y > 0.001) {
             const scaleFactor = 1.8 / size.y;
             setModelScale(scaleFactor);
             if (baseFormat === 'glb') {
                 model.position.y = -box.min.y * scaleFactor;
             }
        }
    }
  }, [model, baseFormat]);

  const animations = useMemo(() => {
    const modelBones = new Map<string, string>();
    model.traverse((obj) => {
      if (obj.type === 'Bone') {
        const simpleName = normalizeBoneName(obj.name);
        modelBones.set(simpleName, obj.name);
      }
    });

    const processClip = (originalClip: THREE.AnimationClip, name: string, stripPosition: boolean) => {
        const clip = originalClip.clone();
        clip.name = name;
        const newTracks: THREE.KeyframeTrack[] = [];
        const rootBoneKeywords = ['hips', 'root', 'pelvis', 'torso', 'spine', 'waist'];

        for (let i = 0; i < clip.tracks.length; i++) {
            const track = clip.tracks[i];
            const lastDot = track.name.lastIndexOf('.');
            const boneName = track.name.substring(0, lastDot);
            const property = track.name.substring(lastDot + 1);
            const simpleBoneName = normalizeBoneName(boneName);
            const targetBoneName = findBoneFuzzy(modelBones, simpleBoneName);
            
            const isRootBone = rootBoneKeywords.some(k => simpleBoneName.includes(k)) || 
                               (baseFormat === 'glb' && (simpleBoneName === 'root' || simpleBoneName === 'hips'));

            if (targetBoneName) {
                if (stripPosition && isRootBone && property === 'position') {
                     // 统一逻辑：无论是 GLB 还是 FBX，只要是 In-Place 资源，都剥离位移
                     continue;
                } else {
                    track.name = `${targetBoneName}.${property}`;
                    newTracks.push(track);
                }
            } else if (baseFormat === 'glb') {
                // GLB Smart Fallback: 
                // 如果模糊匹配失败，尝试更激进的匹配策略
                
                // 策略 1: 检查是否是根骨骼移动轨道
                if (property === 'position' && (simpleBoneName.includes('hips') || simpleBoneName.includes('root'))) {
                    // 尝试在 modelBones 中找到 Hips/Root 骨骼
                    const rootBone = findBoneFuzzy(modelBones, 'hips') || findBoneFuzzy(modelBones, 'root');
                    if (rootBone) {
                        // 如果需要剥离位置
                        if (stripPosition) {
                             continue;
                        }
                        // 强制映射到找到的根骨骼
                        track.name = `${rootBone}.${property}`;
                        newTracks.push(track);
                        continue;
                    }
                }

                // 策略 2: 如果还是找不到，保留原始轨道 (Last Resort)
                 newTracks.push(track);
            } else {
                newTracks.push(track);
            }
        }
        clip.tracks = newTracks;
        return clip;
    };

    const clips: THREE.AnimationClip[] = [];
    const idleAnimations = getAnimations(idleModel);
    const walkAnimations = getAnimations(walkModel);
    const runAnimations = getAnimations(runModel);
    const danceAnimations = getAnimations(danceModel);

    // 既然使用了 In-Place 资源，我们对 GLB 也开启位移剥离
    // 这样可以解决"闪回"问题，同时配合 Box3 计算解决"卡在地下"的问题
    const shouldStrip = true;

    if (idleAnimations[0]) clips.push(processClip(idleAnimations[0], CharState.IDLE, shouldStrip));
    if (walkAnimations[0]) clips.push(processClip(walkAnimations[0], CharState.WALK, shouldStrip));
    if (runAnimations[0]) clips.push(processClip(runAnimations[0], CharState.RUN, shouldStrip));
    // 强制对 Dance 也应用剥离逻辑，防止悬空
    if (danceAnimations[0]) clips.push(processClip(danceAnimations[0], CharState.DANCE, shouldStrip));
    return clips;
  }, [model, idleModel, walkModel, runModel, danceModel, getAnimations, baseFormat]);

  const { actions } = useAnimations(animations, { current: model } as React.MutableRefObject<THREE.Object3D>);

  // 初始化所有动画动作，确保它们都处于正确状态
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.keys(actions).forEach((key) => {
        const act = actions[key];
        if (act) {
          // 对于FBX动画，设置clampWhenFinished避免回到T姿态
          act.clampWhenFinished = true;
          // 初始时暂停所有动画，除了idle
          if (key === CharState.IDLE) {
            act.play();
            act.setLoop(THREE.LoopRepeat, Infinity);
            act.weight = 1.0;
          } else {
            act.stop();
            act.weight = 0.0;
          }
        }
      });
    }
  }, [actions]);

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

    // 处理所有动画
    Object.keys(actions).forEach((key) => {
      const act = actions[key];
      if (act) {
        if (key !== charState) {
          act.fadeOut(fadeDuration);
        } else {
          // 确保所有动画都有正确的循环模式和clamp设置
          act.clampWhenFinished = true;
          act.setLoop(THREE.LoopRepeat, Infinity);

          // 对于当前要播放的动画，确保它从当前状态平滑过渡
          if (!act.isRunning() || act.weight <= 0.1) {
            // 如果动画已经停止或权重非常低，需要重新启动
            act.reset();
            act.play();
            act.fadeIn(fadeDuration);
            act.weight = 1.0;
          } else {
            // 如果动画已经在运行，确保它不会重置
            act.weight = 1.0;
            act.play();
          }
        }
      }
    });
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
    <group ref={group} position={[0, 0, stairConfig.startZ]}>
      <primitive
        object={model}
        scale={modelScale}
        onPointerDown={handlePointerDown}
      />
    </group>
  );
}