import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Stars, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Lane, GameObject, ObstacleType } from '../types';

// Augment JSX to satisfy TypeScript for Three.js elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      ambientLight: any;
      directionalLight: any;
      fog: any;
    }
  }
}

// Constants
const LANE_WIDTH = 2.5;
const SPEED_MULTIPLIER = 2.0; 
const PLAYER_Z = 0;
const SOUL_Z = -8; 
const SPAWN_DISTANCE = -120; 
const REMOVE_DISTANCE = 10; 

// Colors
const SKIN_COLOR = "#ffdbac";
const AMMU_SHIRT = "#ec4899"; // Pink
const AMMU_SKIRT = "#be185d";
const SOUL_SHIRT = "#3b82f6"; // Blue
const SOUL_JEANS = "#1e3a8a";
const HAIR_COLOR = "#0f0f0f"; // Jet Black
const HEART_COLOR = "#ef4444";
const SHOE_WHITE = "#f8fafc";
const TREE_GREEN = "#166534";
const TREE_TRUNK = "#3f2c22";

// --- AUDIO SYSTEM ---
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

export const resumeAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

const playSound = (type: 'step' | 'heart' | 'hit' | 'move') => {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (type === 'step') {
        // Soft thud
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'move') {
        // Swoosh
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(400, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'heart') {
        // Ding
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'hit') {
        // Crash
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    }
};

// --- 3D Components ---

const RoadStripes = ({ speed }: { speed: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Move stripes towards camera (+Z)
      groupRef.current.position.z += speed * delta * SPEED_MULTIPLIER;
      // Reset position to create infinite loop effect
      if (groupRef.current.position.z > 10) {
        groupRef.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Create multiple stripes along the road */}
      {Array.from({ length: 20 }).map((_, i) => (
        <React.Fragment key={i}>
            {/* Left Lane Line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.25, -0.49, -i * 10]}>
                <planeGeometry args={[0.15, 4]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Right Lane Line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.25, -0.49, -i * 10]}>
                <planeGeometry args={[0.15, 4]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
        </React.Fragment>
      ))}
    </group>
  );
};

const StaticGround = () => {
  return (
    <group>
      {/* Dark Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -50]} receiveShadow>
        <planeGeometry args={[20, 300]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* Side Grass Left */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, -0.51, -50]} receiveShadow>
         <planeGeometry args={[20, 300]} />
         <meshStandardMaterial color="#064e3b" />
      </mesh>
      {/* Side Grass Right */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, -0.51, -50]} receiveShadow>
         <planeGeometry args={[20, 300]} />
         <meshStandardMaterial color="#064e3b" />
      </mesh>
    </group>
  );
};

const VoxelBox = ({ position, args, color, ...props }: any) => (
  <mesh position={position} castShadow receiveShadow {...props}>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} roughness={0.7} />
  </mesh>
);

const AmmuCharacter = ({ lane, isRunning }: { lane: Lane; isRunning: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const hairLeftRef = useRef<THREE.Group>(null);
  const hairRightRef = useRef<THREE.Group>(null);
  const lastStepTime = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Smooth Lane Transition
    const targetX = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, delta * 12);
    
    // Running Animation
    if (isRunning) {
        const time = state.clock.elapsedTime * 12;
        const bounce = Math.abs(Math.sin(time));
        groupRef.current.position.y = -0.5 + bounce * 0.1; 
        
        // Footstep Sound logic: trigger when bounce is near minimum (hitting ground)
        // Check if we just crossed the threshold to play sound once per step
        if (bounce < 0.2 && state.clock.elapsedTime - lastStepTime.current > 0.3) {
            playSound('step');
            lastStepTime.current = state.clock.elapsedTime;
        }

        // Limbs
        if(leftLegRef.current && rightLegRef.current && leftArmRef.current && rightArmRef.current) {
            leftLegRef.current.rotation.x = Math.sin(time) * 0.8;
            rightLegRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
            leftArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
            rightArmRef.current.rotation.x = Math.sin(time) * 0.8;
        }

        // Hair Sway
        if(hairLeftRef.current && hairRightRef.current) {
            hairLeftRef.current.rotation.z = 0.1 + Math.sin(time) * 0.15;
            hairRightRef.current.rotation.z = -0.1 - Math.sin(time) * 0.15;
        }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.5, PLAYER_Z]}>
        {/* === AMMU BODY === */}
        
        {/* Skirt */}
        <VoxelBox position={[0, 0.6, 0]} args={[0.55, 0.35, 0.4]} color={AMMU_SKIRT} />
        
        {/* Torso (Pink Shirt) */}
        <VoxelBox position={[0, 1.05, 0]} args={[0.5, 0.55, 0.3]} color={AMMU_SHIRT} />
        
        {/* Name Tag (Back) - REMOVED ROTATION TO FIX MIRRORING */}
        <Text 
          position={[0, 1.05, 0.16]} 
          fontSize={0.14} 
          color="white" 
          anchorX="center" 
          anchorY="middle"
        >
            AMMU
        </Text>

        {/* Head */}
        <VoxelBox position={[0, 1.5, 0]} args={[0.35, 0.35, 0.35]} color={SKIN_COLOR} />
        
        {/* === HAIR (Detailed) === */}
        {/* Top */}
        <VoxelBox position={[0, 1.68, 0]} args={[0.37, 0.1, 0.37]} color={HAIR_COLOR} />
        {/* Back (Short center to show name) */}
        <VoxelBox position={[0, 1.5, 0.18]} args={[0.36, 0.35, 0.05]} color={HAIR_COLOR} />
        
        {/* Ponytails */}
        <group ref={hairLeftRef} position={[-0.25, 1.5, 0.1]}>
             <VoxelBox position={[0, -0.2, 0]} args={[0.15, 0.5, 0.15]} color={HAIR_COLOR} />
        </group>
        <group ref={hairRightRef} position={[0.25, 1.5, 0.1]}>
             <VoxelBox position={[0, -0.2, 0]} args={[0.15, 0.5, 0.15]} color={HAIR_COLOR} />
        </group>

        {/* === LEGS === */}
        <group ref={leftLegRef} position={[-0.15, 0.45, 0]}>
             <VoxelBox position={[0, -0.25, 0]} args={[0.14, 0.5, 0.14]} color={SKIN_COLOR} />
             <VoxelBox position={[0, -0.5, 0.02]} args={[0.15, 0.12, 0.22]} color={SHOE_WHITE} /> 
             <VoxelBox position={[0, -0.55, 0.02]} args={[0.15, 0.02, 0.22]} color={AMMU_SKIRT} /> 
        </group>
        <group ref={rightLegRef} position={[0.15, 0.45, 0]}>
             <VoxelBox position={[0, -0.25, 0]} args={[0.14, 0.5, 0.14]} color={SKIN_COLOR} />
             <VoxelBox position={[0, -0.5, 0.02]} args={[0.15, 0.12, 0.22]} color={SHOE_WHITE} />
             <VoxelBox position={[0, -0.55, 0.02]} args={[0.15, 0.02, 0.22]} color={AMMU_SKIRT} /> 
        </group>

        {/* === ARMS === */}
        <group ref={leftArmRef} position={[-0.32, 1.2, 0]}>
            <VoxelBox position={[0, -0.2, 0]} args={[0.12, 0.45, 0.12]} color={SKIN_COLOR} />
            <VoxelBox position={[0, 0.1, 0]} args={[0.13, 0.15, 0.13]} color={AMMU_SHIRT} />
        </group>
        <group ref={rightArmRef} position={[0.32, 1.2, 0]}>
            <VoxelBox position={[0, -0.2, 0]} args={[0.12, 0.45, 0.12]} color={SKIN_COLOR} />
            <VoxelBox position={[0, 0.1, 0]} args={[0.13, 0.15, 0.13]} color={AMMU_SHIRT} />
        </group>
    </group>
  );
};

