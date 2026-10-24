# Manual de G-Clock

G-Clock es un **reloj de estudio para locutores de radio**: la clásica esfera de 60 minutos con marcadores de stopset, titulares de noticias de los feeds que elijas, tiempo opcional, un interruptor On Air / Rec, un temporizador de grabación con programas, bloques y una cuenta atrás 3·2·1, y un **temporizador MicTime** opcional que cronometra una intervención a partir de un mensaje MIDI, una tecla o un nivel de audio. Es una app de escritorio gratuita para Windows, macOS y Linux de OnAir Garage.

## Instalación y primer inicio

Descarga el instalador para tu sistema desde la página de [Releases](https://github.com/djgragra/g-clock/releases) y compruébalo con `SHA256SUMS.txt`:
`G-Clock-Setup-<V>.exe` (Windows), `G-Clock-<V>-arm64.dmg` (Mac con Apple silicon), `G-Clock-<V>.dmg` (Mac con Intel), `G-Clock-<V>.AppImage` (Linux).
La app es gratuita y no tiene certificado de Apple ni de Microsoft, así que en el primer inicio puede aparecer un aviso.

- **Windows**: ejecuta el instalador. Si SmartScreen dice «Windows protegió su PC», pulsa *Más información* → *Ejecutar de todos modos*.
- **macOS**: abre la imagen de disco y arrastra la app a Aplicaciones. La app tiene una firma ad-hoc, que es lo que necesita un Mac Apple silicon para abrirla. El primer inicio muestra igualmente el aviso «desarrollador no identificado»: abre *Ajustes del Sistema → Privacidad y seguridad*, desplázate hacia abajo y pulsa *Abrir de todos modos* (el clic derecho → Abrir ya no existe desde macOS 15). Si una versión anterior dice que la app está «dañada», ejecuta una vez en Terminal: `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`
- **Linux**: haz ejecutable el AppImage (`chmod +x G-Clock-*.AppImage`) y ejecútalo.

El idioma sigue el del sistema (English, Italiano, Español) y se puede cambiar en *Ajustes*. El tema es oscuro por defecto, con claro y de sistema disponibles. La app está pensada para una pantalla ancha (16:9); en una ventana alta la esfera va arriba y los titulares debajo.

## La esfera de estudio

La esfera de la izquierda funciona como en un reloj de estudio: 60 segmentos de minuto que se llenan a medida que pasa la hora (verde, naranja, rojo), con el minuto actual llenándose segundo a segundo. En el centro ves el tiempo que falta para el final de la hora, y en los últimos minutos pone FIN DE HORA. La fecha y la hora van grandes en la cabecera, en 24 o 12 horas y en la zona horaria que elijas en *Ajustes → General*, junto con la opción de mostrar los segundos.

- **Stopsets** (cortes publicitarios, noticias, sintonías): eliges los minutos de la hora (por ejemplo `0, 30`). Son los marcadores más grandes de la esfera, se ponen rojos cuando están cerca y durante su minuto el centro muestra el nombre del stopset. El centro cuenta hacia atrás hasta el siguiente. En los últimos segundos que elijas (*parpadear cuando quedan segundos*, 60 por defecto, 0 = nunca) la cuenta atrás y el marcador parpadean; con «reducir animaciones» activado en el sistema no parpadea nada.
- **Programaciones de stopsets por día y hora**: otros conjuntos de minutos para ciertos días y horas (por ejemplo `0, 20, 40` en las tardes laborables y `15, 45` el fin de semana). Vale la primera programación que corresponde a la hora del reloj, fuera de ellas valen los minutos por defecto, y la esfera se redibuja cuando empieza o termina una programación. Una programación puede pasar de la medianoche (pertenece al día en que empieza).
- **Eventos fijos**: eventos a una hora del día (noticias a las 18:00, un bloque publicitario a las 18:20, un invitado en el aire), cada uno en los días que elijas. Bajo la esfera el reloj muestra el siguiente (*SIGUIENTE*) con su cuenta atrás, te avisa **una vez** (la barra se pone roja al número de segundos que elijas para ese evento, 60 por defecto) y dice AHORA durante diez segundos cuando llega el momento. Las horas siguen la zona horaria del reloj.

## Titulares y tiempo

- **Titulares**, en el centro: los feeds RSS / Atom que añadas (solo https), una pestaña por fuente, una página de seis a la vez que cambia cada pocos segundos, y además un ticker deslizante abajo. Solo se muestran título, fuente, hora y enlace; un clic abre el artículo en tu navegador. La app lee los feeds por sí misma. Una pequeña píldora en la cabecera dice cuántos de tus feeds han respondido; sin ningún feed, la columna muestra una bienvenida con un botón para añadir uno.
- **Tiempo** (opcional, **apagado por defecto**), a la derecha: buscas lugares y la app los encuentra con la geocodificación de Open-Meteo. El crédito de Open-Meteo está siempre visible mientras el tiempo está encendido.
- **Solo reloj** (*Ajustes → General*, o tecla `C` en la pantalla On Air): solo la esfera, sin titulares, ticker, tiempo ni estado de los feeds, para una pantalla de pared. Los feeds y las ciudades siguen configurados y vuelven cuando lo apagas.

## ON AIR y REC

El interruptor **ON AIR / REC** (tecla `O`) cambia de pantalla. **REC** sustituye la esfera por el temporizador de grabación:

- **tiempo libre** con tiempos rápidos, o un **programa** hecho de bloques (apertura, entrevista, cierre…), cada uno con su tiempo;
- una cuenta atrás visual 3·2·1, pausa y reanudación, sobrepaso en rojo, pitidos opcionales;
- **fin de bloque**, repetir y atrás; haz clic en un bloque para grabar fuera de orden; varias tomas por bloque;
- **tiempos dinámicos**: lo que un bloque se pasa o le sobra se quita o se da a los siguientes;
- un **informe** al final del programa: cópialo, guárdalo como texto o como **CSV** para una hoja de cálculo (una fila por bloque, en segundos, y una fila TOTAL);
- los programas se crean y se editan en la app, y se pueden importar y exportar como JSON.

Espacio inicia y pausa, `N` termina el bloque, `R` reinicia.

## Temporizador MicTime

En *Ajustes → MicTime* (**apagado por defecto**) enciendes el temporizador de la app MicTime, con las mismas opciones, dentro de G-Clock. La primera señal inicia la cuenta, la siguiente la detiene, el total se queda en pantalla unos segundos (o hasta el siguiente inicio) y el temporizador vuelve a cero. Aparece bajo la esfera y, mientras se graba, como un chip en la cabecera.

- **Señales**: un **mensaje MIDI** (elige la entrada; inicio, parada, reinicio, paso siguiente, paso anterior y volver a empezar con una nota, un controlador o un program change, con *Aprender*, cualquier canal o uno, y un monitor de los mensajes entrantes), una **tecla** que elijas (global, que funciona con otro programa delante donde el sistema lo permite, o con la ventana delante) y el **nivel de una entrada de audio** (umbral y tiempo de mantenimiento).
- **Tiempos límite y programas**: un programa es una lista de pasos con un nombre y un límite (por ejemplo Apertura 00:45, Noticias 01:00, Entrevista 03:00); tras cada intervención el paso siguiente se arma solo; hasta 8 programas de 40 pasos; o un solo tiempo límite sin programa. Las cifras son grises a cero, pasan a un color de aviso antes del límite (10 segundos por defecto), a rojo pasado el límite, y parpadean lentamente cuando se supera por mucho; con «reducir animaciones» se muestra en su lugar un marco rojo fijo.
- Mientras está apagado no se escucha nada: ni MIDI, ni tecla, ni micrófono, y los permisos del sistema se rechazan. El nivel de audio necesita el permiso de micrófono del sistema; el audio no se graba, guarda ni envía nunca.

## Tus botones y tu logo

- **Tus botones** abren una página web en tu navegador (un enlace de invitado remoto, una cámara del estudio, la web de la emisora…), cada uno con una nota que explica para qué sirve, y además ideas ya preparadas para rellenar el formulario (*Añadir*, *Abrir* para probar).
- **Tu logo**: un PNG, JPG o SVG, redimensionado a 512 px como máximo y guardado solo en tu equipo (*Ajustes → General*).
- *Siempre visible*, pantalla completa (`F` o `F11`) y *Mantener la pantalla encendida* están en *Ajustes → General*.

## Ajustes

Pulsa `S` o el botón de ajustes. Los ajustes están en pestañas, entre ellas General (idioma, tema, formato de hora, zona horaria, siempre visible, solo reloj, mantener la pantalla encendida, logo), las secciones de stopsets, eventos, feeds, tiempo y botones, MicTime, Actualizaciones, Copia de seguridad y Ayuda e información.

**Copia de seguridad** (*Ajustes → Copia de seguridad*): *Exportar* guarda toda la configuración (ajustes, programas, botones, feeds, ciudades, eventos, programaciones, y el temporizador MicTime con sus mensajes MIDI, teclas, programas y colores) como `g-clock-backup-AAAA-MM-DD.json`. Al importar eliges entre **sustituir todo** y **añadir solo lo que falta**. El archivo no contiene contraseñas ni claves: la app no usa ninguna.

**Ayuda e información** muestra la versión, el sistema, la licencia, los créditos y los enlaces, *Copiar info para asistencia* (versión, sistema, idioma, última comprobación de actualizaciones y último error: nunca tus ajustes, direcciones ni nombres de archivo) y *Abrir carpeta de registros* (archivos de registro diarios, de 5 MB como máximo cada uno, se conservan 7 días). La tarjeta de propina tiene una hucha y un botón: ambos abren la página de apoyo del sitio web en el idioma de la app; dentro de la app no se pide nunca nada.

## Privacidad y red

G-Clock solo contacta con los feeds de noticias que **tú** has configurado (https), `geocoding-api.open-meteo.com` y `api.open-meteo.com` **solo si enciendes el tiempo**, y GitHub para buscar una versión nueva (se puede desactivar en *Ajustes*). La ventana en sí no tiene ningún acceso a la red; todo lo remoto pasa por el proceso principal, que solo acepta direcciones https. Sin cuentas, sin analítica, sin telemetría.

## Actualizaciones

La app busca una versión nueva 15 segundos después de iniciarse y luego cada 24 horas. Un aviso ofrece *Descargar e instalar*, *Recordármelo más tarde* (24 horas) y *Omitir esta versión*, con una barra de progreso y *Cancelar*. El archivo se comprueba con `SHA256SUMS.txt`. *Cerrar e instalar* guarda antes una copia de seguridad de los ajustes. Tras la actualización aparece una vez la ventana *Novedades*. No se instala nada sin un clic.

## Límites

- El reloj sigue el del equipo: mantenlo sincronizado. Las horas de los eventos fijos siguen la zona horaria del reloj, y un cambio de hora de verano no mueve nada (son horas de pared).
- Los titulares necesitan conexión a Internet y direcciones https; un feed que no responde se muestra en la píldora y las demás pestañas siguen funcionando.
- El tiempo y el temporizador MicTime siguen apagados hasta que los enciendas aquí.

## Solución de problemas

| Problema | Qué hacer |
|---|---|
| macOS: «la app está dañada / no se puede abrir» | Abre *Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos*; para una versión anterior, ejecuta en Terminal `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`. |
| Windows: «Windows protegió su PC» | *Más información* → *Ejecutar de todos modos*. |
| Linux: el AppImage no se inicia | Hazlo ejecutable (`chmod +x`) e instala FUSE (`libfuse2`) si tu sistema lo necesita. |
| No hay titulares | Añade un feed (https) en los ajustes; la píldora de la cabecera dice cuántos feeds responden. |
| El mensaje MIDI no llega | En *Ajustes → MicTime* revisa el monitor de los mensajes entrantes y pulsa *Aprender* otra vez. |
| La descarga de la actualización falló con «checksum mismatch» | El archivo se eliminó automáticamente. Inténtalo de nuevo o descarga el instalador a mano desde la página de versiones. |

## Contactos

Graziano Melzi · OnAir Garage — `https://onairgarage.com` — `hello@onairgarage.com`. Página de la herramienta: `https://onairgarage.com/tools/g-clock/`. Especificación MIDI del temporizador MicTime: `https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md`. Código fuente y versiones: `https://github.com/djgragra/g-clock`. Licencia: MIT © 2026 Graziano Melzi.
