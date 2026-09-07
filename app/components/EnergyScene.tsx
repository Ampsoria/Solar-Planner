"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";

export interface EnergySceneProps {
  night: boolean;
  solarKw: number;
  evEnabled: boolean;
  evCharging?: boolean;
  applianceCount: number;
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

      // Ground-floor furniture and appliances visible through the open facade.
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
      box(1.4, 0.86, 0.065, -2.25, 1.32, -2.02, dark, house, 0.025);
      box(1.32, 0.78, 0.018, -2.25, 1.32, -1.978, screen, house);
      // A subtle screen graphic uses geometry, so every asset remains self-contained.
      const screenGraphic = mat(0x71b398, 0.5, {
        emissive: 0x47916f,
        emissiveIntensity: 0.35,
      });
      box(0.48, 0.025, 0.02, -2.51, 1.24, -1.962, screenGraphic, house);
      box(0.73, 0.02, 0.02, -2.38, 1.12, -1.962, screenGraphic, house);
      sphere(0.155, -1.94, 1.43, -1.968, screenGraphic, house).scale.z = 0.06;
      box(1.01, 0.26, 0.23, -2.18, 2.22, -2.29, white, house, 0.04);
      box(0.86, 0.025, 0.018, -2.18, 2.15, -2.164, dark, house);
      // Kitchen cabinets, fridge, worktop, induction hob and faucet.
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
      box(0.45, 0.013, 0.39, 0.65, 1.382, -2.03, dark, house, 0.025);
      cylinder(0.1, 0.1, 0.018, 0.64, 1.4, -1.99, chrome, house);
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
      box(0.63, 1.66, 0.61, -0.67, 1.285, -2.03, white, house, 0.035);
      box(0.61, 0.018, 0.02, -0.67, 1.6, -1.716, darkMetal, house);
      box(0.022, 0.31, 0.055, -0.42, 1.35, -1.68, chrome, house);
      box(0.022, 0.18, 0.055, -0.42, 1.84, -1.68, chrome, house);
      // Dining nook and a pendant over the living area.
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
      cylinder(0.011, 0.011, 0.55, -2, 2.25, -0.24, dark, house, 8);
      cylinder(0.12, 0.31, 0.17, -2, 1.91, -0.24, warm, house);

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
      ev.position.set(3.19, 0.34, 1.07);
      root.add(ev);
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
          [house, solar, ...(latest.current.evEnabled ? [ev, charger] : [])],
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
        const viewHeight = Math.max(8.65, 12.8 / aspect);
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
      let lastVisible = true;
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
          (0.3 + nightAmount * 4) * Math.min(1, settings.applianceCount / 4);
        roofLight.intensity = nightAmount * 0.28;
        skyMarker.quaternion.copy(camera.quaternion);
        sunRays.visible = nightAmount < 0.5;
        sunMaterial.color.copy(daySunColor).lerp(nightMoonColor, nightAmount);
        sunMaterial.emissive
          .copy(daySunColor)
          .lerp(nightMoonColor, nightAmount);
        screen.emissiveIntensity =
          settings.applianceCount > 0 ? 0.3 + nightAmount * 0.7 : 0;
        if (lastVisible !== settings.evEnabled) {
          ev.visible = settings.evEnabled;
          charger.visible = settings.evEnabled;
          lastVisible = settings.evEnabled;
        }
        const solarActive = settings.solarKw > 0;
        solar.visible = solarActive;
        solarFlow.object.visible = solarActive && !settings.night;
        evFlow.object.visible =
          settings.evEnabled &&
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
            (!forEv || (settings.evEnabled && (settings.evCharging ?? true)));
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
