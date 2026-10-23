# Auditoría técnica del Circuito 3 — Marina Bay

**Fecha:** 22 de octubre de 2026  
**Alcance:** circuito `singapore_marina`, geometría, renderizado, agua, sombras, colisiones, física y comportamiento de carrera.  
**Conclusión ejecutiva:** hay fallos funcionales concretos en boxes, reinicio, salida de IA y DRS; y un cuello de botella gráfico muy severo cuando el agua es visible. El trazado base y sus barreras, en cambio, pasan las comprobaciones geométricas realizadas. No se modificó la lógica del juego durante esta auditoría.

## Resumen: qué explica “no va nada fluido”

El problema más contundente es que el agua nocturna, en sus calidades media/alta, ejecuta **dos recorridos completos adicionales de la escena por cada fotograma visible** (una captura para refracción y otra para reflexión). En calidad alta, cada captura usa un render target de 512 × 512; en media, 256 × 256. A eso se añade bloom de cuatro pasos cuando la calidad es media/alta, sombras PCF con hasta 2048 × 2048 y una escena con cientos de grupos de geometría que multiplican las llamadas de dibujo. El coste depende de la cámara: cuando la vista descubre más bahía y paisaje, aumenta aún más el número de triángulos.

En la prueba integrada del proyecto se midieron aproximadamente **476 llamadas de dibujo por fotograma y 226.474 triángulos** en la vista de recta; una vista amplia de la bahía alcanzó **250 llamadas y 307.815 triángulos** por fotograma. La menor cantidad de llamadas en esa segunda vista no significa que sea más barata: procesa muchos más triángulos. En las mediciones acumuladas de tres renders, el contador del agua registró seis refracciones y seis reflexiones, exactamente dos capturas por render exterior. La captura usó Chromium/SwiftShader: estos conteos de passes y geometría son útiles para localizar trabajo; **los tiempos absolutos de esa máquina no son un benchmark del móvil del usuario**.

Además, durante la ejecución auditada el perfil adaptativo acabó reduciendo el DPR aplicado a **0,88**, señal de que el sistema detectó tiempos de cuadro por encima de su umbral y ya estaba degradando resolución. No puede esperarse que ese reescalado por sí solo compense varios renders completos de la escena cada fotograma.

## Bugs funcionales confirmados

1. **Parada en boxes desalineada con Marina Bay (prioridad crítica).** El circuito define la zona de boxes alrededor de `x=697..728, z=-185..25` (`SingaporeCircuitConfig.ts:24-29`); la lógica global que comprueba la entrada y las coordenadas del cajón usa cajas fijas cercanas a `x=-75..pitBoxX, z=-121..-106` (`RacingGameEngine.ts:918-953`). Por ello, el HUD puede reconocer que el coche está en la zona C3 pero el piloto automático/servicio de boxes no comparte la geometría correcta. Es consistente con que la función de pit stop esté “bugueada”. Solución segura: modelar puntos/volúmenes de entrada, parada y salida por circuito. Hasta disponer de ellos, es más seguro no iniciar el autopiloto de C3 que reutilizar las coordenadas del circuito 1.

2. **Reinicio/reposición lleva el coche fuera del Circuito 3 (crítico).** `resetCarToTrack()` fija `(-35,-130, π/2)` en `RacingGameEngine.ts:1269-1275`; la parrilla real de Marina Bay es `(687.89,-108.18,-2.996)` en `SingaporeCircuitConfig.ts:30-44`. Un botón de recuperación/reinicio puede enviar al jugador fuera de la pista. El encuadre inicial también tiene coordenadas heredadas del circuito anterior (`RacingGameEngine.ts:442-448`). Solución: derivar posición y yaw de `activeCircuit.gridSlots.player`.

3. **La IA se orienta hacia el circuito equivocado en la parrilla (alto).** Aunque la parrilla del circuito asigna su yaw al vehículo (`AICarController.ts:262-291`), el bloqueo de salida vuelve a asignar `Math.PI/2` (`AICarController.ts:337-369`), mientras C3 requiere `-2.996`. Los rivales pueden quedar atravesados durante la salida y provocar impactos/recuperaciones. Solución: guardar el yaw inicial del slot y restaurarlo al liberar el bloqueo.

