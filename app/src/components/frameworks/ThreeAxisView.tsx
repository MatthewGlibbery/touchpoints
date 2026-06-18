import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useBlueprintStore } from '../../store/blueprint.store';
import { getCardId, getCardText, type CardItem } from './FrameworkCard';
import type { FrameworkAxis } from '../../types/blueprint';

const SNAP_POINTS = 10;
const AXIS_LENGTH = 10;
const CARD_SCALE = 0.4;

// Map snap value (0-9) to 3D coordinate centered at origin (-5 to +5)
function snapTo3D(value: number): number {
  return (value / (SNAP_POINTS - 1)) * AXIS_LENGTH - AXIS_LENGTH / 2;
}

// Map 3D coordinate to snap value (0-9)
function threeDToSnap(coord: number): number {
  const raw = ((coord + AXIS_LENGTH / 2) / AXIS_LENGTH) * (SNAP_POINTS - 1);
  return Math.max(0, Math.min(9, Math.round(raw)));
}

const typeColors = {
  pain: '#EF4444',
  opportunity: '#22C55E',
  question: '#F59E0B',
};

function AxisLine({
  start,
  end,
  color = '#666',
}: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}) {
  return (
    <Line
      points={[start, end]}
      color={color}
      lineWidth={1.5}
    />
  );
}

function AxisLabel({
  position,
  text,
  color = '#999',
  fontSize = 0.3,
}: {
  position: [number, number, number];
  text: string;
  color?: string;
  fontSize?: number;
}) {
  return (
    <Billboard position={position}>
      <Text fontSize={fontSize} color={color} anchorX="center" anchorY="middle" font={undefined}>
        {text}
      </Text>
    </Billboard>
  );
}

function CardNode3D({
  card,
  position,
  onDragEnd,
}: {
  card: CardItem;
  position: [number, number, number];
  onDragEnd: (cardId: string, pos: THREE.Vector3) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { camera, raycaster } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());

  const color = typeColors[card.type];
  const text = getCardText(card);
  const displayText = text.length > 30 ? text.slice(0, 28) + '…' : text;

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    (e.target as any).setPointerCapture?.(e.pointerId);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(...position));

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    dragOffset.current.copy(new THREE.Vector3(...position)).sub(intersect);
  }, [camera, position, raycaster]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging || !meshRef.current) return;
    e.stopPropagation();

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    if (intersect) {
      const newPos = intersect.add(dragOffset.current);
      newPos.x = Math.max(-AXIS_LENGTH / 2, Math.min(AXIS_LENGTH / 2, newPos.x));
      newPos.y = Math.max(-AXIS_LENGTH / 2, Math.min(AXIS_LENGTH / 2, newPos.y));
      newPos.z = Math.max(-AXIS_LENGTH / 2, Math.min(AXIS_LENGTH / 2, newPos.z));
      meshRef.current.position.copy(newPos);
    }
  }, [isDragging, raycaster]);

  const handlePointerUp = useCallback((e: any) => {
    if (!isDragging || !meshRef.current) return;
    e.stopPropagation();
    setIsDragging(false);
    (e.target as any).releasePointerCapture?.(e.pointerId);
    onDragEnd(getCardId(card), meshRef.current.position);
  }, [isDragging, card, onDragEnd]);

  return (
    <Billboard position={position} ref={meshRef}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[2.2 * CARD_SCALE, 0.8 * CARD_SCALE]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isDragging ? 0.9 : hovered ? 0.85 : 0.7}
        />
      </mesh>
      <Text
        fontSize={0.15}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        maxWidth={2 * CARD_SCALE}
        font={undefined}
      >
        {displayText}
      </Text>
    </Billboard>
  );
}

function GridHelper3D() {
  const gridLines: Array<{ start: [number, number, number]; end: [number, number, number] }> = [];
  const half = AXIS_LENGTH / 2;
  const step = AXIS_LENGTH / (SNAP_POINTS - 1);

  // XZ grid at Y=0 (floor at center)
  for (let i = 0; i < SNAP_POINTS; i++) {
    const pos = -half + i * step;
    gridLines.push({ start: [pos, 0, -half], end: [pos, 0, half] });
    gridLines.push({ start: [-half, 0, pos], end: [half, 0, pos] });
  }

  return (
    <>
      {gridLines.map((line, idx) => (
        <Line key={idx} points={[line.start, line.end]} color="#333" lineWidth={0.5} transparent opacity={0.2} />
      ))}
    </>
  );
}

