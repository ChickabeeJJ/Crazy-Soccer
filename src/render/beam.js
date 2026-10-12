// Soft volumetric light beam: an open cone/cylinder whose surface fades towards its silhouette
// and both ends, so you see a glow rather than the shape of the mesh
import * as THREE from 'three';

export function softBeamMaterial(color = 0xfff1d0, opacity = 0.1, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTop: { value: opts.top ?? 1 }, uBottom: { value: opts.bottom ?? 0.35 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = uv.y;
        vD = distance(cameraPosition, wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTop; uniform float uBottom;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float edge = pow(facing, 3.0);
        float along = mix(uBottom, uTop, vY) * smoothstep(0.0, 0.25, vY) * smoothstep(1.0, 0.82, vY);
        float nearFade = smoothstep(3.0, 18.0, vD); // no hard surface when the camera is close to or inside the beam
        gl_FragColor = vec4(uColor * edge * along * nearFade * uOpacity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  // keep material.opacity working for code that animates it
  Object.defineProperty(m, 'opacity', { get() { return m.uniforms ? m.uniforms.uOpacity.value : 1; }, set(v) { if (m.uniforms) m.uniforms.uOpacity.value = v; }, configurable: true });
  return m;
}
