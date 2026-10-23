# Auditoría y corrección — Circuito 3: solo sol y rendimiento

**Fecha:** 23 de octubre de 2026. **Circuito:** Marina Bay (`singapore_marina`).

## Resultado

En C3 sólo contribuye como fuente de iluminación la luz direccional solar. Se apagan el relleno, los seis focos dinámicos, las emisiones artificiales de materiales y cualquier otra luz presente en la escena durante el render de Marina Bay. Al salir de C3, el estado temporal de las demás luces se restaura. Los objetos físicos de los focos permanecen.

No simplifiqué geometría ni reduje resolución de reflejos, sombras, bloom o texturas. El cabezal PBR mantiene los mismos vértices, material y matrices; únicamente se divide en lotes espaciales para habilitar el culling de los sectores fuera de la vista.

## Qué hacía lenta la escena

**Cabezal PBR repetido.** El GLB tiene 14.047 triángulos por cabezal. Las 218 instancias representan hasta **3.062.246 triángulos** si entran todas en un pase. Antes estaban reunidas en una sola `InstancedMesh` cuyo volumen cubría casi todo el circuito de 4,9 km, lo cual impedía culling eficaz de las instancias lejanas. El espejo del agua dibuja de nuevo los objetos que alcanza a ver.

**Reflejo y postproceso.** El mar ejecuta una pasada de reflexión en tiempo real; mantiene resolución de 192 px en desktop y 96 px en ventanas estrechas. El bloom conserva sus cuatro pasadas de pantalla. El perfil alto sigue usando sombras de 2048 px. No reduje esos ajustes para obtener fluidez a costa de fidelidad.

**Precarga ajena a Marina Bay.** La pantalla de carga invocaba el preloader genérico incluso después de elegir C3. Ese preloader intentaba cargar montañas alpinas, assets del `TrackBuilder`, vegetación y residencias Royal Engine, recursos usados por Speedway, no por el constructor actual de Singapore. El smoke test registró fallbacks al no encontrar la textura horneada de montañas ni el GLB de residencias. Ahora sólo en C3 se omiten esas etapas; se conserva la precarga del público, que sí usa el circuito. En los demás circuitos se mantiene la ruta de precarga completa.

**Coste redundante y sombras.** El motor generaba un PMREM nocturno que el override de C3 descartaba después al poner `scene.environment = null`; ahora se omite para Singapore y se libera el mapa previo al sustituirlo en otro circuito. La posición fija previa del sol estaba a 1.200 unidades con `shadow.camera.far = 190`; la nueva posición mantiene el mismo vector solar y acerca el objetivo de sombras a 120 unidades de la cámara.

**Perfil del mar.** `update()` restablecía cada tick la distorsión de agua alta, anulando el perfil seleccionado por `setQuality()`. Se corrigió para respetar el perfil actual. También se reutilizan vectores de cámara en el callback de C3 para evitar asignaciones innecesarias por fotograma.

## Correcciones aplicadas

Los focos móviles quedan con intensidad cero, invisibles para el renderer y sin trabajo de actualización, pero no se retira ninguna estructura. Los materiales emisivos activos del grupo C3 se ponen a cero y se desasocian sus mapas de emisión; el material del GLB que llega de forma asíncrona también nace apagado. Las 218 instancias físicas se distribuyen en **28 lotes de hasta ocho cabezales**, conservando todo su detalle y sus transformaciones.

El override C3 etiqueta la direccional principal como sol, deshabilita las demás fuentes durante el render y luego las restaura. La hemisférica y el IBL quedan apagados en Marina Bay; el cielo PELAGIC y el sol visual permanecen.

## Validación y límites

`npm run lint` (TypeScript) y `npm run build -- --base=./` pasan. El servidor final responde HTTP 200 y entrega los módulos actualizados. El SHA-256 del ZIP original permanece idéntico antes y después del empaquetado.

Tras hacer selectiva la precarga, el smoke test de Chromium headless llegó al menú, seleccionó Marina Bay y creó el canvas/UI de carrera (temporizador, vuelta y telemetría). No se registró un error JavaScript de página. La captura de pantalla agotó el tiempo bajo SwiftShader; por ello no hay comprobación visual final ni una medición válida de FPS. Dos 404 genéricos aparecen en el menú, antes de seleccionar circuito; no identifiqué su URL en esta prueba y no los atribuyo a C3. El resultado de software no sustituye una medición sostenida en el teléfono real.

No se modificaron waypoints, dimensiones, curvas, colisiones ni geometría del trazado. Archivos de código modificados: `src/App.tsx`, `src/game/preload/AssetPreloader.ts`, `src/game/circuits/singapore/SingaporeCinematicAtmosphere.ts`, `src/game/circuits/singapore/SingaporeFloodlightDesign.ts`, `src/game/circuits/singapore/SingaporeTrackFloodlights.ts`, `src/game/circuits/singapore/SingaporeWaterSurface.ts`, `src/game/RacingGameEngine.ts` y `src/game/environment/DynamicSkySystem.ts`.
