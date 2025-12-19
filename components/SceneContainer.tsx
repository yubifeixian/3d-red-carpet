import React, { Suspense, useState, useRef, useMemo, useEffect, Component, ErrorInfo } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Loader, Sparkles, useTexture, Grid, Text, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import SmartCharacter from './SmartCharacter';

// Loading Spinner Component
const LoadingSpinner = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += 5 * delta;
    }
  });
  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.3, 16, 32]} />
        <meshStandardMaterial color="#ffd700" opacity={0.7} transparent />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <torusGeometry args={[1, 0.3, 16, 32]} />
        <meshStandardMaterial color="#ffd700" opacity={0.7} transparent />
      </mesh>
    </group>
  );
};

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode; position: [number, number, number] }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; position: [number, number, number] }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SmartCharacter Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <group position={this.props.position}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#ff4444" opacity={0.8} transparent />
          </mesh>
          <Text
            fontSize={0.5}
            position={[0, 3, 0]}
            color="white"
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            Model Loading Error
          </Text>
        </group>
      );
    }

    return this.props.children;
  }
};

import { ModelFormat } from '../types';

// ... existing imports

interface Props {
  baseUrl: string;
  idleUrl: string;
  walkUrl: string;
  runUrl: string;
  danceUrl: string;
  wallBgUrl?: string;
  wallFgUrl?: string;
  modelFormat: ModelFormat;
}

// Scene Geometry Configuration
const STAIR_START_Z = 8;     // Start of the ramp (bottom)
const SLOPE_END_Z = -4;      // Where stairs end and platform begins
const WALL_Z = -12;          // Where the back wall is
const STAIR_HEIGHT = 5;      // Height of the top platform

const SLOPE_LENGTH = STAIR_START_Z - SLOPE_END_Z; // 12
const PLATFORM_LENGTH = SLOPE_END_Z - WALL_Z;     // 8

// Playable area boundaries
const CARPET_WIDTH_LIMIT = 2.2; 

// --- Decorative Components ---

// 1. Crowd / Audience System
const CrowdMember: React.FC<{ position: [number, number, number], color: string, scale?: number }> = ({ position, color, scale = 1 }) => {
    return (
        <group position={position} scale={[scale, scale, scale]}>
            {/* Body */}
            <mesh position={[0, 0.75, 0]} castShadow>
                <cylinderGeometry args={[0.2, 0.25, 1.5, 8]} />
                <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.2} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.6, 0]} castShadow>
                <sphereGeometry args={[0.18, 8, 8]} />
                <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.2} />
            </mesh>
        </group>
    );
};

const Audience = () => {
    // Generate crowd positions with reduced count for mobile
    const crowdData = useMemo(() => {
        const items: { pos: [number, number, number]; color: string; scale: number }[] = [];
        // Reduce crowd size by 70% for better mobile performance
        const countPerSide = window.innerWidth < 768 ? 20 : 70;
        
        for (let i = 0; i < countPerSide; i++) {
            // Distribute along the entire Z depth (Slope + Platform)
            const z = STAIR_START_Z - (Math.random() * (STAIR_START_Z - WALL_Z));
            
            // Calculate Height (Y) based on location
            let y = 0;
            if (z < SLOPE_END_Z) {
                // On Platform
                y = STAIR_HEIGHT;
            } else {
                // On Slope
                const progress = (STAIR_START_Z - z) / SLOPE_LENGTH;
                y = progress * STAIR_HEIGHT;
            }

            // X offsets (Outside the red carpet)
            const xLeft = -3.5 - (Math.random() * 0.5) - (Math.pow(Math.random(), 2) * 5.0); 
            const xRight = 3.5 + (Math.random() * 0.5) + (Math.pow(Math.random(), 2) * 5.0);

            const scale = 0.9 + Math.random() * 0.2;
            const colors = ["#cbd5e1", "#94a3b8", "#64748b", "#fbcfe8", "#334155", "#475569", "#1e293b"];
            const color = colors[Math.floor(Math.random() * colors.length)];

            items.push({ pos: [xLeft, y, z] as [number, number, number], color, scale });
            items.push({ pos: [xRight, y, z] as [number, number, number], color, scale });
        }
        return items;
    }, []);

    return (
        <group>
            {crowdData.map((item, idx) => (
                <CrowdMember key={idx} position={item.pos} color={item.color} scale={item.scale} />
            ))}
        </group>
    );
};

