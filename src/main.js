
import * as THREE from "three";
import QRCode from "qrcode";
import "./style.css";

const DEFAULT_URL = "https://www.instagram.com/bolaodatropa/";
const app = document.querySelector("#app");

app.innerHTML = `
  <canvas id="scene" aria-label="Bola de futebol 3D que se transforma em QR Code"></canvas>
`;

const canvas = document.querySelector("#scene");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x090b0a, 0.045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.15, 9.2);

scene.add(new THREE.HemisphereLight(0xdfffe9, 0x162019, 2.15));

const key = new THREE.DirectionalLight(0xffffff, 4.1);
key.position.set(4, 6, 7);
key.castShadow = true;
scene.add(key);

const rim = new THREE.DirectionalLight(0x7bffad, 2.2);
rim.position.set(-5, 1.5, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(8, 80),
  new THREE.MeshStandardMaterial({ color: 0x0d120f, roughness: 0.95, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.4;
floor.receiveShadow = true;
scene.add(floor);

const ballGroup = new THREE.Group();
scene.add(ballGroup);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1.62, 64, 40),
  new THREE.MeshStandardMaterial({
    color: 0xf1f3f2,
    roughness: 0.7,
    metalness: 0.02,
    transparent: true,
    depthWrite: false
  })
);
ball.castShadow = true;
ball.receiveShadow = true;
ballGroup.add(ball);

function createPatchGeometry(radius = 0.35, surfaceRadius = 1.642) {
  const positions = [0, 0, 0];
  const indices = [];
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI / 2 + i * (Math.PI * 2 / 5);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = Math.sqrt(surfaceRadius ** 2 - x ** 2 - y ** 2) - surfaceRadius;
    positions.push(x, y, z);
  }
  for (let i = 0; i < 5; i++) indices.push(0, i + 1, ((i + 1) % 5) + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const patchGeo = createPatchGeometry();
const patchMat = new THREE.MeshStandardMaterial({
  color: 0x111311,
  roughness: 0.82,
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false
});

const patchDirections = [
  [0, 1, 1.618], [0, 1, -1.618], [0, -1, 1.618], [0, -1, -1.618],
  [1, 1.618, 0], [1, -1.618, 0], [-1, 1.618, 0], [-1, -1.618, 0],
  [1.618, 0, 1], [1.618, 0, -1], [-1.618, 0, 1], [-1.618, 0, -1]
].map(v => new THREE.Vector3(...v).normalize());

const patches = [];
const patchOutlines = [];
const surfaceNormal = new THREE.Vector3(0, 0, 1);
for (const dir of patchDirections) {
  const patch = new THREE.Mesh(patchGeo, patchMat.clone());
  patch.position.copy(dir).multiplyScalar(1.642);
  patch.quaternion.setFromUnitVectors(surfaceNormal, dir);
  patch.rotateZ((patches.length % 5) * 0.32);
  patch.renderOrder = 4;
  patch.castShadow = true;
  ballGroup.add(patch);
  patches.push(patch);

  const outlinePoints = [];
  for (let i = 0; i <= 5; i++) {
    const angle = Math.PI / 2 + (i % 5) * (Math.PI * 2 / 5);
    const x = Math.cos(angle) * 0.365;
    const y = Math.sin(angle) * 0.365;
    const z = Math.sqrt(1.645 ** 2 - x ** 2 - y ** 2) - 1.645 + 0.004;
    outlinePoints.push(new THREE.Vector3(
      x,
      y,
      z
    ));
  }
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    new THREE.LineBasicMaterial({ color: 0x8e9891, transparent: true, opacity: 0.5 })
  );
  outline.position.copy(dir).multiplyScalar(1.645);
  outline.quaternion.copy(patch.quaternion);
  outline.renderOrder = 5;
  ballGroup.add(outline);
  patchOutlines.push(outline);
}

const seamSegments = [];
for (let first = 0; first < patchDirections.length; first++) {
  for (let second = first + 1; second < patchDirections.length; second++) {
    if (patchDirections[first].angleTo(patchDirections[second]) > 1.3) continue;
    for (let step = 0; step < 4; step++) {
      const startT = 0.28 + step * 0.11;
      const endT = startT + 0.11;
      const start = patchDirections[first].clone().lerp(patchDirections[second], startT).normalize().multiplyScalar(1.624);
      const end = patchDirections[first].clone().lerp(patchDirections[second], endT).normalize().multiplyScalar(1.624);
      seamSegments.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  }
}
const seam = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(seamSegments, 3)),
  new THREE.LineBasicMaterial({ color: 0x8e9891, transparent: true, opacity: 0.45 })
);
seam.renderOrder = 2;
ballGroup.add(seam);

const qrGroup = new THREE.Group();
scene.add(qrGroup);

const particleGeometry = new THREE.BoxGeometry(1, 1, 0.12);
const particles = [];
let state = "ball";
let animationStart = 0;
const animationDuration = 1450;
let currentQRSize = 0;

function ease(t) {
  return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}

function getBallWorldPosition(position) {
  return position.clone()
    .multiplyScalar(ballGroup.scale.x)
    .applyQuaternion(ballGroup.quaternion)
    .add(ballGroup.position);
}

function fibonacciSphere(i, n, radius = 1.67) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y*y));
  const theta = golden * i;
  return new THREE.Vector3(
    Math.cos(theta) * r * radius,
    y * radius,
    Math.sin(theta) * r * radius
  );
}

