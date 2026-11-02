// Pantallas mientras no hay datos: cargando (esqueleto con la forma real) y error (con reintentar).

import Clutter from 'gi://Clutter';
import St from 'gi://St';

function bloque(ancho, alto, params = {}) {
    return new St.Widget({style_class: 'cl-hueso', width: ancho, height: alto, ...params});
}

export function crearCargando() {
    const fondo = new St.BoxLayout({style_class: 'cl-fondo cl-noche', orientation: Clutter.Orientation.VERTICAL});
    const arriba = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'cl-encabezado', x_align: Clutter.ActorAlign.CENTER});
    for (const [ancho, alto] of [[110, 18], [90, 56], [140, 16], [120, 16]])
        arriba.add_child(bloque(ancho, alto, {x_align: Clutter.ActorAlign.CENTER}));
    fondo.add_child(arriba);
    const horas = new St.BoxLayout({style_class: 'cl-tarjeta', orientation: Clutter.Orientation.VERTICAL});
    horas.add_child(bloque(140, 10));
    const fila = new St.BoxLayout({style_class: 'cl-horas'});
    for (let i = 0; i < 6; i++)
        fila.add_child(bloque(36, 76, {style: 'margin-right: 12px;'}));
    horas.add_child(fila);
    fondo.add_child(horas);
    const dias = new St.BoxLayout({style_class: 'cl-tarjeta', orientation: Clutter.Orientation.VERTICAL});
    dias.add_child(bloque(140, 10));
    for (let i = 0; i < 5; i++)
        dias.add_child(bloque(312, 22, {style: 'margin-top: 12px;'}));
    fondo.add_child(dias);
    return fondo;
}

export function crearError(mensaje, alReintentar) {
    const fondo = new St.BoxLayout({style_class: 'cl-fondo cl-nublado cl-error', orientation: Clutter.Orientation.VERTICAL});
    fondo.add_child(new St.Icon({icon_name: 'network-offline-symbolic', icon_size: 48, style_class: 'cl-error-icono', x_align: Clutter.ActorAlign.CENTER}));
    fondo.add_child(new St.Label({text: 'No pude traer el clima', style_class: 'cl-ciudad', x_align: Clutter.ActorAlign.CENTER}));
    const detalle = new St.Label({text: mensaje, style_class: 'cl-condicion', x_align: Clutter.ActorAlign.CENTER});
    detalle.clutter_text.line_wrap = true;
    fondo.add_child(detalle);
    const boton = new St.Button({label: 'Reintentar', style_class: 'cl-boton-texto', can_focus: true, x_align: Clutter.ActorAlign.CENTER});
    boton.connect('clicked', alReintentar);
    fondo.add_child(boton);
    return fondo;
}
