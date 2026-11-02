// Datos del clima: los descarga de Open-Meteo (gratis, sin cuenta ni llave) y los ordena para la
// pantalla. También traduce los códigos del tiempo a texto, ícono y color de fondo.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const API = 'https://api.open-meteo.com/v1/forecast';
const ACTUAL = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'is_day',
    'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index'];
const POR_HORA = ['temperature_2m', 'weather_code', 'is_day', 'precipitation_probability'];
const POR_DIA = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
    'uv_index_max', 'precipitation_probability_max', 'precipitation_sum'];
const HORAS = 24; // cuántas horas salen en el pronóstico por hora
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Códigos WMO que usa Open-Meteo → [texto, ícono de día, ícono de noche, fondo].
const CONDICIONES = [
    [[0], 'Despejado', 'despejado-dia', 'despejado-noche', 'claro'],
    [[1], 'Mayormente despejado', 'despejado-dia', 'despejado-noche', 'claro'],
    [[2], 'Parcialmente nublado', 'parcial-dia', 'parcial-noche', 'claro'],
    [[3], 'Nublado', 'nublado', 'nublado', 'nublado'],
    [[45, 48], 'Niebla', 'niebla', 'niebla', 'nublado'],
    [[51, 53, 55, 56, 57], 'Llovizna', 'llovizna', 'llovizna', 'lluvia'],
    [[61, 66], 'Lluvia ligera', 'lluvia', 'lluvia', 'lluvia'],
    [[63], 'Lluvia', 'lluvia', 'lluvia', 'lluvia'],
    [[65, 67], 'Lluvia fuerte', 'lluvia', 'lluvia', 'lluvia'],
    [[80, 81], 'Chubascos', 'lluvia', 'lluvia', 'lluvia'],
    [[82], 'Chubascos fuertes', 'lluvia', 'lluvia', 'lluvia'],
    [[71, 73, 75, 77, 85, 86], 'Nieve', 'nieve', 'nieve', 'nublado'],
    [[95], 'Tormenta', 'tormenta', 'tormenta', 'tormenta'],
    [[96, 99], 'Tormenta con granizo', 'tormenta', 'tormenta', 'tormenta'],
];

function condicion(codigo) {
    return CONDICIONES.find(([codigos]) => codigos.includes(codigo)) ?? CONDICIONES[3];
}

export const textoDe = codigo => condicion(codigo)[1];
// Nombre del archivo en iconos/ (sin .svg).
export const iconoDe = (codigo, esDia) => condicion(codigo)[esDia ? 2 : 3];
// Clase de color del fondo de la ventana: de noche, todo lo que no es lluvia ni tormenta es "noche".
export function fondoDe(codigo, esDia) {
    const fondo = condicion(codigo)[4];
    return !esDia && (fondo === 'claro' || fondo === 'nublado') ? 'noche' : fondo;
}

export function nivelUV(uv) {
    if (uv < 3)
        return 'Bajo';
    if (uv < 6)
        return 'Moderado';
    if (uv < 8)
        return 'Alto';
    return uv < 11 ? 'Muy alto' : 'Extremo';
}

// 0° = viene del norte. Se dice de dónde viene el viento.
export function direccion(grados) {
    return ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(grados / 45) % 8];
}

// "2026-11-02T17:22" → "17:22" o "5:22 p. m." según el formato del reloj de GNOME.
export function hora(texto, doceHoras) {
    const [h, m] = texto.slice(11, 16).split(':').map(Number);
    if (!doceHoras)
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

function url(latitud, longitud) {
    return `${API}?latitude=${latitud}&longitude=${longitud}&timezone=auto&forecast_days=8` +
        `&current=${ACTUAL.join(',')}&hourly=${POR_HORA.join(',')}&daily=${POR_DIA.join(',')}`;
}

// Ordena la respuesta de Open-Meteo en: actual, próximas horas, próximos días y datos de hoy.
export function ordenar(r) {
    const a = r.current;
    const actual = {
        temp: Math.round(a.temperature_2m), sensacion: Math.round(a.apparent_temperature),
        humedad: a.relative_humidity_2m, rocio: Math.round(a.dew_point_2m), esDia: a.is_day === 1,
        codigo: a.weather_code, viento: Math.round(a.wind_speed_10m), rafagas: Math.round(a.wind_gusts_10m),
        dirViento: a.wind_direction_10m, uv: Math.round(a.uv_index), fecha: a.time,
    };

    const h = r.hourly;
    const inicio = Math.max(0, h.time.indexOf(`${a.time.slice(0, 13)}:00`));
    const horas = h.time.slice(inicio, inicio + HORAS).map((t, i) => ({
        fecha: t, codigo: h.weather_code[inicio + i], esDia: h.is_day[inicio + i] === 1,
        temp: Math.round(h.temperature_2m[inicio + i]), lluvia: h.precipitation_probability[inicio + i] ?? 0,
    }));
    if (horas.length)
        Object.assign(horas[0], {codigo: actual.codigo, esDia: actual.esDia, temp: actual.temp, ahora: true});

    const d = r.daily;
    const dias = d.time.map((t, i) => {
        const [y, m, dd] = t.split('-').map(Number);
        return {
            nombre: i === 0 ? 'Hoy' : DIAS_SEMANA[new Date(y, m - 1, dd).getDay()],
            codigo: d.weather_code[i], min: Math.round(d.temperature_2m_min[i]),
            max: Math.round(d.temperature_2m_max[i]), lluvia: d.precipitation_probability_max[i] ?? 0,
            mm: d.precipitation_sum[i] ?? 0, uvMax: Math.round(d.uv_index_max[i]),
            amanecer: d.sunrise[i], atardecer: d.sunset[i],
        };
    });
    return {actual, horas, dias};
}

export class Fuente {
    constructor() {
        this._sesion = new Soup.Session({timeout: 20, user_agent: 'clima-gnome-extension'});
    }

    // Devuelve los datos ordenados o lanza un Error con mensaje en español.
    async traer(latitud, longitud, cancelable) {
        const mensaje = Soup.Message.new('GET', url(latitud, longitud));
        let bytes;
        try {
            bytes = await this._sesion.send_and_read_async(mensaje, GLib.PRIORITY_DEFAULT, cancelable);
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw e;
            throw new Error('Sin conexión a internet o Open-Meteo no responde.');
        }
        if (mensaje.get_status() !== Soup.Status.OK)
            throw new Error(`Open-Meteo respondió con error ${mensaje.get_status()}.`);
        return ordenar(JSON.parse(new TextDecoder().decode(bytes.get_data())));
    }

    destruir() {
        this._sesion.abort();
        this._sesion = null;
    }
}