// 2. Celebration Effects
const PaparazziFlash = () => {
    const lightRef = useRef<THREE.PointLight>(null);
    useFrame(() => {
        if (!lightRef.current) return;
        // Reduce flash frequency on mobile
        const threshold = window.innerWidth < 768 ? 0.97 : 0.92;
        if (Math.random() > threshold) { 
            const x = (Math.random() - 0.5) * 12; 
            const y = STAIR_HEIGHT + 2 + Math.random() * 5;
            const z = WALL_Z + 2 + (Math.random() * 8); 
            lightRef.current.position.set(x, y, z);
            // Reduce intensity on mobile
            lightRef.current.intensity = window.innerWidth < 768 ? 15 + Math.random() * 15 : 20 + Math.random() * 30;
        } else {
            lightRef.current.intensity *= 0.7;
        }
    });
    return <pointLight ref={lightRef} distance={30} decay={2} color="white" intensity={0} />;
};

const CelebrationEffects = ({ active }: { active: boolean }) => {
    const spotLightTarget = useMemo(() => {
        const obj = new THREE.Object3D();
        // Target the center of the platform
        obj.position.set(0, STAIR_HEIGHT, (SLOPE_END_Z + WALL_Z) / 2); 
        return obj;
    }, []);

    // Reduce number of paparazzi flashes on mobile
    const paparazziCount = window.innerWidth < 768 ? 2 : 4;

    return (
        <group>
            <primitive object={spotLightTarget} />
            <SpotLight
                position={[0, 15, WALL_Z + 12]} 
                target={spotLightTarget}
                angle={window.innerWidth < 768 ? 0.4 : 0.3}
                penumbra={window.innerWidth < 768 ? 0.2 : 0.4}
                intensity={active ? (window.innerWidth < 768 ? 40 : 80) : 0}
                distance={40}
                color="#fff"
                castShadow={window.innerWidth >= 768}
                attenuation={5}
                anglePower={5}
                opacity={active ? 1 : 0}
            />
            {active && (
                <>
                    {[...Array(paparazziCount)].map((_, i) => (
                        <PaparazziFlash key={i} />
                    ))}
                </>
            )}
        </group>
    );
};

const Stanchion = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.15, 0.15, 0.05, 32]} />
      <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.02, 0.02, 1, 16]} />
      <meshStandardMaterial color="#f59e0b" metalness={1} roughness={0.1} />
    </mesh>
    <mesh position={[0, 1.0, 0]} castShadow>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial color="#f59e0b" metalness={1} roughness={0.1} />
    </mesh>
  </group>
);

const Rope = ({ start, end }: { start: [number, number, number], end: [number, number, number] }) => {
    const mid = [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2 - 0.2, 
        (start[2] + end[2]) / 2
    ];
    const curve = useMemo(() => {
        const vStart = new THREE.Vector3(...start);
        const vMid = new THREE.Vector3(...mid);
        const vEnd = new THREE.Vector3(...end);
        return new THREE.QuadraticBezierCurve3(vStart, vMid, vEnd);
    }, [start, mid, end]);

    const points = useMemo(() => curve.getPoints(10), [curve]);

    return (
        <line>
            <bufferGeometry>
                <bufferAttribute 
                    attach="attributes-position" 
                    count={points.length} 
                    array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))} 
                    itemSize={3} 
                />
            </bufferGeometry>
            <lineBasicMaterial color="#991b1b" linewidth={3} />
        </line>
    );
}