const SoulCharacter = ({ isRunning }: { isRunning: boolean }) => {
    const groupRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
  
    useFrame((state, delta) => {
      if (!groupRef.current) return;
  
      const wobble = Math.sin(state.clock.elapsedTime * 1.0) * 0.8;
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, wobble, delta * 2);
  
      if (isRunning) {
          const time = state.clock.elapsedTime * 12 + 1; 
          groupRef.current.position.y = -0.5 + Math.abs(Math.sin(time)) * 0.1;
          
          if(leftLegRef.current && rightLegRef.current && leftArmRef.current && rightArmRef.current) {
            leftLegRef.current.rotation.x = Math.sin(time) * 0.8;
            rightLegRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
            leftArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
            rightArmRef.current.rotation.x = Math.sin(time) * 0.8;
          }
      }
    });
  
    return (
      <group ref={groupRef} position={[0, -0.5, SOUL_Z]}>
          {/* === SOUL BODY === */}
          
          {/* Jeans */}
          <VoxelBox position={[0, 0.6, 0]} args={[0.5, 0.35, 0.35]} color={SOUL_JEANS} />
          
          {/* Shirt */}
          <VoxelBox position={[0, 1.05, 0]} args={[0.52, 0.55, 0.32]} color={SOUL_SHIRT} />
          
          {/* Name Tag (Back) - REMOVED ROTATION TO FIX MIRRORING */}
          <Text 
            position={[0, 1.05, 0.17]} 
            fontSize={0.14} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
          >
              SOUL
          </Text>
  
          {/* Head */}
          <VoxelBox position={[0, 1.5, 0]} args={[0.36, 0.36, 0.36]} color={SKIN_COLOR} />
          
          {/* Hair */}
          <VoxelBox position={[0, 1.5, 0.19]} args={[0.38, 0.3, 0.05]} color={HAIR_COLOR} />
          <VoxelBox position={[0, 1.7, 0]} args={[0.38, 0.12, 0.38]} color={HAIR_COLOR} />
  
          {/* Legs */}
          <group ref={leftLegRef} position={[-0.15, 0.45, 0]}>
               <VoxelBox position={[0, -0.25, 0]} args={[0.17, 0.5, 0.17]} color={SOUL_JEANS} />
               <VoxelBox position={[0, -0.5, 0.02]} args={[0.18, 0.12, 0.24]} color="#333" />
          </group>
          <group ref={rightLegRef} position={[0.15, 0.45, 0]}>
               <VoxelBox position={[0, -0.25, 0]} args={[0.17, 0.5, 0.17]} color={SOUL_JEANS} />
               <VoxelBox position={[0, -0.5, 0.02]} args={[0.18, 0.12, 0.24]} color="#333" />
          </group>
  
          {/* Arms */}
          <group ref={leftArmRef} position={[-0.34, 1.2, 0]}>
              <VoxelBox position={[0, -0.2, 0]} args={[0.14, 0.45, 0.14]} color={SKIN_COLOR} />
              <VoxelBox position={[0, 0.1, 0]} args={[0.15, 0.15, 0.15]} color={SOUL_SHIRT} />
          </group>
          <group ref={rightArmRef} position={[0.34, 1.2, 0]}>
              <VoxelBox position={[0, -0.2, 0]} args={[0.14, 0.45, 0.14]} color={SKIN_COLOR} />
              <VoxelBox position={[0, 0.1, 0]} args={[0.15, 0.15, 0.15]} color={SOUL_SHIRT} />
          </group>
      </group>
    );
  };