4. **DRS queda activo en todo el trazado pese a que C3 declara cero zonas (alto).** Marina Bay declara `drsZonesCount: 0` y `drsZones: []` (`SingaporeCircuitConfig.ts:21-22`). `RaceLoopManager.updateDRSSystem()` trata el array vacío como “elegible en toda la pista” (`RaceLoopManager.ts:140-145`). Esto altera la física y las condiciones de IA. Solución: array vacío significa DRS desactivado; solo habilitarlo con zonas explícitas.

5. **Parámetros de ritmo inconsistentes (medio).** `SINGAPORE_RACE_PACE_SPEED = 61.15 m/s` implica una vuelta de 80,57 s sobre los 4.927 m; `expectedLapTimeSec` se declara como 93,8 s (`SingaporeWaypoints.ts:16-17`; `SingaporeCircuitConfig.ts:16-18`). La discrepancia es 13,23 s (14,1%). No es causa de FPS, pero puede desincronizar el ritmo de la IA y las expectativas de tiempo.

## Mediciones de rendimiento del circuito

| Métrica de Marina Bay | Medida |
|---|---:|
| Objetos en el grupo de pista | 300 |
| Meshes | 223 |
| InstancedMesh | 42 |
| Geometrías únicas / materiales únicos / texturas | 158 / 67 / 15 |
| Triángulos geométricos base | 64.227 |
| Triángulos efectivos contando instancias | 173.871 |
| Vértices efectivos | 303.526 |
| Luces locales de C3 | 6 SpotLight, ninguna proyecta sombras |
| Meshes casters / receivers de sombras | 174 / 222 |
| Materiales transparentes enlazados | 29 |
| Grupos de geometría | 816 |
| Obstáculos estáticos | 1.251 |

La escena completa, además del grupo de pista, tiene unos 1.953 objetos, 1.416 meshes, 208 materiales únicos y 32 texturas. El coste no proviene de una única malla gigante: una parte importante es la suma de objetos y grupos que generan múltiples draws, repetidos además durante las capturas del agua y en el mapa de sombras.

### Principales contribuyentes geométricos medidos

| Elemento | Triángulos efectivos aprox. | Observación |
|---|---:|---|
| `C3_Raffles_WarmWindows` | 42.660 | 3.555 instancias; mayor contribuyente individual y proyecta sombras. |
| `C3_FencePosts` | 24.940 | 1.247 instancias; sin sombras. |
| Ventanas frontal y trasera de MBS | 8.244 cada lote | 687 instancias por lote; ambas proyectan sombras. |
| `C3_ContinuousSafetyWalls` | 7.480 | Malla continua razonable; no conviene alterar colisiones primero. |
| Bordillos azules/blancos | 4.588 / 4.596 | Dos tiras; contribución secundaria. |
| Farolas visuales | 218 postes, 218 bases y 218 luminarias | Geometría instanciada; las luminarias visuales no son luces reales. |
| Cápsulas de la noria | 28 × 420 | Transparencia y varios grupos generan coste de ordenación/draws; transformaciones actualizadas por tick de física. |

Hay **816 grupos de geometría** para 223 meshes. Muchos cubos de un solo material conservan grupos por cara innecesarios; ejemplos: fachadas/ventanas de edificios (`SingaporeArchitectureDetails.ts:14-40`), edificios de MBS (`SingaporeTrackBuilder.ts:840-854`) y gradas (`:960-989`). El propio `InstancedMesh` puede emitir varias llamadas por grupos de geometría. Después de resolver las capturas de agua, merece la pena fusionar los grupos solo cuando el mesh utiliza un único material; no hacerlo en luminarias/cabinas que requieren materiales distintos.

## Verificaciones del trazado y las colisiones

Los datos no respaldan que la pista base se auto-intersecte ni que sus barreras invadan el carril:

- 650 waypoints; longitud calculada 4.923,09 m frente a 4.927 m declarados: error de −3,91 m (−0,079%).
- Longitud de segmento: 7,093–7,590 m. Error máximo entre yaw suministrado y calculado: 0,000050 rad.
- Cero auto-intersecciones entre segmentos no adyacentes; separación mínima entre ellos: 21,997 m.
- Despeje mínimo del eje de pista al collider: 7,931 m; ninguna invasión de la banda de colisión del coche.
- Los sectores se cruzan en el orden esperado y la puerta de meta completa la vuelta en el waypoint inicial.
- Los 1.251 obstáculos se indexan en una cuadrícula espacial: 403 celdas, 2.586 referencias; una consulta de nueve celdas devuelve 13–46 candidatos (media 28). El coste de colisión existe, pero su organización espacial hace que sea una prioridad inferior al render, agua y sombras para explicar un stutter constante.