const Staircase = () => {
    // 1. Generate Steps (Slope Part)
    const stepCount = 24;
    const stepDepth = SLOPE_LENGTH / stepCount;
    const stepHeight = STAIR_HEIGHT / stepCount;

    const steps = useMemo(() => {
        return new Array(stepCount).fill(0).map((_, i) => {
            const z = STAIR_START_Z - (i * stepDepth) - (stepDepth/2);
            const y = (i * stepHeight) + (stepHeight/2);
            return { position: [0, y, z] as [number, number, number], args: [5, stepHeight, stepDepth] as [number, number, number] };
        });
    }, [stepCount, stepDepth, stepHeight]);

    // 2. Generate Stanchions (Along slope AND platform)
    const posts = useMemo(() => {
        const p: { left: [number, number, number], right: [number, number, number] }[] = [];
        
        // Slope Posts
        const slopePostCount = 6;
        for (let i = 0; i < slopePostCount; i++) {
            const progress = i / (slopePostCount - 1);
            const z = STAIR_START_Z - (progress * SLOPE_LENGTH);
            const y = progress * STAIR_HEIGHT;
            p.push({ left: [-2.5, y, z], right: [2.5, y, z] });
        }

        // Platform Posts
        const platformPostCount = 4;
        const platformLen = Math.abs(WALL_Z - SLOPE_END_Z);
        for (let i = 1; i < platformPostCount; i++) {
             const dist = (i / (platformPostCount - 1)) * platformLen;
             const z = SLOPE_END_Z - dist;
             p.push({ left: [-2.5, STAIR_HEIGHT, z], right: [2.5, STAIR_HEIGHT, z] });
        }

        return p;
    }, []);

    return (
        <group>
            {/* Steps (Slope) */}
            {steps.map((step, i) => (
                 <mesh key={i} position={step.position} receiveShadow castShadow>
                    <boxGeometry args={step.args} />
                    <meshStandardMaterial color="#991b1b" roughness={0.6} />
                 </mesh>
            ))}

            {/* Flat Platform at Top */}
            <mesh 
                position={[0, STAIR_HEIGHT - 0.1, (SLOPE_END_Z + WALL_Z) / 2]} 
                receiveShadow 
                castShadow
            >
                <boxGeometry args={[5, 0.2, Math.abs(SLOPE_END_Z - WALL_Z)]} />
                <meshStandardMaterial color="#991b1b" roughness={0.6} />
            </mesh>

             {/* Stanchions and Ropes */}
             {posts.map((pos, i) => (
                 <React.Fragment key={i}>
                     <Stanchion position={pos.left} />
                     <Stanchion position={pos.right} />
                     {i < posts.length - 1 && (
                         <>
                             <Rope start={[pos.left[0], pos.left[1]+0.9, pos.left[2]]} end={[posts[i+1].left[0], posts[i+1].left[1]+0.9, posts[i+1].left[2]]} />
                             <Rope start={[pos.right[0], pos.right[1]+0.9, pos.right[2]]} end={[posts[i+1].right[0], posts[i+1].right[1]+0.9, posts[i+1].right[2]]} />
                         </>
                     )}
                 </React.Fragment>
             ))}
        </group>
    );
};

interface WallLayerProps {
    url: string;
    width: number;
    height: number;
    transparent?: boolean;
    zOffset: number;
}

const WallLayer = ({ url, width, height, transparent = false, zOffset }: WallLayerProps) => {
    const texture = useTexture(url);
    useEffect(() => {
        if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
        }
    }, [texture]);
    return (
        <mesh position={[0, 0, zOffset]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={texture} transparent={transparent} toneMapped={false} color="white" side={THREE.DoubleSide} />
        </mesh>
    );
};