const Decoration = ({ data }: { data: GameObject }) => {
    // Environmental decor
    if (data.decorationType === 'tree') {
        return (
            <group position={[data.lane, 0, data.z]}>
                <mesh position={[0, 0.75, 0]} castShadow>
                    <cylinderGeometry args={[0.2, 0.3, 1.5, 8]} />
                    <meshStandardMaterial color={TREE_TRUNK} />
                </mesh>
                <mesh position={[0, 2, 0]} castShadow>
                    <coneGeometry args={[1, 2.5, 8]} />
                    <meshStandardMaterial color={TREE_GREEN} />
                </mesh>
            </group>
        );
    } 
    // Lamp
    return (
        <group position={[data.lane, 0, data.z]}>
            <mesh position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
                <meshStandardMaterial color="#64748b" />
            </mesh>
            <mesh position={[0, 3, 0.4]}>
                <boxGeometry args={[0.2, 0.1, 0.8]} />
                <meshStandardMaterial color="#64748b" />
            </mesh>
            <mesh position={[0, 2.9, 0.7]}>
                <boxGeometry args={[0.15, 0.1, 0.3]} />
                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={2} />
            </mesh>
        </group>
    );
}

const Obstacle = ({ data }: { data: GameObject }) => {
  return (
    <group position={[data.lane * LANE_WIDTH, 0, data.z]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.5, 0.5]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.9, 1.6, 0.4]} />
        <meshStandardMaterial color="#ef4444" wireframe />
      </mesh>
      
      <Text
        position={[0, 0.75, 0.26]} 
        fontSize={0.22}
        color="white"
        maxWidth={1.6}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {data.label}
      </Text>
    </group>
  );
};

const Heart = ({ data }: { data: GameObject }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            ref.current.rotation.y += 0.03;
            ref.current.position.y = 1.0 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
        }
    })

    return (
      <group ref={ref} position={[data.lane * LANE_WIDTH, 0, data.z]}>
        <Text
            fontSize={1.2}
            color={HEART_COLOR}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#991b1b"
        >
            ❤
        </Text>
      </group>
    );
  };

// --- Main Controller ---

