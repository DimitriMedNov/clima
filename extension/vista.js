// La ventana que sale al hacer clic: encabezado grande, pronóstico por hora y por día.
// Los cuadros de detalle están en detalles.js.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {fondoDe, hora, iconoDe, textoDe} from './datos.js';
import {crearDetalles} from './detalles.js';

const ANCHO_BARRA = 96; // px de la barra de rango de temperatura de cada día

export function texto(t, clase, params = {}) {
    return new St.Label({text: t, style_class: clase, ...params});
}

export function caja(clase, vertical = false, params = {}) {
    return new St.BoxLayout({style_class: clase, orientation: vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL, ...params});
}

export function icono(carpeta, nombre, tamano) {
    return new St.Icon({gicon: Gio.icon_new_for_string(`${carpeta}/${nombre}.svg`), icon_size: tamano});
}

// Tarjeta con título chico en mayúsculas, como las de Clima de Apple.
export function tarjeta(titulo) {
    const t = caja('cl-tarjeta', true, {x_expand: true});
    t.add_child(texto(titulo.toUpperCase(), 'cl-tarjeta-titulo'));
    return t;
}

// Azul (frío) → verde → amarillo → naranja → rojo (calor).
const ESCALA = [[5, '#4dabf7'], [15, '#63e6be'], [22, '#ffd43b'], [28, '#ff922b'], [34, '#ff6b6b']];
function colorTemp(t) {
    return (ESCALA.find(([limite]) => t <= limite) ?? ESCALA[ESCALA.length - 1])[1];
}

function encabezado(datos, ciudad) {
    const a = datos.actual;
    const hoy = datos.dias[0];
    const c = caja('cl-encabezado', true, {x_align: Clutter.ActorAlign.CENTER});
    c.add_child(texto(ciudad, 'cl-ciudad', {x_align: Clutter.ActorAlign.CENTER}));
    c.add_child(texto(`${a.temp}°`, 'cl-grande', {x_align: Clutter.ActorAlign.CENTER}));
    c.add_child(texto(textoDe(a.codigo), 'cl-condicion', {x_align: Clutter.ActorAlign.CENTER}));
    c.add_child(texto(`Máx. ${hoy.max}°  Mín. ${hoy.min}°`, 'cl-condicion', {x_align: Clutter.ActorAlign.CENTER}));
    return c;
}

function porHora(datos, carpeta, doceHoras) {
    const t = tarjeta('Pronóstico por hora');
    const fila = caja('cl-horas');
    for (const h of datos.horas) {
        const col = caja('cl-hora', true);
        const etiqueta = h.ahora ? 'Ahora' : doceHoras ? hora(h.fecha, true).replace(':00', '').replace('. m.', 'm') : `${hora(h.fecha, false).slice(0, 2)} h`;
        col.add_child(texto(etiqueta, 'cl-hora-nombre', {x_align: Clutter.ActorAlign.CENTER}));
        col.add_child(icono(carpeta, iconoDe(h.codigo, h.esDia), 28));
        // Sin lluvia el texto queda invisible pero ocupa su lugar, para que las temperaturas se alineen.
        col.add_child(texto(`${h.lluvia}%`, 'cl-lluvia', {x_align: Clutter.ActorAlign.CENTER, opacity: h.lluvia >= 20 ? 255 : 0}));
        col.add_child(texto(`${h.temp}°`, 'cl-hora-temp', {x_align: Clutter.ActorAlign.CENTER}));
        fila.add_child(col);
    }
    const vista = new St.ScrollView({
        style_class: 'cl-horas-scroll', hscrollbar_policy: St.PolicyType.EXTERNAL,
        vscrollbar_policy: St.PolicyType.NEVER, child: fila, x_expand: true,
    });
    // La rueda del ratón mueve la lista de lado (si no, solo bajaría el menú).
    vista.connect('scroll-event', (_v, evento) => {
        const ajuste = vista.hadjustment;
        const dir = evento.get_scroll_direction();
        let paso = 0;
        if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.LEFT)
            paso = -1;
        else if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.RIGHT)
            paso = 1;
        else if (dir === Clutter.ScrollDirection.SMOOTH)
            paso = evento.get_scroll_delta().reduce((x, y) => x + y, 0);
        ajuste.value += paso * 80;
        return Clutter.EVENT_STOP;
    });
    t.add_child(vista);
    return t;
}

function barraRango(dia, minSemana, maxSemana, actual) {
    const rango = Math.max(1, maxSemana - minSemana);
    const x = Math.round((dia.min - minSemana) / rango * ANCHO_BARRA);
    const ancho = Math.max(8, Math.round((dia.max - dia.min) / rango * ANCHO_BARRA));
    const pista = new St.Widget({style_class: 'cl-pista', width: ANCHO_BARRA, y_align: Clutter.ActorAlign.CENTER});
    const relleno = new St.Widget({
        style_class: 'cl-relleno', width: ancho, height: 5,
        style: `background-gradient-direction: horizontal; background-gradient-start: ${colorTemp(dia.min)}; background-gradient-end: ${colorTemp(dia.max)};`,
    });
    relleno.set_position(Math.min(x, ANCHO_BARRA - ancho), 0);
    pista.add_child(relleno);
    if (actual !== null) { // hoy: un punto blanco donde está la temperatura de ahora
        const punto = new St.Widget({style_class: 'cl-punto', width: 7, height: 7});
        punto.set_position(Math.round((actual - minSemana) / rango * (ANCHO_BARRA - 7)), -1);
        pista.add_child(punto);
    }
    return pista;
}

function porDia(datos, carpeta) {
    const t = tarjeta(`Pronóstico de ${datos.dias.length} días`);
    const minSemana = Math.min(...datos.dias.map(d => d.min));
    const maxSemana = Math.max(...datos.dias.map(d => d.max));
    for (const [i, d] of datos.dias.entries()) {
        const fila = caja('cl-dia');
        fila.add_child(texto(d.nombre, 'cl-dia-nombre', {y_align: Clutter.ActorAlign.CENTER}));
        const ic = caja('cl-dia-icono', true, {y_align: Clutter.ActorAlign.CENTER});
        ic.add_child(icono(carpeta, iconoDe(d.codigo, true), 24));
        if (d.lluvia >= 20)
            ic.add_child(texto(`${d.lluvia}%`, 'cl-lluvia', {x_align: Clutter.ActorAlign.CENTER}));
        fila.add_child(ic);
        fila.add_child(texto(`${d.min}°`, 'cl-dia-min', {y_align: Clutter.ActorAlign.CENTER}));
        fila.add_child(barraRango(d, minSemana, maxSemana, i === 0 ? datos.actual.temp : null));
        fila.add_child(texto(`${d.max}°`, 'cl-dia-max', {y_align: Clutter.ActorAlign.CENTER}));
        t.add_child(fila);
    }
    return t;
}

// Arma la ventana completa con los datos. op = {carpeta, ciudad, doceHoras, alto}.
// Va dentro de una vista con desplazamiento: si no cabe en la pantalla, se baja con la rueda.
export function crearVista(datos, op) {
    const fondo = caja(`cl-fondo cl-${fondoDe(datos.actual.codigo, datos.actual.esDia)}`, true);
    fondo.add_child(encabezado(datos, op.ciudad));
    fondo.add_child(porHora(datos, op.carpeta, op.doceHoras));
    fondo.add_child(porDia(datos, op.carpeta));
    fondo.add_child(crearDetalles(datos, op.doceHoras));
    return new St.ScrollView({
        style_class: 'cl-scroll', style: `max-height: ${op.alto}px;`, child: fondo,
        hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true,
    });
}
