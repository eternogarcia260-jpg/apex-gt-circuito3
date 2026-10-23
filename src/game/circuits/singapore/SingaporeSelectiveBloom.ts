import * as THREE from 'three';

export interface C3SelectiveBloom {
  render(renderer: THREE.WebGLRenderer, quality: 'low' | 'medium' | 'high'): void;
  dispose(): void;
  readonly diagnostics: Readonly<{
    enabled: boolean;
    width: number;
    height: number;
    bloomWidth: number;
    bloomHeight: number;
    quality: 'low' | 'medium' | 'high' | null;
    lastError: string | null;
    renders: number;
    note: string;
  }>;
}

const FULLSCREEN_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAGMENT = /* glsl */`
  uniform sampler2D tInput;
  uniform float threshold;
  varying vec2 vUv;
  void main() {
    vec3 c = sRGBTransferEOTF(texture2D(tInput, vUv)).rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float knee = 0.06;
    float soft = clamp((luma - threshold + knee) / (2.0 * knee), 0.0, 1.0);
    soft = soft * soft * knee;
    float contribution = max(luma - threshold, soft) / max(luma, 1e-5);
    gl_FragColor = vec4(c * contribution, 1.0);
  }
`;

const BLUR_FRAGMENT = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 direction;
  uniform vec2 texelSize;
  varying vec2 vUv;
  void main() {
    vec2 stepUv = direction * texelSize;
    vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
    c += texture2D(tInput, vUv + stepUv * 1.384615).rgb * 0.316216;
    c += texture2D(tInput, vUv - stepUv * 1.384615).rgb * 0.316216;
    c += texture2D(tInput, vUv + stepUv * 3.230769).rgb * 0.070270;
    c += texture2D(tInput, vUv - stepUv * 3.230769).rgb * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float intensity;
  varying vec2 vUv;
  void main() {
    vec3 sceneColor = sRGBTransferEOTF(texture2D(tScene, vUv)).rgb;
    vec3 bloomColor = texture2D(tBloom, vUv).rgb;
    gl_FragColor = vec4(sceneColor + bloomColor * intensity, 1.0);
    #include <colorspace_fragment>
  }
`;

/** LDR bloom sobre la imagen final de pantalla; no reconstruye radiancia HDR. */
export function createC3SelectiveBloom(): C3SelectiveBloom {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const brightMaterial = new THREE.ShaderMaterial({
    uniforms: { tInput: { value: null }, threshold: { value: 0.9 } },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BRIGHT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  // Use the real material at construction to avoid leaking Mesh's default material.
  const quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material> = new THREE.Mesh(geometry, brightMaterial);
  quad.frustumCulled = false;
  scene.add(quad);
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tInput: { value: null },
      direction: { value: new THREE.Vector2(1, 0) },
      texelSize: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      intensity: { value: 0.12 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  let source: THREE.FramebufferTexture | null = null;
  let brightTarget: THREE.WebGLRenderTarget | null = null;
  let blurTarget: THREE.WebGLRenderTarget | null = null;
  let width = 0;
  let height = 0;
  let bloomWidth = 0;
  let bloomHeight = 0;
  let lastQuality: 'low' | 'medium' | 'high' | null = null;
  let lastError: string | null = null;
  let disposed = false;
  let unavailable = false;
  let renderCount = 0;
  let frameCounter = 0;
  const drawingBufferSize = new THREE.Vector2();
  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();
  const thresholdSrgb90Linear = new THREE.Color(0.9, 0.9, 0.9).convertSRGBToLinear().r;
  const thresholdSrgb92Linear = new THREE.Color(0.92, 0.92, 0.92).convertSRGBToLinear().r;

  const diagnostics = Object.freeze({
    get enabled() { return !disposed && lastQuality !== 'low'; },
    get width() { return width; },
    get height() { return height; },
    get bloomWidth() { return bloomWidth; },
    get bloomHeight() { return bloomHeight; },
    get quality() { return lastQuality; },
    get lastError() { return lastError; },
    get renders() { return renderCount; },
    note: 'LDR selectivo: captura bytes del framebuffer final y decodifica sRGB explícitamente; no HDR ni recuperación de highlights ya recortados. Umbral display sRGB (0.9/0.92) convertido a lineal para el luma del shader.',
  });

  function releaseBuffers(): void {
    source?.dispose();
    source = null;
    brightTarget?.dispose();
    brightTarget = null;
    blurTarget?.dispose();
    blurTarget = null;
    width = height = bloomWidth = bloomHeight = 0;
  }

  function ensureBuffers(renderer: THREE.WebGLRenderer, quality: 'low' | 'medium' | 'high'): boolean {
    if (quality === 'low') {
      releaseBuffers();
      lastQuality = quality;
      return false;
    }
    renderer.getDrawingBufferSize(drawingBufferSize);
    const w = Math.max(1, Math.floor(drawingBufferSize.x));
    const h = Math.max(1, Math.floor(drawingBufferSize.y));
    const factor = quality === 'high' ? 2 : 4;
    const bw = Math.max(1, Math.min(640, Math.ceil(w / factor)));
    const bh = Math.max(1, Math.min(640, Math.ceil(h / factor)));

    if (!source || width !== w || height !== h) {
      releaseBuffers();
      width = w;
      height = h;
      source = new THREE.FramebufferTexture(w, h);
      source.colorSpace = THREE.NoColorSpace; // Byte-identical framebuffer copy; decode explicitly in shaders.
      source.generateMipmaps = false;
    }
    if (!brightTarget || bloomWidth !== bw || bloomHeight !== bh) {
      brightTarget?.dispose();
      blurTarget?.dispose();
      brightTarget = new THREE.WebGLRenderTarget(bw, bh, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });
      blurTarget = new THREE.WebGLRenderTarget(bw, bh, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });
      brightTarget.texture.colorSpace = THREE.NoColorSpace;
      blurTarget.texture.colorSpace = THREE.NoColorSpace;
      bloomWidth = bw;
      bloomHeight = bh;
    }
    lastQuality = quality;
    return true;
  }

  function draw(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  }

  function render(renderer: THREE.WebGLRenderer, quality: 'low' | 'medium' | 'high'): void {
    if (disposed || unavailable || quality === 'low' || (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float'))) {
      if (!disposed) ensureBuffers(renderer, 'low');
      return;
    }
    const savedTarget = renderer.getRenderTarget();
    const savedAutoClear = renderer.autoClear;
    const savedInfoAutoReset = renderer.info.autoReset;
    renderer.getViewport(savedViewport);
    renderer.getScissor(savedScissor);
    const savedScissorTest = renderer.getScissorTest();
    try {
      if (!ensureBuffers(renderer, quality) || !source || !brightTarget || !blurTarget) return;
      renderer.info.autoReset = false;
      renderer.setScissorTest(false);
      renderer.copyFramebufferToTexture(source);
      renderer.autoClear = true;
      // In medium quality keep the bloom composite every frame, but refresh
      // extraction and blur at 30 Hz. The previous bloom buffer remains a
      // stable temporal approximation for the intervening frame.
      const refreshBloom = quality === 'high' || (frameCounter++ % 2 === 0);
      if (refreshBloom) {
        brightMaterial.uniforms.tInput.value = source;
        // Explicit sRGB decode yields linear RGB; threshold is converted from display space.
        brightMaterial.uniforms.threshold.value = quality === 'high' ? thresholdSrgb90Linear : thresholdSrgb92Linear;
        draw(renderer, brightMaterial, brightTarget);

        blurMaterial.uniforms.texelSize.value.set(1 / bloomWidth, 1 / bloomHeight);
        blurMaterial.uniforms.tInput.value = brightTarget.texture;
        blurMaterial.uniforms.direction.value.set(1, 0);
        draw(renderer, blurMaterial, blurTarget);
        blurMaterial.uniforms.tInput.value = blurTarget.texture;
        blurMaterial.uniforms.direction.value.set(0, 1);
        draw(renderer, blurMaterial, brightTarget);
      }

      compositeMaterial.uniforms.tScene.value = source;
      compositeMaterial.uniforms.tBloom.value = brightTarget.texture;
      compositeMaterial.uniforms.intensity.value = quality === 'high' ? 0.14 : 0.11;
      // Fullscreen composite replaces color; do not clear main-scene depth.
      renderer.autoClear = false;
      draw(renderer, compositeMaterial, null);
      renderCount++;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      unavailable = true;
      releaseBuffers();
      lastQuality = 'low';
    } finally {
      renderer.setRenderTarget(savedTarget);
      renderer.autoClear = savedAutoClear;
      renderer.info.autoReset = savedInfoAutoReset;
      renderer.setViewport(savedViewport);
      renderer.setScissor(savedScissor);
      renderer.setScissorTest(savedScissorTest);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    releaseBuffers();
    geometry.dispose();
    brightMaterial.dispose();
    blurMaterial.dispose();
    compositeMaterial.dispose();
    scene.clear();
  }

  return { render, dispose, diagnostics };
}
