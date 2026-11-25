import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Component, type ErrorInfo, type ReactNode, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ZAMBIAN_PROVINCES } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import type { MerlRecord, ProvinceGeoNode, ProvinceName } from '../types/chz';
import { computeRate } from '../utils/chzUtils';

interface SovereignGlobe3DProps {
  selectedProvince: ProvinceName | 'ALL';
  onSelectProvince: (province: ProvinceName | 'ALL') => void;
  records: MerlRecord[];
}

const GLOBE_RADIUS = 2.02;
const ZAMBIA_CENTER_LAT = -13.2;
const ZAMBIA_CENTER_LNG = 27.9;
const REGIONAL_SPREAD = 6.2; // Magnifies Zambia's 10 provinces cleanly across the front hemisphere

function projectZambiaNodeToSphere(lat: number, lng: number, radius: number): THREE.Vector3 {
  const relLatDeg = (lat - ZAMBIA_CENTER_LAT) * REGIONAL_SPREAD;
  const relLngDeg = (lng - ZAMBIA_CENTER_LNG) * REGIONAL_SPREAD;

  const phi = THREE.MathUtils.degToRad(90 - relLatDeg);
  const theta = THREE.MathUtils.degToRad(relLngDeg);

  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);
  return new THREE.Vector3(x, y, z);
}

function buildArcPoints(start: THREE.Vector3, end: THREE.Vector3, elevation: number): [number, number, number][] {
  const mid = start.clone().add(end).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(GLOBE_RADIUS + elevation);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(32).map((p) => [p.x, p.y, p.z]);
}

function MeridianGrid() {
  const rings = useMemo(() => {
    const result: [number, number, number][][] = [];
    // Latitude parallels
    for (const latDeg of [-60, -30, 0, 30, 60]) {
      const pts: [number, number, number][] = [];
      const phi = THREE.MathUtils.degToRad(90 - latDeg);
      const r = GLOBE_RADIUS + 0.008;
      for (let i = 0; i <= 72; i++) {
        const theta = (i / 72) * Math.PI * 2;
        pts.push([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]);
      }
      result.push(pts);
    }
    // Longitude meridians
    for (let m = 0; m < 12; m++) {
      const pts: [number, number, number][] = [];
      const theta = (m / 12) * Math.PI * 2;
      const r = GLOBE_RADIUS + 0.008;
      for (let i = 0; i <= 72; i++) {
        const phi = (i / 72) * Math.PI;
        pts.push([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]);
      }
      result.push(pts);
    }
    return result;
  }, []);

  return (
    <group>
      {rings.map((pts, idx) => (
        <Line
          key={idx}
          points={pts}
          color={idx < 5 ? '#14B88A' : '#1E6F82'}
          lineWidth={idx === 2 ? 1.0 : 0.55}
          transparent
          opacity={idx === 2 ? 0.38 : 0.18}
        />
      ))}
    </group>
  );
}

interface NodeMarkerProps {
  node: ProvinceGeoNode;
  position: THREE.Vector3;
  isSelected: boolean;
  isDimmed: boolean;
  verifiedRate: number;
  verifiedCount: number;
  onSelect: (name: ProvinceName) => void;
}

