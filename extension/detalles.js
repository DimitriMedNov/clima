// Cuadros de detalle: sensación térmica, humedad, viento, índice UV, lluvia y sol.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {direccion, hora, nivelUV} from './datos.js';

function cuadro(titulo, valor, detalle) {
    const c = new St.BoxLayout({style_class: 'cl-tarjeta cl-cuadro', orientation: Clutter.Orientation.VERTICAL, x_expand: true});
    c.add_child(new St.Label({text: titulo.toUpperCase(), style_class: 'cl-tarjeta-titulo'}));
    c.add_child(new St.Label({text: valor, style_class: 'cl-cuadro-valor'}));
    const d = new St.Label({text: detalle, style_class: 'cl-cuadro-detalle', y_expand: true, y_align: Clutter.ActorAlign.END});
    d.clutter_text.line_wrap = true;
    c.add_child(d);
    return c;
}

function sensacion(a) {
    if (a.sensacion >= a.temp + 2)
        return 'La humedad hace que se sienta más calor.';
    if (a.sensacion <= a.temp - 2)
        return 'El viento hace que se sienta más frío.';
    return 'Parecida a la temperatura real.';
}

// Siguiente evento del sol: si ya amaneció y no ha atardecido, el atardecer; si no, el amanecer.
function sol(datos, doceHoras) {
    const ahora = datos.actual.fecha;
    const [hoy, manana] = datos.dias;
    if (ahora < hoy.amanecer)
        return ['Amanecer', hora(hoy.amanecer, doceHoras), `Atardecer: ${hora(hoy.atardecer, doceHoras)}`];
    if (ahora < hoy.atardecer)
        return ['Atardecer', hora(hoy.atardecer, doceHoras), `Amanecer: ${hora(hoy.amanecer, doceHoras)}`];
    return ['Amanecer', hora(manana?.amanecer ?? hoy.amanecer, doceHoras), `Atardecer: ${hora(hoy.atardecer, doceHoras)}`];
}

export function crearDetalles(datos, doceHoras) {
    const a = datos.actual;
    const hoy = datos.dias[0];
    const cuadros = [
        cuadro('Sensación térmica', `${a.sensacion}°`, sensacion(a)),
        cuadro('Humedad', `${a.humedad}%`, `Punto de rocío: ${a.rocio}°.`),
        cuadro('Viento', `${a.viento} km/h`, `Ráfagas de ${a.rafagas} km/h, del ${direccion(a.dirViento)}.`),
        cuadro('Índice UV', `${a.uv} ${nivelUV(a.uv)}`,
            a.uv >= 3 ? 'Usa protector solar.' : `Hoy llega a ${hoy.uvMax} (${nivelUV(hoy.uvMax).toLowerCase()}).`),
        cuadro('Lluvia hoy', `${hoy.lluvia}%`,
            hoy.mm > 0 ? `${hoy.mm.toFixed(1)} mm esperados hoy.` : 'No se esperan lluvias hoy.'),
        cuadro(...sol(datos, doceHoras)),
    ];
    const rejilla = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'cl-rejilla'});
    for (let i = 0; i < cuadros.length; i += 2) {
        const fila = new St.BoxLayout({style_class: 'cl-rejilla-fila', x_expand: true});
        fila.add_child(cuadros[i]);
        fila.add_child(cuadros[i + 1]);
        rejilla.add_child(fila);
    }
    return rejilla;
}
