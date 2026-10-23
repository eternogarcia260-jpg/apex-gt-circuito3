# Circuito 3 — transformación acuática

Marina Bay conserva sus waypoints y la lógica de carrera, junto con asfalto, curvas, bordillos, señalización, parrilla, barreras, vallas e iluminación. Se han retirado del montaje activo el contexto urbano y su suelo, los bloques de ciudad, los hitos y skyline, las gradas/pabellones y los edificios del pit. Se mantienen el pit apron y el muro con su colisionador, pero ya no se generan edificios ni colisiones fantasma de garajes.

La bahía recortada se sustituyó por una superficie oceánica continua de 6 km × 6 km bajo y alrededor de todo el trazado. El nivel de mar permanece en Y=-0,45 m frente a la calzada en Y=0,02 m, una separación de 0,47 m que mantiene el asfalto seco y deja el agua visible desde la pista. El agua tiene paleta azul oceánica y conserva las ondas y los reflejos; no se genera suelo urbano ni lecho visible debajo del circuito.

Validación realizada con `npm run lint` y `npm run build -- --base=./`. Las capturas aéreas de antes/después usan la misma cámara, y se añadió una captura a nivel de pista para comprobar la visibilidad del agua.
