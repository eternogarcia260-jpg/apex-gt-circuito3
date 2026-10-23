import * as THREE from 'three';

/**
 * F1SkidShader - Material personalizado de alta fidelidad para depósito de goma de slicks de Fórmula 1.
 * 
 * Características gráficas:
 * - Oscurecimiento multiplicativo sobre el asfalto (elimina el aspecto de cinta plástica grisácea).
 * - Perfil de presión de contacto con bandas oscuras en hombros (efecto de camber y carga lateral).
 * - Bordes difusos suaves que se integran en los poros del firme sin cortes poligonales secos.
 * - Estriado longitudinal y micro-desgarro de compuestos blandos de competición (soft compound graining).
 * - Acoplamiento con el árido del asfalto mediante ruido procedural de alta frecuencia en coordenadas de mundo.
 * - Brillo sutil de goma curada y caliente en ángulos rasantes (Fresnel).
 * - Envejecimiento térmico progresivo: las marcas frescas son negro carbón intenso y con las vueltas
 *   se asientan formando la línea de carrera engomada (racing rubber line).
 */
export function createF1SkidMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 skidData; // x: intensity [0..1], y: wheelIndex [0..3], z: birthTime (s), w: isRear [0, 1]

      varying vec2 vUv;
      varying vec4 vSkidData;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vSkidData = skidData;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;

      varying vec2 vUv;
      varying vec4 vSkidData;
      varying vec3 vWorldPosition;

      // Hash procedural rápido y determinista para micro-textura de grano sin sobrecarga en GPU
      float hash21(vec2 p) {
        p = fract(p * vec2(233.34, 851.73));
        p += dot(p, p + 23.45);
        return fract(p.x * p.y);
      }

      void main() {
        float intensity = vSkidData.x;
        if (intensity <= 0.001) {
          discard;
        }

        float u = vUv.x;
        float v = vUv.y;
        float birthTime = vSkidData.z;
        float isRear = vSkidData.w;

        // 1. Bordes difusos (feathered edges): desvanecimiento suave hacia los extremos de la huella
        // Elimina el aspecto de cinta adhesiva con bordes geométricos cortados
        float edgeFade = smoothstep(0.00, 0.14, u) * smoothstep(1.00, 0.86, u);

        // 2. Perfil de Presión F1: hombros exteriores cargados por caída negativa (camber) y deformación lateral
        // Crestas principales de fricción en u = 0.22 (hombro interior/exterior) y u = 0.78
        float leftShoulder = exp(-pow((u - 0.22) / 0.16, 2.0));
        float rightShoulder = exp(-pow((u - 0.78) / 0.16, 2.0));
        float centerCrown = 0.54 * exp(-pow((u - 0.50) / 0.24, 2.0));
        float pressureProfile = max(centerCrown, max(leftShoulder, rightShoulder) * 1.20);

        // 3. Estriado longitudinal de goma fundida (micro-surcos de cizallamiento en sentido de deslizamiento)
        float striationBands = sin(u * 62.83) * 0.16 + sin(u * 125.66) * 0.09;
        float striations = clamp(0.84 + striationBands, 0.60, 1.08);

        // 4. Micro-grano procedural de desgarro de compuesto blando (rubber graining & marbles)
        vec2 grainCoord = vec2(floor(u * 96.0), floor(v * 18.0));
        float microTear = hash21(grainCoord);
        float compoundGraining = 0.87 + 0.13 * microTear;

        // 5. Acoplamiento textural con árido del asfalto (ligado a coordenadas espaciales del circuito)
        vec2 roadGrid = floor(vWorldPosition.xz * 24.0);
        float asphaltGrain = hash21(roadGrid);
        float aggregateCoupling = 0.85 + 0.15 * asphaltGrain;

        // 6. Envejecimiento térmico y curado progresivo por vueltas de carrera
        // Marcas recién estampadas (< 3s) son carbón puro caliente; con el paso de las vueltas
        // se asientan y forman la huella engomada permanente de la trazada (~65% de persistencia)
        float age = max(0.0, uTime - birthTime);
        float thermalCure = mix(1.0, 0.68, smoothstep(2.5, 40.0, age));

        // Densidad total de goma depositada sobre el firme
        float depositDensity = pressureProfile * striations * compoundGraining * aggregateCoupling * edgeFade * intensity * thermalCure;
        depositDensity = clamp(depositDensity, 0.0, 0.94);

        if (depositDensity < 0.015) {
          discard;
        }

        // 7. Base cromática negro carbón profundo con matiz oleoso asfáltico (Cero grisáceo lechoso)
        vec3 carbonBase = vec3(0.013, 0.012, 0.011);

        // 8. Brillo especular y Fresnel en rasante de goma fresca
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.5);
        float freshGloss = (1.0 - smoothstep(0.0, 10.0, age)) * 0.32;
        vec3 rubberSheen = vec3(0.07, 0.08, 0.10) * fresnel * freshGloss * depositDensity;

        // En mezcla alfa estándar, una base casi negra con opacidad alta multiplica/tiñe la luz del suelo
        gl_FragColor = vec4(carbonBase + rubberSheen, depositDensity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2.0,
    polygonOffsetUnits: -4.0,
  });
}