const SceneController = ({ 
  gameState, 
  setGameState,
  onGameOver 
}: { 
  gameState: GameState, 
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameOver: (state: GameState) => void
}) => {
  const [lane, setLane] = useState<Lane>(0);
  const [objects, setObjects] = useState<GameObject[]>([]);
  
  const moveLane = (dir: 1 | -1) => {
      setLane(prev => {
          const next = Math.max(-1, Math.min(1, prev + dir)) as Lane;
          if (next !== prev) playSound('move');
          return next;
      });
  }

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.isPlaying) return;
      if (e.key === 'ArrowLeft') moveLane(-1);
      if (e.key === 'ArrowRight') moveLane(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isPlaying]);

  const touchStartX = useRef(0);
  useEffect(() => {
      const handleTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
      const handleTouchEnd = (e: TouchEvent) => {
          if (!gameState.isPlaying) return;
          const diff = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(diff) > 30) {
              if (diff > 0) moveLane(1);
              else moveLane(-1);
          }
      };
      window.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
          window.removeEventListener('touchstart', handleTouchStart);
          window.removeEventListener('touchend', handleTouchEnd);
      }
  }, [gameState.isPlaying]);


  // Game Loop
  useFrame((state, delta) => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    // Move everything closer to Z=0 (where player is)
    // We want objects to come FROM -100 TO +10.
    const moveDistance = gameState.speed * delta * SPEED_MULTIPLIER;
    const newScore = gameState.score + (moveDistance * 5);

    let hitObstacle = false;
    let collectedHeart = false;
    let hitLabel = "";

    const updatedObjects = objects.map(obj => {
        const newZ = obj.z + moveDistance;
        let newHit = obj.hit;

        // Collision Logic
        if (obj.type !== 'decoration' && !obj.hit && Math.abs(newZ - PLAYER_Z) < 0.8 && obj.lane === lane) {
            newHit = true;
            if (obj.type === 'obstacle') {
                hitObstacle = true;
                hitLabel = obj.label || "Problem";
            } else if (obj.type === 'heart') {
                collectedHeart = true;
            }
        }
        return { ...obj, z: newZ, hit: newHit };
    }).filter(obj => obj.z < REMOVE_DISTANCE);

    // Spawning Logic
    const furthestZ = updatedObjects.length > 0 ? Math.min(...updatedObjects.map(o => o.z)) : 0;
    
    // Spawn if there is space at the back
    if (furthestZ > SPAWN_DISTANCE + 20) { 
        const spawnZ = SPAWN_DISTANCE;
        const randomLane = Math.floor(Math.random() * 3) - 1 as Lane;
        
        // Decorations
        if (Math.random() > 0.3) {
            const side = Math.random() > 0.5 ? 4 : -4; 
            updatedObjects.push({
                id: `dec-${Math.random()}`,
                z: spawnZ,
                lane: side,
                type: 'decoration',
                decorationType: Math.random() > 0.7 ? 'lamp' : 'tree',
                hit: false,
            });
        }

        // Game Objects
        const isHeart = Math.random() > 0.6; 
        if (isHeart) {
            updatedObjects.push({
                id: Math.random().toString(),
                z: spawnZ,
                lane: randomLane,
                type: 'heart',
                hit: false,
            });
        } else {
            const obstacles = Object.values(ObstacleType);
            const label = obstacles[Math.floor(Math.random() * obstacles.length)];
            updatedObjects.push({
                id: Math.random().toString(),
                z: spawnZ,
                lane: randomLane,
                type: 'obstacle',
                label: label,
                hit: false,
            });
        }
    }

    setObjects(updatedObjects);

    if (hitObstacle) {
        playSound('hit');
        const newHitList = [...gameState.obstaclesHit, hitLabel];
        setGameState(prev => ({
            ...prev,
            obstaclesHit: newHitList,
            isGameOver: true,
            isPlaying: false
        }));
        onGameOver({...gameState, obstaclesHit: newHitList});
    } else {
        if (collectedHeart) playSound('heart');
        
        setGameState(prev => ({
            ...prev,
            score: newScore,
            speed: prev.speed + 0.002, 
            hearts: collectedHeart ? prev.hearts + 1 : prev.hearts
        }));
    }
  });

  return (
    <>
      <StaticGround />
      <RoadStripes speed={gameState.isPlaying ? gameState.speed : 0} />
      
      <AmmuCharacter lane={lane} isRunning={gameState.isPlaying} />
      <SoulCharacter isRunning={gameState.isPlaying} />
      
      {/* Contact Shadow for grounded feel */}
      <ContactShadows position={[0, -0.49, 0]} opacity={0.6} scale={10} blur={2.5} far={4} color="black" />

      {objects.map(obj => {
          if (obj.hit) return null;
          if (obj.type === 'obstacle') return <Obstacle key={obj.id} data={obj} />;
          if (obj.type === 'heart') return <Heart key={obj.id} data={obj} />;
          if (obj.type === 'decoration') return <Decoration key={obj.id} data={obj} />;
          return null;
      })}
    </>
  );
};


const GameScene: React.FC<{
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    onGameOver: (state: GameState) => void;
}> = (props) => {
  return (
    <div className="w-full h-full">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 4, 6]} rotation={[-0.3, 0, 0]} fov={50} />
        
        <ambientLight intensity={0.7} />
        <directionalLight 
            position={[10, 20, -10]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[1024, 1024]} 
        />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <fog attach="fog" args={['#1e293b', 10, 80]} />

        <Suspense fallback={
            <mesh position={[0,0,-5]}>
                <boxGeometry />
                <meshStandardMaterial color="hotpink" wireframe />
            </mesh>
        }>
            <SceneController {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default GameScene;
