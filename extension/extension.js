// Clima: el tiempo de tu ciudad en la barra de GNOME (ícono de color + grados) y, al hacer clic,
// una ventana al estilo de Clima de Apple: por hora, por día y detalles. Datos de Open-Meteo.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Fuente, hora, iconoDe, textoDe} from './datos.js';
import {crearCargando, crearError} from './estados.js';
import {crearVista} from './vista.js';

const ACTUALIZAR_CADA = 15 * 60; // s
const VIEJO_DESDE = 10 * 60; // s: al abrir el menú, si los datos tienen más de esto, se piden otra vez
const VECINO = 'panel-claude@dimitrimednov.github.io'; // el clima va justo a la derecha de este

const Indicador = GObject.registerClass(
class Indicador extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'Clima');
        this._ext = ext;
        this._settings = ext.getSettings();
        this._iconos = GLib.build_filenamev([ext.path, 'iconos']);
        this._fuente = new Fuente();
        this._cancelable = null;
        this._datos = null;
        this._error = null;
        this._cuando = 0; // segundos monotónicos de la última descarga buena

        const barra = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._icono = new St.Icon({style_class: 'system-status-icon cl-icono-barra', icon_size: 18,
            gicon: Gio.icon_new_for_string(`${this._iconos}/despejado-dia.svg`), opacity: 0});
        this._grados = new St.Label({text: '--°', style_class: 'cl-grados', y_align: Clutter.ActorAlign.CENTER});
        barra.add_child(this._icono);
        barra.add_child(this._grados);
        this.add_child(barra);

        this.menu.box.add_style_class_name('cl-menu');
        this._contenedor = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'cl-item'});
        this.menu.addMenuItem(this._contenedor);
        this._pie = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'cl-item'});
        this.menu.addMenuItem(this._pie);

        this.menu.connect('open-state-changed', (_m, abierto) => {
            if (abierto && GLib.get_monotonic_time() / 1e6 - this._cuando > VIEJO_DESDE)
                this._actualizar();
        });
        this._idAjustes = this._settings.connect('changed', (_s, clave) => {
            if (clave === 'latitud' || clave === 'longitud' || clave === 'ciudad') {
                this._datos = null;
                this._actualizar();
            }
        });
        this._temporizador = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, ACTUALIZAR_CADA, () => {
            this._actualizar();
            return GLib.SOURCE_CONTINUE;
        });
        this._pintar();
        this._actualizar();
    }

    async _actualizar() {
        this._cancelable?.cancel();
        const cancelable = this._cancelable = new Gio.Cancellable();
        if (this._error) {
            this._error = null;
            this._pintar(); // de error a "cargando" mientras se reintenta
        }
        try {
            this._datos = await this._fuente.traer(this._settings.get_double('latitud'),
                this._settings.get_double('longitud'), cancelable);
            this._cuando = GLib.get_monotonic_time() / 1e6;
            this._error = null;
        } catch (e) {
            if (cancelable.is_cancelled())
                return;
            this._error = e.message;
        }
        this._pintar();
    }

    _pintar() {
        const d = this._datos;
        if (d) {
            const a = d.actual;
            this._icono.gicon = Gio.icon_new_for_string(`${this._iconos}/${iconoDe(a.codigo, a.esDia)}.svg`);
            this._icono.opacity = 255;
            this._grados.text = `${a.temp}°`;
            this.accessible_name = `Clima en ${this._settings.get_string('ciudad')}: ${a.temp} grados, ${textoDe(a.codigo)}`;
        }

        this._contenedor.remove_all_children();
        if (d) {
            const doceHoras = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).get_string('clock-format') === '12h';
            const monitor = Main.layoutManager.primaryMonitor;
            const alto = (monitor?.height ?? 900) - Main.panel.height - 110; // deja lugar al pie
            this._contenedor.add_child(crearVista(d, {carpeta: this._iconos, ciudad: this._settings.get_string('ciudad'), doceHoras, alto}));
            this._pintarPie(doceHoras);
        } else if (this._error) {
            this._contenedor.add_child(crearError(this._error, () => this._actualizar()));
            this._pie.remove_all_children();
        } else {
            this._contenedor.add_child(crearCargando());
            this._pie.remove_all_children();
        }
    }

    _pintarPie(doceHoras) {
        this._pie.remove_all_children();
        const ahora = GLib.DateTime.new_now_local().format('%Y-%m-%dT%H:%M');
        const aviso = this._error ? 'No se pudo actualizar · ' : '';
        this._pie.add_child(new St.Label({text: `${aviso}Actualizado ${hora(ahora, doceHoras)} · Open-Meteo`,
            style_class: 'cl-pie', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        this._pie.add_child(this._botonPie('view-refresh-symbolic', 'Actualizar el clima', () => this._actualizar()));
        this._pie.add_child(this._botonPie('emblem-system-symbolic', 'Cambiar de ciudad', () => {
            this.menu.close();
            this._ext.openPreferences();
        }));
    }

    _botonPie(nombre, descripcion, alPulsar) {
        const b = new St.Button({style_class: 'cl-boton', can_focus: true, accessible_name: descripcion,
            child: new St.Icon({icon_name: nombre, style_class: 'popup-menu-icon'})});
        b.connect('clicked', alPulsar);
        return b;
    }

    destroy() {
        this._cancelable?.cancel();
        if (this._temporizador)
            GLib.source_remove(this._temporizador);
        this._temporizador = 0;
        this._settings.disconnect(this._idAjustes);
        this._fuente.destruir();
        super.destroy();
    }
});

export default class Clima extends Extension {
    enable() {
        this._indicador = new Indicador(this);
        // Justo a la derecha de Panel Claude si está; si no, al principio del lado derecho.
        const vecino = Main.panel.statusArea[VECINO];
        const caja = Main.panel._rightBox;
        const posicion = vecino ? caja.get_children().indexOf(vecino.container) + 1 : 0;
        Main.panel.addToStatusArea(this.uuid, this._indicador, Math.max(0, posicion), 'right');
    }

    disable() {
        this._indicador?.destroy();
        this._indicador = null;
    }
}