function Scene({
  axes,
  cards,
  onCardDragEnd,
}: {
  axes: [FrameworkAxis, FrameworkAxis, FrameworkAxis];
  cards: CardItem[];
  onCardDragEnd: (cardId: string, pos: THREE.Vector3) => void;
}) {
  const [xAxis, yAxis, zAxis] = axes;
  const half = AXIS_LENGTH / 2;

  // Get placed cards with 3D positions — read from each axis's cardPositions
  const placedCards = useMemo(() => {
    const result: Array<{ card: CardItem; position: [number, number, number] }> = [];
    for (const card of cards) {
      const id = getCardId(card);
      const xPos = (xAxis.cardPositions ?? {})[id];
      const yPos = (yAxis.cardPositions ?? {})[id];
      const zPos = (zAxis.cardPositions ?? {})[id];
      if (xPos !== undefined && yPos !== undefined && zPos !== undefined) {
        result.push({
          card,
          position: [snapTo3D(xPos), snapTo3D(yPos), snapTo3D(zPos)],
        });
      }
    }
    return result;
  }, [cards, xAxis.cardPositions, yAxis.cardPositions, zAxis.cardPositions]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />

      {/* Grid helper at Y=0 */}
      <GridHelper3D />

      {/* Axes cross at origin (0,0,0) — extending from -half to +half */}
      {/* X axis (red) */}
      <AxisLine start={[-half, 0, 0]} end={[half, 0, 0]} color="#EF4444" />
      <AxisLabel position={[half + 0.8, 0, 0]} text={xAxis.title} color="#EF4444" fontSize={0.35} />
      <AxisLabel position={[-half - 0.5, -0.4, 0]} text={xAxis.lowLabel} color="#999" fontSize={0.2} />
      <AxisLabel position={[half + 0.5, -0.4, 0]} text={xAxis.highLabel} color="#999" fontSize={0.2} />

      {/* Y axis (green) */}
      <AxisLine start={[0, -half, 0]} end={[0, half, 0]} color="#22C55E" />
      <AxisLabel position={[0, half + 0.8, 0]} text={yAxis.title} color="#22C55E" fontSize={0.35} />
      <AxisLabel position={[-0.6, -half, 0]} text={yAxis.lowLabel} color="#999" fontSize={0.2} />
      <AxisLabel position={[-0.6, half, 0]} text={yAxis.highLabel} color="#999" fontSize={0.2} />

      {/* Z axis (blue) */}
      <AxisLine start={[0, 0, -half]} end={[0, 0, half]} color="#3B82F6" />
      <AxisLabel position={[0, 0, half + 0.8]} text={zAxis.title} color="#3B82F6" fontSize={0.35} />
      <AxisLabel position={[0, -0.4, -half - 0.5]} text={zAxis.lowLabel} color="#999" fontSize={0.2} />
      <AxisLabel position={[0, -0.4, half + 0.5]} text={zAxis.highLabel} color="#999" fontSize={0.2} />

      {/* Tick marks on axes */}
      {Array.from({ length: SNAP_POINTS }, (_, i) => {
        const p = snapTo3D(i);
        return (
          <group key={i}>
            <Line points={[[p, -0.1, 0], [p, 0.1, 0]]} color="#666" lineWidth={1} />
            <Line points={[[0, p, -0.05], [0, p, 0.05]]} color="#666" lineWidth={1} />
            <Line points={[[0, -0.1, p], [0, 0.1, p]]} color="#666" lineWidth={1} />
          </group>
        );
      })}

      {/* Cards */}
      {placedCards.map(({ card, position }) => (
        <CardNode3D
          key={getCardId(card)}
          card={card}
          position={position}
          onDragEnd={onCardDragEnd}
        />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={25}
      />
    </>
  );
}

export function ThreeAxisView({
  axes,
  cards,
}: {
  axes: [FrameworkAxis, FrameworkAxis, FrameworkAxis];
  cards: CardItem[];
}) {
  const setCardAxisPosition = useBlueprintStore((s) => s.setCardAxisPosition);
  const [xAxis, yAxis, zAxis] = axes;

  const handleCardDragEnd = useCallback((cardId: string, pos: THREE.Vector3) => {
    setCardAxisPosition(xAxis.id, cardId, threeDToSnap(pos.x));
    setCardAxisPosition(yAxis.id, cardId, threeDToSnap(pos.y));
    setCardAxisPosition(zAxis.id, cardId, threeDToSnap(pos.z));
  }, [xAxis.id, yAxis.id, zAxis.id, setCardAxisPosition]);

  // Handle drop from dugout — place at center (5,5,5) by default
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      setCardAxisPosition(xAxis.id, cardId, 5);
      setCardAxisPosition(yAxis.id, cardId, 5);
      setCardAxisPosition(zAxis.id, cardId, 5);
    }
  }, [xAxis.id, yAxis.id, zAxis.id, setCardAxisPosition]);

  return (
    <div
      style={{ flex: 1, position: 'relative' }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [12, 8, 12], fov: 50 }}
        style={{ background: 'var(--canvas-bg)' }}
      >
        <Scene
          axes={axes}
          cards={cards}
          onCardDragEnd={handleCardDragEnd}
        />
      </Canvas>

      {/* Instructions overlay */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 14px',
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 11,
        color: 'var(--text-muted)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        Drag to rotate · Scroll to zoom · Right-drag to pan · Drag cards to reposition
      </div>
    </div>
  );
}