const SignatureWall = ({ signature, bgUrl, fgUrl }: { signature: string, bgUrl?: string, fgUrl?: string }) => {
    const WALL_W = 14; 
    const WALL_H = 7;
    // Align bottom of wall with platform height
    const CENTER_Y = STAIR_HEIGHT + (WALL_H / 2);

    const Z_FRAME = -0.3;
    const Z_BASE  = -0.15;
    const Z_GRID  = -0.05;
    const Z_BG    = 0.1;  
    const Z_FG    = 0.2;  
    const Z_TEXT  = 0.6;  

    return (
        <group position={[0, CENTER_Y, WALL_Z]}>
            {/* Frame */}
            <mesh position={[0, 0, Z_FRAME]} castShadow receiveShadow>
                <boxGeometry args={[WALL_W + 0.5, WALL_H + 0.5, 0.5]} />
                <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} />
            </mesh>
            {/* Base Wall */}
            <mesh position={[0, 0, Z_BASE]} receiveShadow>
                <planeGeometry args={[WALL_W, WALL_H]} />
                <meshStandardMaterial color="#334155" roughness={0.4} />
            </mesh>

            {!bgUrl && (
                <group position={[0, 0, Z_GRID]}>
                     <Grid args={[WALL_W, WALL_H]} cellSize={1} cellThickness={1} cellColor="#64748b" sectionSize={5} sectionThickness={1.5} sectionColor="#94a3b8" fadeDistance={20} infiniteGrid={false} rotation={[Math.PI/2, 0, 0]} />
                </group>
            )}

            <Suspense fallback={
                <mesh position={[0, CENTER_Y, Z_BG]}>
                    <planeGeometry args={[WALL_W, WALL_H]} />
                    <meshStandardMaterial color="#2d3748" opacity={0.5} transparent />
                </mesh>
            }>
                {bgUrl && <WallLayer url={bgUrl} width={WALL_W} height={WALL_H} zOffset={Z_BG} />}
                {fgUrl && <WallLayer url={fgUrl} width={WALL_W} height={WALL_H} transparent zOffset={Z_FG} />}
            </Suspense>

            <Text
                fontSize={0.85} maxWidth={WALL_W - 2} lineHeight={1} letterSpacing={0.05} textAlign="center" anchorX="center" anchorY="middle"
                position={[0, -1.35, Z_TEXT]} color={signature ? "#FFD700" : "rgba(255,255,255,0.5)"} outlineWidth={signature ? 0.04 : 0} outlineColor="#000000"
            >
                {signature || "AWAITING STAR"}
            </Text>
        </group>
    )
}

