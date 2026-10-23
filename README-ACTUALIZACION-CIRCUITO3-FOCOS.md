# Circuito 3 — luminarias y mástiles PBR en Three.js

## Cambios incluidos

Se rediseñó el conjunto de las 218 luminarias de Marina Bay, no solo el cabezal. Se mantiene el cabezal GLB como una `InstancedMesh` compartida: se neutralizó su dominante marrón conservando el microdetalle de la textura original, el mapa normal PBR y la lectura de los 21 módulos ópticos. Cada módulo recibe un emisor cerámico individual discreto y el conjunto posterior lleva siete aletas de aluminio mecanizado.

También se revisó el mástil: sección cónica más robusta (radio aproximado de 0,46 m en la base y 0,245 m arriba), material de acero galvanizado/pintura industrial con mapas de color, rugosidad y normal, abrazaderas, conduit exterior de alimentación segmentado con acoples, armario de servicio con puerta y cierre, y brazo de soporte. El pie incorpora hormigón con variación superficial propia, placa de acero, cuatro anclajes hexagonales y arandelas. Las nuevas geometrías repetidas se instancian por tipo para evitar una malla independiente por luminaria.

Se conservan las 21 ópticas orientadas al trazado, las 218 ubicaciones y los seis focos dinámicos existentes. No se crea una luz dinámica por cada cabeza; el rig original sigue proporcionando la iluminación móvil del circuito. La carga del GLB sigue siendo asíncrona y el rig procedural permanece como respaldo si falla el asset.

## Comprobaciones

`npx tsc --noEmit` y `npm run build -- --base=./` finalizan correctamente. Se revisó el resultado en Three.js con vistas frontal, posterior, conjunto completo y primer plano del mástil/base. El empaquetado Android se realiza aparte con Capacitor y Gradle; el APK de depuración se incluye en la carpeta `delivery`.

## Capturas

- [Antes — rig procedural anterior](docs/validation/C3-floodlights-antes-procedural.webp)
- [Después — cabezal PBR, mástil, conduit y anclaje](docs/validation/C3-floodlights-despues-mastil-pbr.webp)