El trazado tiene puntos cada ~7,57 m, pero están matemáticamente consistentes. La resolución podría afectar precisión de seguimiento en curvas cerradas y debe revisarse por separado; no hay evidencia aquí de que explique la caída principal de FPS.

## Hallazgos visuales secundarios

- **Gradas sin público:** se crea `GrandstandCrowdSystem` en `SingaporeTrackBuilder.ts:87-90`, pero la rutina de gradas solo crea escalones y cubiertas (`:960-989`); el análisis de runtime no detectó población ni grupo de crowd adjunto. Esto explica gradas vacías, no el stutter.
- No se encontró una fuga obvia en el ciclo de vida del builder: su `dispose()` libera agua, crowd y recursos Three.js deduplicados (`SingaporeTrackBuilder.ts:1115-1140`). Una fuga tras cambiar varias veces de circuito todavía tendría que medirse en un dispositivo real.
- Las seis luces dinámicas C3 son shadowless y se colocan cerca de la cámara; no son el origen de múltiples shadow maps locales. Sí existe una luz direccional global y 174 casters C3.
- En alta, el shadow map es 2.048² (`GraphicsQualityManager.ts:46-57, 167-187`) y el seguimiento de la luz se recentra al superar 1,2 m (`RacingGameEngine.ts:1015-1032`). A velocidad de carrera eso mueve la fuente casi constantemente. Es un coste GPU plausible adicional, aunque menor y menos directamente probado que los dos renders extra de agua.

## Plan de corrección recomendado, de menor riesgo a mayor impacto

1. **Eliminar el render duplicado de agua en móvil/calidad media.** En media, usar el shader de absorción/color existente sin capturas espejo/reflexión; conservar reflejos dinámicos solo en calidad alta o actualizarlos cada varios fotogramas y solo si cámara/posición cambió de forma apreciable. No hacer `renderer.render(scene, ...)` dos veces por frame por debajo de hardware potente.
2. **No ejecutar bloom en calidad media.** El bloom C3 hace bright pass, blur horizontal, blur vertical y composición a pantalla completa (`SingaporeSelectiveBloom.ts:210-246`). Dejarlo para alta, manteniendo el agua sin capturas en media. El nivel bajo ya omite bloom.
3. **Ajustar C3 para móvil.** Usar calidad baja o media reducida de forma específica al circuito y al hardware; bajar resolución interna y mapa de sombras sin desactivar controles ni cambiar física. El heurístico actual identifica el móvil pero lo deja en media (`GraphicsQualityManager.ts:107-123`), y la media aún permite las capturas del agua.
4. **Reducir llamadas de dibujo de geometría monomaterial.** Compactar grupos redundantes (816 medidos) y evaluar reducción de casters lejanos en ventanas/detalles; conservar grupos genuinamente multimaterial. Hacer comparación A/B para asegurar que las normales y el aspecto no cambien.
5. **Revisar la actualización del mapa de sombras.** Medir y limitar frecuencia/área del shadow map de C3 sin eliminar la sombra dinámica del coche ni desplazar bruscamente la luz.
6. **Corregir los cuatro bugs funcionales de gameplay.** Boxes por circuito, reset desde la parrilla activa, yaw real de la IA y DRS vacío desactivado; después ajustar ritmo esperado/pace. Añadir pruebas dirigidas a cada transición.
7. **Revisar presentación de gradas y noria** como corrección visual/CPU secundaria; no priorizarla antes de eliminar pases redundantes de escena.

## Evidencia y reproducibilidad

- [Perfil de la escena y passes de render (JSON)](/home/ubuntu/jobs/job_itCXkBAN/marina_circuit_profile.json)
- [Auditoría de waypoints, colisiones y ritmo (JSON)](/home/ubuntu/jobs/job_itCXkBAN/marina_geometry_audit.json)
- [Mediciones de recursos de runtime (JSON)](/home/ubuntu/jobs/job_itCXkBAN/marina_resource_metrics.json)
- `npm run lint` finalizó sin errores (`tsc --noEmit`). La compilación de producción también había finalizado correctamente antes de esta auditoría.

**Límite de la conclusión:** las mediciones de render se hicieron en Chromium con backend de software en Sandbox, no en el teléfono del usuario. El número de capturas, meshes, grupos y triángulos es evidencia directa del código en ejecución; los FPS exactos en Android requieren medir en ese dispositivo después de aplicar y comparar los cambios.