export default function SceneContainer(props: Props) {
  const [targetPos, setTargetPos] = useState<THREE.Vector3 | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [signature, setSignature] = useState("");
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPointerDown = useRef(false);

  // Helper to process input coordinates
  const getRestrictedPoint = (e: ThreeEvent<PointerEvent>) => {
      const point = e.point.clone();
      // Restrict movement to Red Carpet Width
      point.x = THREE.MathUtils.clamp(point.x, -CARPET_WIDTH_LIMIT, CARPET_WIDTH_LIMIT);
      // Restrict Z from Start to Wall
      point.z = THREE.MathUtils.clamp(point.z, WALL_Z + 1, STAIR_START_Z + 2);
      return point;
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (showInput || isCelebrating) return; 
    e.stopPropagation();
    isPointerDown.current = true;
    
    const point = getRestrictedPoint(e);
    setTargetPos(point);
    setIsRunning(false); 

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (isPointerDown.current) setIsRunning(true);
    }, 250); 
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isPointerDown.current && !showInput && !isCelebrating) {
        const point = getRestrictedPoint(e);
        setTargetPos(point);
    }
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
    setIsRunning(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCharacterStop = (finalPos: THREE.Vector3) => {
    setTargetPos(null);
    setIsRunning(false);

    // Trigger signature when reaching the platform area (past the slope)
    if (finalPos.z <= SLOPE_END_Z + 1 && !signature) {
        setShowInput(true);
    }
  };

  const submitSignature = () => {
      if (inputValue.trim()) {
          setSignature(inputValue.trim());
          setShowInput(false);
          setIsCelebrating(true); 
      }
  };
  
  // Calculate Slope Rotation
  // Slope rises STAIR_HEIGHT over SLOPE_LENGTH
  // Angle = Math.atan(STAIR_HEIGHT / SLOPE_LENGTH)
  const slopeAngle = Math.atan(STAIR_HEIGHT / SLOPE_LENGTH);
  const slopeHypotenuse = Math.sqrt(Math.pow(SLOPE_LENGTH, 2) + Math.pow(STAIR_HEIGHT, 2));

  return (
    <div className="w-full h-full bg-black relative">
      <Canvas 
        gl={{ 
          antialias: false, // Completely disable antialias on mobile
          alpha: false,
          powerPreference: 'default', // Never use high-performance on mobile
          preserveDrawingBuffer: false,
          depth: true,
          stencil: false, // Disable stencil buffer to save memory
        }}
        shadows={false} // Force disable shadows everywhere for stability first
        dpr={window.innerWidth < 768 ? 1.0 : [1, 2]} // Strict 1.0 DPR on mobile
        performance={{ min: 0.1, max: 0.2 }}
        onCreated={({ gl }) => {
            // Force context loss handling
            gl.domElement.addEventListener('webglcontextlost', (event) => {
                event.preventDefault();
                console.warn('WebGL Context Lost!');
            });
            gl.domElement.addEventListener('webglcontextrestored', () => {
                console.log('WebGL Context Restored');
            });
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 6, 15]} fov={window.innerWidth < 768 ? 60 : 45} />
        
        <ambientLight intensity={0.5} /> 
        <directionalLight position={[5, 10, 10]} intensity={window.innerWidth < 768 ? 0.8 : 1.0} castShadow={window.innerWidth >= 768} shadow-bias={-0.0001} />
        <pointLight position={[0, 10, WALL_Z + 5]} intensity={1} color="#ffd700" distance={20} />
        <Environment preset="night" />

        <Staircase />
        <Audience />
        <SignatureWall signature={signature} bgUrl={props.wallBgUrl} fgUrl={props.wallFgUrl} />
        <CelebrationEffects active={isCelebrating} />

        {/* Interaction Group with Precise Meshes */}
        <group>
            {/* 1. Slope Interaction Plane */}
            <mesh 
                rotation={[-Math.PI / 2 + slopeAngle, 0, 0]} 
                position={[0, STAIR_HEIGHT/2, (STAIR_START_Z + SLOPE_END_Z)/2]} 
                visible={false} // Invisible but raycastable
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* slightly larger width to catch edge clicks */}
                <planeGeometry args={[20, slopeHypotenuse]} />
            </mesh>

            {/* 2. Platform Interaction Plane */}
            <mesh 
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, STAIR_HEIGHT, (SLOPE_END_Z + WALL_Z)/2]} 
                visible={false} 
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <planeGeometry args={[20, Math.abs(WALL_Z - SLOPE_END_Z)]} />
            </mesh>
        </group>

        <Sparkles count={80} scale={[10, 8, 20]} size={6} speed={0.4} opacity={0.5} color="#fff" position={[0, 4, 0]} />

        <Suspense fallback={<LoadingSpinner position={[0, STAIR_HEIGHT, STAIR_START_Z]} />}>
          <ErrorBoundary position={[0, STAIR_HEIGHT, STAIR_START_Z]}>
            <SmartCharacter 
              {...props} 
              targetPos={targetPos}
              isRunning={isRunning}
              onStop={handleCharacterStop}
              isCelebrating={isCelebrating}
              stairConfig={{ 
                  startZ: STAIR_START_Z, 
                  slopeEndZ: SLOPE_END_Z, 
                  wallZ: WALL_Z,
                  height: STAIR_HEIGHT 
              }}
            />
          </ErrorBoundary>
        </Suspense>
      </Canvas>
      
      {showInput && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-in fade-in">
              <div className="bg-slate-900 p-8 rounded-2xl border border-yellow-500/30 shadow-2xl shadow-yellow-500/10 max-w-md w-full text-center">
                  <h2 className="text-2xl font-bold text-yellow-500 mb-2">Welcome to the Gala</h2>
                  <p className="text-slate-400 mb-6">Please sign your name on the Wall of Fame.</p>
                  <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Your Name (English)..." 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 mb-6 text-lg text-center font-sans"
                    maxLength={15}
                    onKeyDown={(e) => e.key === 'Enter' && submitSignature()}
                    autoFocus
                  />
                  <button 
                    onClick={submitSignature}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold py-3 rounded-lg hover:brightness-110 transition-all transform active:scale-95"
                  >
                      Sign & Celebrate
                  </button>
              </div>
          </div>
      )}
      <Loader />
    </div>
  );
}