function ProvincialNodeMarker({
  node,
  position,
  isSelected,
  isDimmed,
  verifiedRate,
  verifiedCount,
  onSelect,
}: NodeMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const pulseRef = useRef<THREE.Mesh>(null);

  const normalQuat = useMemo(() => {
    const dir = position.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }, [position]);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = clock.getElapsedTime();
    const base = isSelected ? 1.45 : node.isNationalHub ? 1.25 : 1.0;
    const scale = base + Math.sin(t * 2.6 + position.x * 2) * 0.22;
    pulseRef.current.scale.set(scale, scale, 1);
  });

  const coreColor = isSelected
    ? '#FFFFFF'
    : node.isNationalHub
      ? '#F59E0B'
      : hovered
        ? '#34D399'
        : '#38BDF8';

  const ringColor = isSelected ? '#14B88A' : node.isNationalHub ? '#0B7A5C' : '#0E6B8A';
  const showLabel = isSelected || hovered || node.isNationalHub;

  return (
    <group position={position}>
      {/* Pulse halo aligned tangent to globe surface */}
      <mesh ref={pulseRef} quaternion={normalQuat}>
        <ringGeometry args={[0.085, 0.125, 28]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={isDimmed ? 0.25 : isSelected ? 0.92 : 0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Interactive provincial beacon sphere */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.name);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[isSelected ? 0.082 : node.isNationalHub ? 0.072 : 0.056, 20, 20]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={isSelected ? '#14B88A' : node.isNationalHub ? '#0B7A5C' : '#0E6B8A'}
          emissiveIntensity={isSelected ? 1.4 : hovered ? 1.15 : 0.75}
          roughness={0.25}
          metalness={0.35}
        />
      </mesh>

      {showLabel ? (
        <Html distanceFactor={8} position={[0, 0.14, 0]} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={() => onSelect(node.name)}
            className={`cursor-pointer whitespace-nowrap rounded-lg border px-2 py-1 text-left shadow-lg backdrop-blur-md transition-transform hover:scale-105 ${
              isSelected
                ? 'border-[#14B88A] bg-[#072A2E]/95 text-[#F4F8F7]'
                : 'border-[#14B88A]/40 bg-[#072A2E]/82 text-[#F4F8F7]/90'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: isSelected ? '#14B88A' : '#58C4D8' }}
              />
              <span className="font-sans text-[10px] font-semibold tracking-wide">{node.name}</span>
              <span className="font-code text-[9px] text-[#5EEAD4]">{verifiedRate}%</span>
            </div>
            {isSelected || hovered ? (
              <div className="mt-0.5 font-code text-[8.5px] text-[#F4F8F7]/65">
                {node.regionalHubCode} · {verifiedCount} verified
              </div>
            ) : null}
          </button>
        </Html>
      ) : null}
    </group>
  );
}

interface GlobeSceneProps {
  selectedProvince: ProvinceName | 'ALL';
  onSelectProvince: (province: ProvinceName | 'ALL') => void;
  records: MerlRecord[];
  autoRotate: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function SovereignGlobeScene({
  selectedProvince,
  onSelectProvince,
  records,
  autoRotate,
  controlsRef,
}: GlobeSceneProps) {
  const orbitalRingRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (orbitalRingRef.current) {
      orbitalRingRef.current.rotation.z = clock.getElapsedTime() * 0.06;
    }
  });

  const nodeMetrics = useMemo(() => {
    const map = new Map<ProvinceName, { rate: number; count: number; pos: THREE.Vector3 }>();
    for (const province of ZAMBIAN_PROVINCES) {
      const verified = records.filter(
        (r) =>
          r.province === province.name && (r.status === 'LOCKED' || r.status === 'PUBLISHED')
      );
      const totalNum = verified.reduce((acc, r) => acc + r.numerator, 0);
      const totalDen = verified.reduce((acc, r) => acc + r.denominator, 0);
      const rate = totalDen > 0 ? computeRate(totalNum, totalDen) : 0;
      const pos = projectZambiaNodeToSphere(province.lat, province.lng, GLOBE_RADIUS + 0.035);
      map.set(province.name, { rate, count: verified.length, pos });
    }
    return map;
  }, [records]);

  const lusakaPos = nodeMetrics.get('Lusaka')!.pos;

  const supplyArcs = useMemo(() => {
    return ZAMBIAN_PROVINCES.filter((p) => !p.isNationalHub).map((p) => {
      const dest = nodeMetrics.get(p.name)!.pos;
      const dist = lusakaPos.distanceTo(dest);
      return {
        province: p.name,
        points: buildArcPoints(lusakaPos, dest, Math.min(0.45, 0.16 + dist * 0.14)),
      };
    });
  }, [lusakaPos, nodeMetrics]);

  const handleToggleNode = (name: ProvinceName) => {
    onSelectProvince(selectedProvince === name ? 'ALL' : name);
  };

  return (
    <>
      <ambientLight intensity={0.78} color="#F4F8F7" />
      <directionalLight position={[5, 4, 6]} intensity={1.35} color="#D1FAE5" />
      <pointLight position={[-4, -3, 3]} intensity={0.85} color="#0E6B8A" />

      <group>
        {/* Core Sovereign Espresso-Teal Globe */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
          <meshStandardMaterial
            color="#102C34"
            emissive="#091B20"
            emissiveIntensity={0.45}
            roughness={0.72}
            metalness={0.22}
          />
        </mesh>

        {/* Subtle warm atmospheric shell */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS + 0.06, 36, 36]} />
          <meshBasicMaterial
            color="#14B88A"
            transparent
            opacity={0.055}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Gold & Teal Coordinate Meridians */}
        <MeridianGrid />

        {/* Outer tilted sovereign orbital telemetry ring */}
        <mesh ref={orbitalRingRef} rotation={[Math.PI / 2.6, 0.25, 0]}>
          <ringGeometry args={[GLOBE_RADIUS + 0.42, GLOBE_RADIUS + 0.445, 96]} />
          <meshBasicMaterial color="#14B88A" transparent opacity={0.26} side={THREE.DoubleSide} />
        </mesh>

        {/* eSCMIS & Surveillance Arcs from Lusaka HQ to all 9 Provincial Hubs */}
        {supplyArcs.map((arc) => {
          const highlighted =
            selectedProvince === 'ALL' ||
            selectedProvince === 'Lusaka' ||
            selectedProvince === arc.province;
          return (
            <Line
              key={arc.province}
              points={arc.points}
              color={highlighted ? '#14B88A' : '#1E5B6B'}
              lineWidth={highlighted ? 1.45 : 0.65}
              transparent
              opacity={highlighted ? 0.78 : 0.22}
            />
          );
        })}

        {/* 10 Zambian Provincial Nodes */}
        {ZAMBIAN_PROVINCES.map((node) => {
          const metric = nodeMetrics.get(node.name)!;
          const isSelected = selectedProvince === node.name;
          const isDimmed = selectedProvince !== 'ALL' && !isSelected;
          return (
            <ProvincialNodeMarker
              key={node.name}
              node={node}
              position={metric.pos}
              isSelected={isSelected}
              isDimmed={isDimmed}
              verifiedRate={metric.rate}
              verifiedCount={metric.count}
              onSelect={handleToggleNode}
            />
          );
        })}
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.62}
        minDistance={3.9}
        maxDistance={7.4}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
      />
    </>
  );
}

interface GlobeErrorBoundaryProps {
  children: ReactNode;
  selectedProvince: ProvinceName | 'ALL';
  onSelectProvince: (p: ProvinceName | 'ALL') => void;
}

class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: GlobeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Graceful fallback triggered below if WebGL context is unavailable
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center text-[#F4F8F7]">
          <p className="font-editorial text-xl">10-Province Sovereign Network</p>
          <p className="mt-1 max-w-sm text-xs text-[#F4F8F7]/70">
            Interactive WebGL canvas unavailable in this browser context. Select any provincial hub
            below to filter live KPIs and charts.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {ZAMBIAN_PROVINCES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() =>
                  this.props.onSelectProvince(
                    this.props.selectedProvince === p.name ? 'ALL' : p.name
                  )
                }
                className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${
                  this.props.selectedProvince === p.name
                    ? 'border-[#14B88A] bg-[#14B88A] text-[#072A2E]'
                    : 'border-[#F4F8F7]/20 bg-[#0A353B] text-[#F4F8F7]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SovereignGlobe3D({
  selectedProvince,
  onSelectProvince,
  records,
}: SovereignGlobe3DProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const selectedGeo = useMemo(
    () => ZAMBIAN_PROVINCES.find((p) => p.name === selectedProvince) ?? null,
    [selectedProvince]
  );

  const selectedProvinceStats = useMemo(() => {
    const scoped =
      selectedProvince === 'ALL'
        ? records
        : records.filter((r) => r.province === selectedProvince);
    const verified = scoped.filter((r) => r.status === 'LOCKED' || r.status === 'PUBLISHED');
    const pending = scoped.filter((r) => r.status === 'DRAFT' || r.status === 'RETURNED');
    const num = verified.reduce((a, b) => a + b.numerator, 0);
    const den = verified.reduce((a, b) => a + b.denominator, 0);
    return {
      verifiedCount: verified.length,
      pendingCount: pending.length,
      rate: computeRate(num, den),
      reach: num,
    };
  }, [records, selectedProvince]);

  const handleResetView = () => {
    controlsRef.current?.reset();
    onSelectProvince('ALL');
    useChzStore
      .getState()
      .logUiEvent(
        'NAVIGATION',
        'GLOBE_VIEW_RESET',
        '3D-GLOBE',
        'Reset 3D Sovereign Health Network camera orientation and national scope.'
      );
  };

  const handleToggleOrbit = () => {
    setAutoRotate((prev) => {
      const next = !prev;
      useChzStore
        .getState()
        .logUiEvent(
          'NAVIGATION',
          next ? 'GLOBE_ORBIT_RESUMED' : 'GLOBE_ORBIT_PAUSED',
          '3D-GLOBE',
          `${next ? 'Enabled' : 'Paused'} automatic 3D orbital rotation on Executive Command globe.`
        );
      return next;
    });
  };

  return (
    <div className="espresso-surface relative flex h-[390px] flex-col overflow-hidden rounded-2xl sm:h-[445px]">
      {/* Top Overlay Telemetry Strip */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto rounded-xl border border-[#14B88A]/30 bg-[#072A2E]/85 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#14B88A]" />
            <span className="font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]">
              3D Sovereign Health Network
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#F4F8F7]/75">
            Drag to orbit · Click any of the 10 provincial nodes to filter
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            id="globe-autorotate-btn"
            onClick={handleToggleOrbit}
            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 font-code text-[10px] font-medium transition-colors ${
              autoRotate
                ? 'border-[#14B88A]/60 bg-[#14B88A]/20 text-[#99F6E4]'
                : 'border-[#F4F8F7]/15 bg-[#072A2E]/80 text-[#F4F8F7]/75 hover:border-[#14B88A]/40'
            }`}
          >
            {autoRotate ? 'ORBIT: ON' : 'ORBIT: PAUSED'}
          </button>
          <button
            type="button"
            id="globe-reset-btn"
            onClick={handleResetView}
            className="cursor-pointer rounded-lg border border-[#F4F8F7]/15 bg-[#072A2E]/80 px-2.5 py-1.5 font-code text-[10px] font-medium text-[#F4F8F7]/80 transition-colors hover:border-[#14B88A]/50 hover:text-[#F4F8F7]"
          >
            RESET VIEW
          </button>
        </div>
      </div>

      {/* Three.js Canvas */}
      <div className="h-full w-full">
        <GlobeErrorBoundary
          selectedProvince={selectedProvince}
          onSelectProvince={onSelectProvince}
        >
          <Canvas camera={{ position: [0.25, 0.35, 5.25], fov: 42 }} dpr={[1, 2]}>
            <SovereignGlobeScene
              selectedProvince={selectedProvince}
              onSelectProvince={onSelectProvince}
              records={records}
              autoRotate={autoRotate}
              controlsRef={controlsRef}
            />
          </Canvas>
        </GlobeErrorBoundary>
      </div>

      {/* Bottom Inspector Strip */}
      <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex flex-wrap items-end justify-between gap-2">
        <div className="pointer-events-auto rounded-xl border border-[#14B88A]/30 bg-[#072A2E]/90 px-3.5 py-2.5 text-[#F4F8F7] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-editorial text-lg leading-none text-[#F4F8F7]">
              {selectedGeo ? `${selectedGeo.name} Province` : 'All 10 Zambian Provinces'}
            </span>
            <span className="rounded bg-[#0E6B8A]/50 px-1.5 py-0.5 font-code text-[10px] text-[#9BE0EE]">
              {selectedGeo ? selectedGeo.regionalHubCode : 'ZM-NATIONAL-10'}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-code text-[10.5px] text-[#F4F8F7]/75">
            <span>
              FACILITIES:{' '}
              <strong className="text-[#5EEAD4]">
                {selectedGeo
                  ? selectedGeo.facilitiesCount
                  : ZAMBIAN_PROVINCES.reduce((a, b) => a + b.facilitiesCount, 0)}
              </strong>
            </span>
            <span>
              VERIFIED RATE:{' '}
              <strong className="text-[#9BE0EE]">{selectedProvinceStats.rate}%</strong>
            </span>
            <span>
              PENDING MERL:{' '}
              <strong className="text-[#F4F8F7]">{selectedProvinceStats.pendingCount}</strong>
            </span>
          </div>
        </div>

        {selectedProvince !== 'ALL' ? (
          <button
            type="button"
            onClick={() => onSelectProvince('ALL')}
            className="pointer-events-auto cursor-pointer rounded-xl border border-[#14B88A]/60 bg-[#0B7A5C] px-3 py-2 text-xs font-semibold text-[#F4F8F7] shadow-lg transition-colors hover:bg-[#14B88A] hover:text-[#072A2E]"
          >
            Show All 10 Provinces
          </button>
        ) : null}
      </div>
    </div>
  );
}