async function buildQR(text) {
  const data = QRCode.create(text || DEFAULT_URL, { errorCorrectionLevel: "M" });
  const size = data.modules.size;
  currentQRSize = size;

  const darkCells = [];
  const lightCells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      (data.modules.get(x, y) ? darkCells : lightCells).push({ x, y });
    }
  }

  for (const p of particles) {
    qrGroup.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  particles.length = 0;

  const quiet = 4;
  const total = size + quiet * 2;
  const qrWorldSize = 4.65;
  const module = qrWorldSize / total;

  [...darkCells, ...lightCells].forEach((cell, i) => {
    const isDark = i < darkCells.length;
    const groupIndex = isDark ? i : i - darkCells.length;
    const groupSize = isDark ? darkCells.length : lightCells.length;
    const material = new THREE.MeshStandardMaterial({
      color: isDark ? 0x050505 : 0xffffff,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.scale.set(module * 0.94, module * 0.94, 1);

    const ballPos = fibonacciSphere(groupIndex, groupSize);
    const qrPos = new THREE.Vector3(
      ((cell.x + quiet) - (total - 1)/2) * module,
      (((total - 1)/2) - (cell.y + quiet)) * module,
      0
    );

    mesh.position.copy(ballPos);
    mesh.rotation.set(
      (i * .173) % Math.PI,
      (i * .317) % Math.PI,
      (i * .211) % Math.PI
    );

    qrGroup.add(mesh);
    particles.push({
      mesh,
      ballPos,
      qrPos,
      startPos: ballPos.clone(),
      endPos: qrPos.clone(),
      startOpacity: 0,
      endOpacity: 1,
      baseRotation: new THREE.Euler(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z)
    });
  });

  setImmediateState("ball");
}

function setImmediateState(next) {
  state = next;
  const qr = next === "qr";
  ball.material.depthWrite = !qr;
  patches.forEach(p => p.material.depthWrite = !qr);
  ball.visible = !qr;
  seam.visible = !qr;
  patches.forEach(p => p.visible = !qr);
  patchOutlines.forEach(outline => outline.visible = !qr);

  particles.forEach(p => {
    p.mesh.position.copy(qr ? p.qrPos : p.ballPos);
    p.mesh.visible = qr;
    p.mesh.material.opacity = qr ? 1 : 0;
    p.mesh.rotation.set(0,0,0);
  });

}

function startMorph(toQR) {
  if (state === "morph") return;
  state = "morph";
  animationStart = performance.now();
  ball.material.depthWrite = false;
  patches.forEach(p => p.material.depthWrite = false);

  particles.forEach(p => {
    p.mesh.visible = true;
    p.startPos.copy(toQR ? getBallWorldPosition(p.ballPos) : p.qrPos);
    p.endPos.copy(toQR ? p.qrPos : getBallWorldPosition(p.ballPos));
    p.startOpacity = 1;
    p.endOpacity = 1;
    p.mesh.material.opacity = 1;
  });

  ball.visible = true;
  seam.visible = true;
  patches.forEach(p => p.visible = true);
  patchOutlines.forEach(outline => outline.visible = true);

  startMorph.toQR = toQR;
}

canvas.addEventListener("pointerdown", () => {
  if (state === "ball") startMorph(true);
  else if (state === "qr") startMorph(false);
});

function render(time) {
  requestAnimationFrame(render);

  if (state === "ball") {
    ballGroup.rotation.y += 0.004;
    ballGroup.rotation.x = Math.sin(time * 0.00045) * 0.08;
    ballGroup.position.y = Math.sin(time * 0.001) * 0.06;
  }

  if (state === "morph") {
    const raw = Math.min((time - animationStart) / animationDuration, 1);
    const t = ease(raw);
    const toQR = startMorph.toQR;

    const ballOpacity = toQR ? 1 - t : t;
    ball.material.opacity = ballOpacity;
    patchMat.opacity = ballOpacity;
    patches.forEach(p => p.material.opacity = ballOpacity);
    seam.material.opacity = 0.45 * ballOpacity;
    patchOutlines.forEach(outline => outline.material.opacity = 0.5 * ballOpacity);

    ballGroup.scale.setScalar(1 - (toQR ? t : 1-t) * 0.13);
    ballGroup.rotation.y += 0.007 * (1 - t);

    particles.forEach(p => {
      const local = t;
      p.mesh.position.lerpVectors(p.startPos, p.endPos, local);

      p.mesh.material.opacity =
        p.startOpacity + (p.endOpacity - p.startOpacity) * local;

      const spin = Math.sin(local * Math.PI) * 0.18;
      const alignment = toQR ? 1 - local : local;
      p.mesh.rotation.set(
        p.baseRotation.x * alignment + spin * 0.22,
        p.baseRotation.y * alignment + spin * 0.16,
        p.baseRotation.z * alignment + spin * 0.10
      );
    });

    if (raw >= 1) {
      state = toQR ? "qr" : "ball";
      ballGroup.scale.setScalar(1);
      if (state === "qr") {
  ball.visible = false;
  seam.visible = false;
  patches.forEach(p => p.visible = false);
      patchOutlines.forEach(outline => outline.visible = false);

  particles.forEach(p => {
    p.mesh.position.copy(p.qrPos);
    p.mesh.visible = true;
    p.mesh.rotation.set(0,0,0);
    p.mesh.material.opacity = 1;
  });

} else {
  ball.material.depthWrite = true;
  patches.forEach(p => p.material.depthWrite = true);
  ball.visible = true;
  seam.visible = true;
  patches.forEach(p => p.visible = true);
  patchOutlines.forEach(outline => outline.visible = true);

  particles.forEach(p => {
    p.mesh.position.copy(p.ballPos);
    p.mesh.visible = false;
    p.mesh.material.opacity = 0;
  });

}
    }
  }

  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  camera.position.z = width < 600 ? 10.4 : 9.2;
}
window.addEventListener("resize", resize);
resize();

await buildQR(DEFAULT_URL);
requestAnimationFrame(render);
