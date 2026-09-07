"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";
import type { Appliance, ApplianceKind } from "../lib/energy";
import { planSceneInventory } from "../lib/scene-inventory";

export interface EnergySceneProps {
  night: boolean;
  solarKw: number;
  evEnabled: boolean;
  evCharging?: boolean;
  appliances: Pick<Appliance, "id" | "kind" | "count">[];
  evCount: number;
  playing: boolean;
  onSelect?: (kind: "solar" | "home" | "ev") => void;
}

/** A small, explorable home built entirely from real, lit 3D geometry. */
export default function EnergyScene(props: EnergySceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    latest.current = props;
  }, [props]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let release: (() => void) | undefined;

    async function createScene() {
      const [THREE, { OrbitControls }, { RoundedBoxGeometry }] =
        await Promise.all([
          import("three"),
          import("three/addons/controls/OrbitControls.js"),
          import("three/addons/geometries/RoundedBoxGeometry.js"),
        ]);
      if (cancelled || !container) return;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.domElement.style.cssText =
        "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline:none";
      renderer.domElement.setAttribute(
        "aria-label",
        "บ้านสามมิติพร้อมแผงโซลาร์ เครื่องใช้ไฟฟ้า และรถ EV ลากเพื่อหมุนมุมมอง",
      );
      renderer.domElement.setAttribute("role", "img");
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
      camera.position.set(10, 8.7, 12);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1.8, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.minZoom = 0.8;
      controls.maxZoom = 1.55;
      controls.zoomSpeed = 0.55;
      controls.minPolarAngle = Math.PI / 5;
      controls.maxPolarAngle = Math.PI / 2.7;
      controls.minAzimuthAngle = -Math.PI / 3;
      controls.maxAzimuthAngle = Math.PI / 2.1;
      controls.rotateSpeed = 0.65;
      controls.update();

      const ambient = new THREE.HemisphereLight(0xffffff, 0x97a88e, 2.25);
      scene.add(ambient);
      const sunLight = new THREE.DirectionalLight(0xfff4dd, 3.4);
      sunLight.position.set(-3, 10, 5);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.left = -8;
      sunLight.shadow.camera.right = 8;
      sunLight.shadow.camera.top = 8;
      sunLight.shadow.camera.bottom = -8;
      sunLight.shadow.normalBias = 0.04;
      sunLight.shadow.bias = -0.0002;
      sunLight.shadow.radius = 4;
      scene.add(sunLight);
      const fill = new THREE.DirectionalLight(0xd1eeff, 1.0);
      fill.position.set(6, 4, -5);
      scene.add(fill);

      const geometries = new Set<Three.BufferGeometry>();
      const materials = new Set<Three.Material>();
      const mat = (
        color: Three.ColorRepresentation,
        roughness = 0.7,
        extra: Three.MeshStandardMaterialParameters = {},
      ) => {
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness,
          ...extra,
        });
        materials.add(material);
        return material;
      };
      const ivory = mat(0xf9f8ed);
      const white = mat(0xffffff, 0.55);
      const concrete = mat(0xdbdfd5);
      const foundation = mat(0xe9eddf);
      const dark = mat(0x263d3c, 0.45);
      const darkMetal = mat(0x314846, 0.4, { metalness: 0.4 });
      const glass = mat(0x749895, 0.13, { metalness: 0.24 });
      const windowGlow = mat(0xb4c9bb, 0.25, {
        emissive: 0xffcd80,
        emissiveIntensity: 0.04,
      });
      const wood = mat(0xa9845b);
      const paleWood = mat(0xe1c79e);
      const grass = mat(0xbed2a6);
      const foliage = [
        mat(0x659776),
        mat(0x83ac82),
        mat(0x9db98a),
        mat(0x527e63),
      ];
      const mint = mat(0xb9d9c8, 0.27, { metalness: 0.25 });
      const blue = mat(0x203f57, 0.23, { metalness: 0.48 });
      const cell = mat(0x78a7b5, 0.33, { metalness: 0.25 });
      const rubber = mat(0x24302d, 0.95);
      const chrome = mat(0xc4cec8, 0.26, { metalness: 0.75 });
      const warm = mat(0xffedba, 0.4, {
        emissive: 0xffc96c,
        emissiveIntensity: 0.25,
      });
      const energyMaterial = mat(0x67d6a2, 0.4, {
        emissive: 0x64e3a4,
        emissiveIntensity: 0.9,
      });
      const screen = mat(0x162e32, 0.23, {
        emissive: 0x20494e,
        emissiveIntensity: 0.3,
      });

      const root = new THREE.Group();
      scene.add(root);
      function mesh(
        geometry: Three.BufferGeometry,
        material: Three.Material,
        parent: Three.Object3D = root,
      ) {
        geometries.add(geometry);
        const object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;
        parent.add(object);
        return object;
      }
      function box(
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
        material: Three.Material,
        parent: Three.Object3D = root,
        radius = 0,
      ) {
        const geometry = radius
          ? new RoundedBoxGeometry(
              w,
              h,
              d,
              3,
              Math.min(radius, w / 2, h / 2, d / 2),
            )
          : new THREE.BoxGeometry(w, h, d);
        const object = mesh(geometry, material, parent);
        object.position.set(x, y, z);
        return object;
      }
      function cylinder(
        rt: number,
        rb: number,
        h: number,
        x: number,
        y: number,
        z: number,
        material: Three.Material,
        parent: Three.Object3D = root,
        sides = 20,
      ) {
        const object = mesh(
          new THREE.CylinderGeometry(rt, rb, h, sides),
          material,
          parent,
        );
        object.position.set(x, y, z);
        return object;
      }
      function sphere(
        r: number,
        x: number,
        y: number,
        z: number,
        material: Three.Material,
        parent: Three.Object3D = root,
      ) {
        const object = mesh(
          new THREE.SphereGeometry(r, 16, 12),
          material,
          parent,
        );
        object.position.set(x, y, z);
        return object;
      }
      function tube(
        points: number[][],
        radius: number,
        material: Three.Material,
        parent: Three.Object3D = root,
      ) {
        const curve = new THREE.CatmullRomCurve3(
          points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        );
        const object = mesh(
          new THREE.TubeGeometry(curve, 36, radius, 6, false),
          material,
          parent,
        );
        return { object, curve };
      }

      // The rounded island creates a little architectural world, with a real cast shadow.
      box(10.3, 0.3, 7.9, 0, 0.06, 0, foundation, root, 0.23);
      box(10.1, 0.075, 7.7, 0, 0.245, 0, grass, root, 0.18);
      box(3.05, 0.045, 6.9, 3.24, 0.305, 0.22, concrete, root, 0.12);
      box(5.05, 0.16, 4.65, -1.15, 0.34, -0.44, concrete, root, 0.08);
      box(4.95, 0.045, 4.55, -1.15, 0.435, -0.44, ivory, root, 0.04);
      for (let i = 0; i < 4; i++)
        box(
          1.02,
          0.07,
          0.37,
          -0.28,
          0.325,
          2.25 + i * 0.48,
          foundation,
          root,
          0.025,
        );

      // Home: a warm open living room below a glazed upper floor.
      const house = new THREE.Group();
      house.userData.kind = "home";
      root.add(house);
      box(4.8, 2.2, 0.14, -1.15, 1.55, -2.46, ivory, house);
      box(0.15, 2.2, 3.95, -3.49, 1.55, -0.48, ivory, house);
      box(0.17, 2.2, 1.68, 1.18, 1.55, -1.7, ivory, house);
      box(4.98, 0.21, 4.53, -1.15, 2.65, -0.25, ivory, house, 0.035);
      box(0.17, 2.08, 0.17, -3.48, 1.5, 1.64, white, house);
      box(0.17, 2.08, 0.17, 1.19, 1.5, 1.64, white, house);
      // Vertical timber facade, entrance and side window.
      box(0.15, 2.05, 1.3, 1.19, 1.52, 0.71, wood, house);
      for (let i = 0; i < 10; i++)
        box(0.026, 2.03, 0.022, 1.28, 1.53, 0.13 + i * 0.123, paleWood, house);
      box(0.045, 1.66, 0.7, 1.29, 1.33, 0.54, dark, house);
      box(0.055, 0.32, 0.026, 1.33, 1.35, 0.76, chrome, house);
      box(0.035, 1.4, 1.06, 1.275, 1.63, -1.52, glass, house);
      box(0.045, 1.45, 0.04, 1.3, 1.63, -1.52, darkMetal, house);

      box(4.77, 1.79, 0.14, -1.15, 3.64, -2.44, ivory, house);
      box(0.17, 1.79, 3.3, -3.48, 3.64, -0.87, ivory, house);
      box(0.18, 1.79, 3.3, 1.17, 3.64, -0.87, ivory, house);
      box(4.81, 0.17, 3.37, -1.15, 4.56, -0.87, ivory, house, 0.03);
      // Upper picture windows and slim charcoal mullions.
      box(4.43, 1.51, 0.075, -1.15, 3.58, 0.7, windowGlow, house);
      for (let i = 0; i < 5; i++)
        box(0.055, 1.65, 0.1, -3.35 + i * 1.1, 3.58, 0.76, darkMetal, house);
      box(4.5, 0.06, 0.09, -1.15, 2.8, 0.76, darkMetal, house);
      box(4.5, 0.06, 0.09, -1.15, 4.39, 0.76, darkMetal, house);
      box(0.03, 1.32, 2.03, 1.275, 3.58, -0.99, glass, house);
      for (let i = 0; i < 3; i++)
        box(0.05, 1.41, 0.045, 1.3, 3.58, -1.95 + i * 0.96, darkMetal, house);
      box(0.06, 0.045, 2.12, 1.3, 4.28, -0.99, darkMetal, house);
      box(0.06, 0.045, 2.12, 1.3, 2.87, -0.99, darkMetal, house);
      // Balcony railing: transparent glazing and individually modeled posts.
      const railingGlass = mat(0xd4e4dc, 0.2, {
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      box(4.57, 0.59, 0.018, -1.15, 3.02, 1.77, railingGlass, house);
      box(4.76, 0.047, 0.055, -1.15, 3.35, 1.78, darkMetal, house);
      for (let i = 0; i < 5; i++)
        box(
          0.042,
          0.66,
          0.042,
          -3.48 + i * 1.168,
          3.02,
          1.78,
          darkMetal,
          house,
        );
      box(0.045, 0.047, 1.12, 1.19, 3.35, 1.24, darkMetal, house);
      box(0.02, 0.59, 1.07, 1.19, 3.02, 1.24, railingGlass, house);

      // Decorative ground-floor furniture visible through the open facade.
      box(2.21, 0.021, 1.67, -2.09, 0.467, 0.35, mat(0xdbdac6), house, 0.04);
      const sofa = mat(0xb9c8b7);
      box(1.92, 0.33, 0.71, -2.18, 0.76, 0.7, sofa, house, 0.09);
      box(1.95, 0.43, 0.15, -2.18, 1.01, 1.03, sofa, house, 0.065);
      box(0.19, 0.43, 0.77, -3.12, 0.97, 0.68, sofa, house, 0.06);
      box(0.19, 0.43, 0.77, -1.24, 0.97, 0.68, sofa, house, 0.06);
      for (let i = 0; i < 3; i++)
        box(
          0.53,
          0.095,
          0.5,
          -2.78 + i * 0.6,
          0.956,
          0.68,
          mat(i === 1 ? 0xe7e4cc : 0xc6d3c0),
          house,
          0.04,
        );
      cylinder(0.46, 0.46, 0.095, -2.03, 0.85, -0.26, paleWood, house, 32);
      cylinder(0.21, 0.26, 0.33, -2.03, 0.63, -0.26, wood, house);
      cylinder(0.08, 0.08, 0.1, -1.88, 0.95, -0.25, ivory, house);
      box(0.31, 0.018, 0.22, -2.18, 0.911, -0.25, mat(0x648978), house);
      box(1.7, 0.39, 0.4, -2.25, 0.67, -1.98, paleWood, house, 0.025);
      // Decorative kitchen cabinets, worktop, sink and faucet.
      box(1.32, 0.86, 0.55, 0.4, 0.88, -2.07, mint, house, 0.015);
      box(1.42, 0.067, 0.65, 0.36, 1.34, -2.03, ivory, house, 0.02);
      for (let i = 0; i < 3; i++)
        box(
          0.018,
          0.78,
          0.018,
          -0.1 + i * 0.43,
          0.88,
          -1.787,
          darkMetal,
          house,
        );
      box(0.44, 0.015, 0.31, -0.04, 1.381, -2.05, chrome, house, 0.05);
      tube(
        [
          [-0.13, 1.39, -2.29],
          [-0.13, 1.65, -2.29],
          [-0.13, 1.69, -2.13],
          [-0.13, 1.58, -2.08],
        ],
        0.018,
        chrome,
        house,
      );
      // Dining nook.
      cylinder(0.4, 0.4, 0.07, 0.22, 1.03, -0.37, paleWood, house, 28);
      cylinder(0.075, 0.2, 0.54, 0.22, 0.725, -0.37, dark, house);
      for (const z of [-0.99, 0.27]) {
        box(0.4, 0.07, 0.39, 0.22, 0.78, z, wood, house, 0.04);
        box(
          0.4,
          0.38,
          0.065,
          0.22,
          1,
          z + (z > 0 ? 0.17 : -0.17),
          wood,
          house,
          0.04,
        );
        for (const x of [0.07, 0.37])
          box(0.035, 0.29, 0.035, x, 0.59, z, dark, house);
      }

      // Solar array: eight individually framed panels, with actual cell dividers.
      const solar = new THREE.Group();
      solar.userData.kind = "solar";
      solar.position.set(-1.16, 4.72, -0.87);
      solar.rotation.x = -0.1;
      root.add(solar);
      const panels: Three.Group[] = [];
      for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 4; column++) {
          const panel = new THREE.Group();
          panel.position.set((column - 1.5) * 1.055, 0, (row - 0.5) * 1.43);
          solar.add(panel);
          panels.push(panel);
          box(0.997, 0.065, 1.34, 0, 0, 0, chrome, panel, 0.012);
          box(0.94, 0.025, 1.28, 0, 0.044, 0, blue, panel, 0.008);
          for (let j = 1; j < 4; j++)
            box(0.009, 0.005, 1.27, -0.47 + j * 0.235, 0.06, 0, cell, panel);
          for (let j = 1; j < 7; j++)
            box(
              0.937,
              0.005,
              0.008,
              0,
              0.06,
              -0.64 + j * (1.28 / 7),
              cell,
              panel,
            );
          box(0.08, 0.2, 0.86, -0.31, -0.12, 0, darkMetal, panel);
          box(0.08, 0.2, 0.86, 0.31, -0.12, 0, darkMetal, panel);
        }
      }

      // EV: curved mint body, a glass cabin, lights, mirrors, wheels and charge port.
      const ev = new THREE.Group();
      ev.userData.kind = "ev";
      // This unmounted template shares geometry and materials with every EV copy.
      box(1.48, 0.41, 2.79, 0, 0.49, 0, mint, ev, 0.2);
      box(1.33, 0.23, 2.66, 0, 0.64, -0.02, mint, ev, 0.12);
      box(1.19, 0.57, 1.52, 0, 0.96, -0.16, dark, ev, 0.18);
      box(1.22, 0.09, 1.05, 0, 1.26, -0.29, mint, ev, 0.045);
      const windshield = box(1.06, 0.51, 0.045, 0, 0.99, 0.54, glass, ev, 0.02);
      windshield.rotation.x = -0.36;
      box(1.09, 0.075, 1.04, 0, 0.775, 0.82, mint, ev, 0.04);
      box(1.12, 0.19, 0.055, 0, 0.49, 1.385, dark, ev, 0.04);
      for (const x of [-0.68, 0.68]) {
        box(0.032, 0.41, 1.12, x * 0.882, 1.015, -0.19, glass, ev, 0.03);
        box(0.035, 0.45, 0.055, x * 0.94, 1, -0.23, dark, ev);
        box(0.045, 0.028, 0.19, x * 1.015, 0.73, -0.25, chrome, ev, 0.012);
        box(0.19, 0.1, 0.16, x * 1.13, 0.91, 0.4, mint, ev, 0.04);
        for (const z of [-0.88, 0.86]) {
          const tire = cylinder(
            0.285,
            0.285,
            0.16,
            x,
            0.285,
            z,
            rubber,
            ev,
            28,
          );
          tire.rotation.z = Math.PI / 2;
          const hub = cylinder(
            0.18,
            0.18,
            0.17,
            x * 1.015,
            0.285,
            z,
            chrome,
            ev,
            20,
          );
          hub.rotation.z = Math.PI / 2;
          const cap = cylinder(
            0.075,
            0.075,
            0.18,
            x * 1.02,
            0.285,
            z,
            dark,
            ev,
            12,
          );
          cap.rotation.z = Math.PI / 2;
        }
      }
      box(0.43, 0.073, 0.055, -0.43, 0.67, 1.337, warm, ev, 0.02);
      box(0.43, 0.073, 0.055, 0.43, 0.67, 1.337, warm, ev, 0.02);
      const tail = mat(0xe57b68, 0.3, {
        emissive: 0xa72f22,
        emissiveIntensity: 0.2,
      });
      box(1.05, 0.05, 0.035, 0, 0.68, -1.392, tail, ev, 0.01);
      box(0.3, 0.13, 0.01, 0, 0.45, 1.421, white, ev, 0.015);

      const charger = new THREE.Group();
      charger.userData.kind = "ev";
      root.add(charger);
      box(0.45, 0.055, 0.42, 2.12, 0.35, -0.72, darkMetal, charger, 0.03);
      box(0.13, 0.81, 0.13, 2.12, 0.78, -0.72, darkMetal, charger, 0.02);
      box(0.44, 0.63, 0.28, 2.12, 1.39, -0.72, white, charger, 0.075);
      box(0.29, 0.41, 0.025, 2.12, 1.42, -0.56, dark, charger, 0.035);
      box(0.15, 0.06, 0.027, 2.12, 1.49, -0.541, energyMaterial, charger, 0.01);
      tube(
        [
          [2.32, 1.29, -0.71],
          [2.5, 0.7, -0.57],
          [2.48, 0.45, 0.14],
          [2.5, 0.97, 0.59],
        ],
        0.025,
        dark,
        charger,
      );
      box(0.085, 0.14, 0.17, 2.51, 0.99, 0.62, dark, charger, 0.02);

      // Each template is built once; all physical units share its part geometries.
      const deviceTemplates = new Map<ApplianceKind, Three.Group>();
      const applianceKinds: ApplianceKind[] = [
        "ac",
        "fridge",
        "tv",
        "washer",
        "light",
        "waterheater",
        "computer",
        "custom",
      ];
      for (const kind of applianceKinds) {
        const model = new THREE.Group();
        deviceTemplates.set(kind, model);
        box(1.02, 0.08, 1.02, 0, 0.04, 0, ivory, model, 0.05);
        // A slim colored front edge ties the miniatures to the energy system.
        box(0.74, 0.035, 0.025, 0, 0.065, 0.505, mint, model);
        if (kind === "ac") {
          box(0.9, 0.4, 0.32, 0, 0.53, 0, white, model, 0.055);
          box(0.075, 0.3, 0.075, 0, 0.23, -0.08, chrome, model);
          for (let i = 0; i < 3; i++)
            box(0.76, 0.018, 0.025, 0, 0.41 + i * 0.045, 0.169, dark, model);
          box(0.09, 0.025, 0.022, 0.29, 0.64, 0.17, energyMaterial, model);
        } else if (kind === "fridge") {
          box(0.56, 1.02, 0.55, 0, 0.59, 0, white, model, 0.035);
          box(0.53, 0.017, 0.022, 0, 0.76, 0.28, darkMetal, model);
          box(0.03, 0.25, 0.045, 0.2, 0.53, 0.3, chrome, model);
          box(0.03, 0.15, 0.045, 0.2, 0.9, 0.3, chrome, model);
        } else if (kind === "tv") {
          box(0.92, 0.58, 0.075, 0, 0.57, 0, dark, model, 0.025);
          box(0.83, 0.49, 0.018, 0, 0.57, 0.047, screen, model);
          box(0.45, 0.025, 0.025, -0.1, 0.48, 0.063, mint, model);
          box(0.1, 0.18, 0.085, 0, 0.2, 0, dark, model);
          box(0.5, 0.04, 0.27, 0, 0.1, 0, dark, model, 0.02);
        } else if (kind === "washer") {
          box(0.64, 0.74, 0.58, 0, 0.45, 0, white, model, 0.045);
          const rim = cylinder(0.23, 0.23, 0.045, 0, 0.41, 0.31, chrome, model);
          rim.rotation.x = Math.PI / 2;
          const door = cylinder(
            0.18,
            0.18,
            0.052,
            0,
            0.41,
            0.335,
            glass,
            model,
          );
          door.rotation.x = Math.PI / 2;
          box(0.25, 0.075, 0.018, -0.12, 0.72, 0.3, dark, model);
          sphere(0.045, 0.2, 0.72, 0.31, chrome, model);
        } else if (kind === "light") {
          cylinder(0.18, 0.23, 0.06, 0, 0.11, 0, darkMetal, model);
          cylinder(0.025, 0.025, 0.67, 0, 0.47, 0, chrome, model, 10);
          cylinder(0.18, 0.31, 0.28, 0, 0.85, 0, warm, model);
          sphere(0.1, 0, 0.72, 0, warm, model);
        } else if (kind === "waterheater") {
          box(0.46, 0.64, 0.24, -0.12, 0.64, 0, white, model, 0.065);
          box(0.06, 0.32, 0.06, -0.12, 0.24, -0.07, chrome, model);
          sphere(0.065, -0.12, 0.62, 0.14, mint, model);
          box(0.16, 0.045, 0.018, -0.12, 0.82, 0.13, dark, model);
          tube(
            [
              [0.02, 0.34, 0.03],
              [0.15, 0.15, 0.04],
              [0.36, 0.3, 0.04],
              [0.36, 0.82, 0.04],
            ],
            0.018,
            chrome,
            model,
          );
          const shower = cylinder(
            0.1,
            0.08,
            0.045,
            0.36,
            0.88,
            0.055,
            darkMetal,
            model,
          );
          shower.rotation.x = Math.PI / 3;
        } else if (kind === "computer") {
          box(0.64, 0.43, 0.06, -0.09, 0.58, -0.06, dark, model, 0.025);
          box(0.56, 0.35, 0.015, -0.09, 0.58, -0.02, screen, model);
          box(0.065, 0.24, 0.065, -0.09, 0.26, -0.06, chrome, model);
          box(0.3, 0.03, 0.24, -0.09, 0.13, -0.03, chrome, model);
          box(0.58, 0.035, 0.2, -0.09, 0.12, 0.28, dark, model, 0.015);
          box(0.19, 0.51, 0.4, 0.35, 0.34, -0.05, darkMetal, model, 0.025);
          box(0.07, 0.02, 0.018, 0.35, 0.52, 0.16, energyMaterial, model);
        } else {
          box(0.56, 0.62, 0.46, 0, 0.4, 0, mint, model, 0.06);
          box(0.24, 0.17, 0.025, 0, 0.52, 0.24, dark, model, 0.02);
          for (const x of [-0.055, 0.055])
            box(0.025, 0.055, 0.027, x, 0.52, 0.259, ivory, model);
          tube(
            [
              [0.26, 0.21, 0],
              [0.4, 0.14, 0.12],
              [0.37, 0.14, 0.36],
            ],
            0.023,
            dark,
            model,
          );
          box(0.13, 0.09, 0.12, 0.34, 0.14, 0.36, dark, model, 0.015);
        }
        model.updateMatrixWorld(true);
      }
      const inventory = new THREE.Group();
      inventory.userData.kind = "home";
      root.add(inventory);
      const displayDeck = box(
        1,
        0.16,
        1,
        0,
        0.23,
        4.45,
        foundation,
        root,
        0.045,
      );
      const parkingDeck = box(
        1,
        0.09,
        1,
        3.19,
        0.29,
        1.07,
        concrete,
        root,
        0.03,
      );
      const cars = new Map<string, Three.Group>();
      const births = new Map<string, number>();
      type InventoryPlan = ReturnType<typeof planSceneInventory>;
      type InstanceBatch = {
        part: Three.InstancedMesh;
        local: Three.Matrix4;
        units: InventoryPlan["units"];
      };
      let inventoryPlan = planSceneInventory([]);
      let instanceBatches: InstanceBatch[] = [];
      let inventorySignature = "";
      let currentEvCount = -1;
      let applianceTotal = 0;
      let popping = false;
      const instanceTransform = new THREE.Object3D();
      const composedMatrix = new THREE.Matrix4();
      const sceneBounds = new THREE.Box3(
        new THREE.Vector3(-5.25, -0.15, -4),
        new THREE.Vector3(5.25, 6, 4),
      );

      function syncInventory(
        settings: EnergySceneProps,
        animationTime: number,
        motion: boolean,
      ) {
        const signature = JSON.stringify(
          settings.appliances.map(({ id, kind, count }) => [id, kind, count]),
        );
        const evCount = settings.evEnabled
          ? Math.max(0, Math.floor(settings.evCount))
          : 0;
        if (signature === inventorySignature && evCount === currentEvCount)
          return;
        if (signature !== inventorySignature) {
          inventorySignature = signature;
          inventoryPlan = planSceneInventory(settings.appliances);
          applianceTotal = inventoryPlan.units.length;
          for (const { part } of instanceBatches) {
            inventory.remove(part);
            part.dispose();
          }
          instanceBatches = [];
          for (const kind of applianceKinds) {
            const units = inventoryPlan.units.filter(
              (unit) => unit.kind === kind,
            );
            if (!units.length) continue;
            deviceTemplates.get(kind)!.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              const part = new THREE.InstancedMesh(
                object.geometry,
                object.material,
                units.length,
              );
              part.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
              part.castShadow = true;
              part.receiveShadow = true;
              part.frustumCulled = false;
              part.userData.unitKeys = units.map((unit) => unit.key);
              inventory.add(part);
              instanceBatches.push({
                part,
                local: object.matrixWorld.clone(),
                units,
              });
            });
          }
          displayDeck.visible = applianceTotal > 0;
          displayDeck.scale.set(
            inventoryPlan.width + 0.24,
            1,
            inventoryPlan.depth + 0.24,
          );
          displayDeck.position.set(
            inventoryPlan.centerX,
            0.23,
            4.45 + (inventoryPlan.depth - 1.18) / 2,
          );
        }
        for (const [key, car] of cars) {
          if (Number(key.slice(3)) >= evCount) {
            root.remove(car);
            cars.delete(key);
          }
        }
        for (let index = 0; index < evCount; index++) {
          const key = `ev:${index}`;
          if (!cars.has(key)) {
            const car = ev.clone(true);
            car.name = key;
            car.userData.unitKey = key;
            root.add(car);
            cars.set(key, car);
          }
        }
        currentEvCount = evCount;
        const activeKeys = new Set([
          ...inventoryPlan.units.map((unit) => unit.key),
          ...cars.keys(),
        ]);
        for (const key of births.keys())
          if (!activeKeys.has(key)) births.delete(key);
        for (const key of activeKeys)
          if (!births.has(key))
            births.set(key, motion ? animationTime : animationTime - 1);
        popping = true;
        parkingDeck.visible = evCount > 1;
        const parkingRows = Math.ceil(evCount / 2);
        parkingDeck.scale.set(
          evCount > 1 ? 4.05 : 1.9,
          1,
          Math.max(1, parkingRows) * 3.3,
        );
        parkingDeck.position.set(
          evCount > 1 ? 4.19 : 3.19,
          0.29,
          1.07 + (parkingRows - 1) * 1.65,
        );
        sceneBounds.min.set(
          Math.min(-5.25, 2.1 - inventoryPlan.width),
          -0.15,
          -4,
        );
        sceneBounds.max.set(
          evCount > 1 ? 6.3 : 5.25,
          6,
          Math.max(
            4,
            applianceTotal ? 4.45 + inventoryPlan.depth - 0.47 : 4,
            evCount ? 2.65 + (parkingRows - 1) * 3.3 : 4,
          ),
        );
        const target = sceneBounds.getCenter(new THREE.Vector3());
        target.y = 2.15;
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
        camera.position
          .sub(target)
          .normalize()
          .multiplyScalar(
            Math.max(
              19,
              sceneBounds.getSize(new THREE.Vector3()).length() * 1.2,
            ),
          )
          .add(target);
        camera.far = Math.max(
          100,
          sceneBounds.getSize(new THREE.Vector3()).length() * 5,
        );
        camera.zoom = 1;
        controls.update();
        resize();
        renderer.domElement.setAttribute(
          "aria-label",
          `บ้านสามมิติ เครื่องใช้ไฟฟ้า ${applianceTotal} ชิ้น รถ EV ${evCount} คัน ลากเพื่อหมุนมุมมอง`,
        );
      }

      function updateInventory(animationTime: number, motion: boolean) {
        if (!popping) return;
        let unfinished = false;
        const progress = (key: string) => {
          const t = motion
            ? Math.min(
                1,
                (animationTime - (births.get(key) ?? animationTime)) / 0.42,
              )
            : 1;
          if (t < 1) unfinished = true;
          return 1 - Math.pow(1 - t, 3);
        };
        for (const { part, local, units } of instanceBatches) {
          units.forEach((unit, index) => {
            const t = progress(unit.key);
            instanceTransform.position.set(
              unit.x,
              0.31 - (1 - t) * 0.22,
              unit.z,
            );
            instanceTransform.scale.setScalar(0.12 + t * 0.88);
            instanceTransform.updateMatrix();
            composedMatrix.multiplyMatrices(instanceTransform.matrix, local);
            part.setMatrixAt(index, composedMatrix);
          });
          part.instanceMatrix.needsUpdate = true;
          part.computeBoundingSphere();
        }
        for (const [key, car] of cars) {
          const index = Number(key.slice(3));
          const t = progress(key);
          car.position.set(
            3.19 + (index % 2) * 2,
            0.34 - (1 - t) * 0.2,
            1.07 + Math.floor(index / 2) * 3.3,
          );
          car.scale.setScalar(0.12 + t * 0.88);
        }
        popping = unfinished;
      }

      // Layered, softly faceted trees, planters, hedges and garden fixtures.
      function tree(x: number, z: number, size = 1) {
        cylinder(
          0.065 * size,
          0.11 * size,
          1.5 * size,
          x,
          0.33 + 0.75 * size,
          z,
          wood,
          root,
          10,
        );
        const a = mesh(
          new THREE.IcosahedronGeometry(0.7 * size, 2),
          foliage[0],
        );
        a.position.set(x, 0.45 + 1.66 * size, z);
        a.scale.set(0.85, 1.03, 0.85);
        const b = mesh(
          new THREE.IcosahedronGeometry(0.6 * size, 2),
          foliage[1],
        );
        b.position.set(x - 0.3 * size, 0.45 + 1.48 * size, z + 0.2 * size);
        const c = mesh(
          new THREE.IcosahedronGeometry(0.51 * size, 2),
          foliage[2],
        );
        c.position.set(x + 0.29 * size, 0.45 + 1.56 * size, z + 0.12 * size);
      }
      tree(-4.25, -2.72, 1.05);
      tree(3.93, -2.53, 1.07);
      tree(-4.23, 1.95, 0.68);
      function bush(x: number, z: number, scale: number, i = 0) {
        const object = mesh(
          new THREE.IcosahedronGeometry(scale, 2),
          foliage[i % foliage.length],
        );
        object.position.set(x, 0.3 + scale * 0.57, z);
        object.scale.set(1, 0.7, 0.9);
      }
      for (let i = 0; i < 6; i++) bush(-3.8 + i * 0.52, -3.2, 0.36, i);
      for (let i = 0; i < 5; i++) bush(-3.54 + i * 0.47, 2.59, 0.29, i);
      for (let i = 0; i < 4; i++) bush(4.43, -0.9 + i * 0.42, 0.25, i + 1);
      function planter(x: number, y: number, z: number) {
        cylinder(0.19, 0.145, 0.27, x, y + 0.135, z, ivory);
        cylinder(0.15, 0.15, 0.012, x, y + 0.278, z, wood);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const leaf = sphere(
            0.16,
            x + Math.cos(angle) * 0.1,
            y + 0.46,
            z + Math.sin(angle) * 0.1,
            foliage[i % 4],
          );
          leaf.scale.set(0.4, 1.5, 0.5);
          leaf.rotation.z = Math.cos(angle) * 0.5;
        }
      }
      planter(-3.08, 2.76, 1.32);
      planter(0.74, 2.76, 1.27);
      planter(0.87, 0.46, 1.38);
      for (const x of [-1.05, 0.53]) {
        box(0.08, 0.35, 0.08, x, 0.48, 3.2, dark, root, 0.016);
        box(0.085, 0.075, 0.085, x, 0.66, 3.2, warm, root, 0.01);
      }

      const interiorLight = new THREE.PointLight(0xffc482, 0.5, 5, 2);
      interiorLight.position.set(-1.25, 2.2, -0.3);
      house.add(interiorLight);
      const roofLight = new THREE.PointLight(0x83f9be, 0.1, 5, 2);
      roofLight.position.set(-1.15, 5.4, -0.6);
      root.add(roofLight);

      const skyMarker = new THREE.Group();
      skyMarker.position.set(3.23, 5.45, -1.9);
      root.add(skyMarker);
      const sunMaterial = mat(0xffd97c, 0.5, {
        emissive: 0xffcc64,
        emissiveIntensity: 0.35,
      });
      sphere(0.25, 0, 0, 0, sunMaterial, skyMarker).castShadow = false;
      const sunRays = new THREE.Group();
      skyMarker.add(sunRays);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const ray = cylinder(
          0.015,
          0.015,
          0.12,
          Math.sin(angle) * 0.42,
          Math.cos(angle) * 0.42,
          0,
          sunMaterial,
          sunRays,
          8,
        );
        ray.rotation.z = -angle;
        ray.castShadow = false;
      }
      const daySunColor = new THREE.Color(0xffd97c);
      const nightMoonColor = new THREE.Color(0xd4e7ec);

      const flowLineMaterial = mat(0x74cca1, 0.5, {
        transparent: true,
        opacity: 0.5,
        emissive: 0x43ad81,
        emissiveIntensity: 0.25,
      });
      const solarFlow = tube(
        [
          [0.98, 4.85, -0.6],
          [1.64, 4.67, -0.26],
          [1.72, 3.05, 0.1],
          [1.68, 1.46, 0.14],
          [2.13, 1.43, -0.48],
        ],
        0.013,
        flowLineMaterial,
      );
      const evFlow = tube(
        [
          [2.15, 1.49, -0.45],
          [2.59, 1.48, 0.02],
          [2.65, 1.23, 0.71],
        ],
        0.011,
        flowLineMaterial,
      );
      const dots: {
        object: Three.Mesh;
        curve: Three.CatmullRomCurve3;
        offset: number;
        ev: boolean;
      }[] = [];
      for (let i = 0; i < 5; i++)
        dots.push({
          object: sphere(0.045, 0, 0, 0, energyMaterial),
          curve: solarFlow.curve,
          offset: i / 5,
          ev: false,
        });
      for (let i = 0; i < 3; i++)
        dots.push({
          object: sphere(0.038, 0, 0, 0, energyMaterial),
          curve: evFlow.curve,
          offset: i / 3,
          ev: true,
        });

      const shadowMaterial = new THREE.ShadowMaterial({
        color: 0x415c45,
        opacity: 0.14,
      });
      materials.add(shadowMaterial);
      const ground = mesh(
        new THREE.PlaneGeometry(200, 200),
        shadowMaterial,
        scene,
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.11;
      ground.castShadow = false;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downX = 0;
      let downY = 0;
      const pointerDown = (event: PointerEvent) => {
        downX = event.clientX;
        downY = event.clientY;
        renderer.domElement.style.cursor = "grabbing";
      };
      const pointerUp = (event: PointerEvent) => {
        renderer.domElement.style.cursor = "grab";
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6)
          return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(
          [
            house,
            solar,
            inventory,
            ...(latest.current.evEnabled ? [...cars.values(), charger] : []),
          ],
          true,
        );
        if (hits[0]) {
          let object: Three.Object3D | null = hits[0].object;
          while (object && !object.userData.kind) object = object.parent;
          if (object?.userData.kind)
            latest.current.onSelect?.(
              object.userData.kind as "solar" | "home" | "ev",
            );
        }
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointerup", pointerUp);

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        const aspect = width / height;
        camera.updateMatrixWorld(true);
        let horizontal = 0;
        let vertical = 0;
        for (const x of [sceneBounds.min.x, sceneBounds.max.x])
          for (const y of [sceneBounds.min.y, sceneBounds.max.y])
            for (const z of [sceneBounds.min.z, sceneBounds.max.z]) {
              const corner = new THREE.Vector3(x, y, z).applyMatrix4(
                camera.matrixWorldInverse,
              );
              horizontal = Math.max(horizontal, Math.abs(corner.x));
              vertical = Math.max(vertical, Math.abs(corner.y));
            }
        const viewHeight = Math.max(
          8.65,
          vertical * 2.12,
          (horizontal * 2.12) / aspect,
        );
        camera.left = (-viewHeight * aspect) / 2;
        camera.right = (viewHeight * aspect) / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();

      const motionPreference = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      let reducedMotion = motionPreference.matches;
      const updateMotion = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches;
      };
      motionPreference.addEventListener("change", updateMotion);
      let frame = 0;
      let elapsed = 0;
      let previous = performance.now();
      let nightAmount = latest.current.night ? 1 : 0;
      let inView = true;
      const intersection = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
      });
      intersection.observe(container);
      const animate = (now: number) => {
        frame = requestAnimationFrame(animate);
        const dt = Math.min((now - previous) / 1000, 0.05);
        previous = now;
        if (!inView || document.hidden) return;
        const settings = latest.current;
        if (settings.playing && !reducedMotion) elapsed += dt;
        syncInventory(settings, elapsed, settings.playing && !reducedMotion);
        updateInventory(elapsed, settings.playing && !reducedMotion);
        nightAmount +=
          ((settings.night ? 1 : 0) - nightAmount) * Math.min(1, dt * 4);
        ambient.intensity = 2.25 - nightAmount * 1.5;
        sunLight.intensity = 3.4 - nightAmount * 3.05;
        sunLight.color.setRGB(
          1 - nightAmount * 0.52,
          0.95 - nightAmount * 0.32,
          0.84 + nightAmount * 0.16,
        );
        fill.intensity = 1 - nightAmount * 0.22;
        windowGlow.emissiveIntensity = 0.04 + nightAmount * 1.05;
        warm.emissiveIntensity = 0.25 + nightAmount * 0.8;
        interiorLight.intensity =
          (0.3 + nightAmount * 4) * Math.min(1, applianceTotal / 4);
        roofLight.intensity = nightAmount * 0.28;
        skyMarker.quaternion.copy(camera.quaternion);
        sunRays.visible = nightAmount < 0.5;
        sunMaterial.color.copy(daySunColor).lerp(nightMoonColor, nightAmount);
        sunMaterial.emissive
          .copy(daySunColor)
          .lerp(nightMoonColor, nightAmount);
        screen.emissiveIntensity =
          applianceTotal > 0 ? 0.3 + nightAmount * 0.7 : 0;
        charger.visible = currentEvCount > 0;
        const solarActive = settings.solarKw > 0;
        solar.visible = solarActive;
        solarFlow.object.visible = solarActive && !settings.night;
        evFlow.object.visible =
          currentEvCount > 0 &&
          (settings.evCharging ?? true) &&
          solarActive &&
          !settings.night;
        panels.forEach((panel, i) => {
          panel.visible =
            i < Math.max(2, Math.min(8, Math.ceil(settings.solarKw * 1.34)));
        });
        dots.forEach(({ object, curve, offset, ev: forEv }) => {
          object.visible =
            solarActive &&
            !settings.night &&
            (!forEv || (currentEvCount > 0 && (settings.evCharging ?? true)));
          if (object.visible) {
            const t = Math.max(
              0.001,
              Math.min(0.999, (elapsed * 0.145 + offset) % 1),
            );
            const pt = curve.getPointAt(t);
            if (pt) object.position.copy(pt);
          }
        });
        controls.update();
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(animate);

      release = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        motionPreference.removeEventListener("change", updateMotion);
        renderer.domElement.removeEventListener("pointerdown", pointerDown);
        renderer.domElement.removeEventListener("pointerup", pointerUp);
        controls.dispose();
        instanceBatches.forEach(({ part }) => part.dispose());
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        sunLight.shadow.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      if (cancelled) release();
    }

    createScene().catch(() => {
      if (!cancelled) setUnavailable(true);
      release?.();
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, []);

  return (
    <div
      ref={host}
      role="group"
      aria-label={`เครื่องใช้ไฟฟ้า ${props.appliances.reduce((sum, device) => sum + device.count, 0)} ชิ้น รถ EV ${props.evEnabled ? props.evCount : 0} คัน ${props.night ? "กลางคืน" : "กลางวัน"} ${props.playing ? "กำลังเล่น" : "หยุดภาพเคลื่อนไหว"}`}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 280,
        position: "relative",
      }}
    >
      {unavailable && (
        <div
          role="status"
          style={{
            display: "grid",
            placeContent: "center",
            height: "100%",
            padding: 28,
            textAlign: "center",
            color: props.night ? "#dce9df" : "#4f695f",
            fontSize: 14,
            gap: 10,
          }}
        >
          <span style={{ fontSize: 52 }} aria-hidden="true">
            ⌂
          </span>
          <span>อุปกรณ์นี้ไม่รองรับภาพ 3 มิติ</span>
          <span>คุณยังคำนวณพลังงานและเลือกขนาดโซลาร์ได้ตามปกติ</span>
        </div>
      )}
    </div>
  );
}
