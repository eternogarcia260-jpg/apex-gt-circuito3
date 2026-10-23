# Actualización de Apex GT — Circuito 1

## Cambios

- Se sustituyó el anillo montañoso del Circuito 1 por una corona panorámica de 360° basada en el campo de alturas y el tratamiento procedural de roca, estratos, vegetación y nieve del HTML de referencia.
- Se conservaron la pista, el terreno local, los edificios, las gradas, el cielo, la iluminación y los demás elementos del juego.
- El borde interior de la corona empieza a 225 m del centro del trazado (el perímetro de pista y escapes llega aproximadamente a 200 m); el relieve se introduce gradualmente entre 300 y 410 m para dejar la transición llana por fuera del circuito.
- La superficie llana exterior usa ahora la paleta/ruido alpinos de roca y suelo del material de montaña, sin ondularla ni cambiar su geometría. Se conserva el anillo inmediato de césped oscuro alrededor de la pista; las manchas verdes exteriores dejan de tener el acabado oscuro sin mover ningún elemento.
- La máscara de esa textura excluye geométricamente rectas, curvas y escapatorias, de modo que el material del terreno exterior no tiñe el asfalto.
- La nueva corona usa una malla y no proyecta ni recibe sombras dinámicas. En la validación de desarrollo produjo 21.097 vértices y 41.472 triángulos.
- Los dos extremos angulares de la corona se mezclan en una unión periódica continua para evitar un corte visible en el horizonte.
- Los demás circuitos continúan usando sus constructores existentes.

## Ejecutar el proyecto

Requiere Node.js y npm.

```bash
npm ci
npm run dev
```

Para comprobar tipos y crear la versión de producción:

```bash
npm run lint
npm run build
```

## APK

El APK entregado es una compilación Android **debug** para instalación y prueba. No es un APK de release firmado con una clave privada de distribución de Google Play.
