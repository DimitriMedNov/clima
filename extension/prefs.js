// Ajustes de Clima: buscar y elegir la ciudad. Usa el buscador de ciudades de Open-Meteo.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const BUSCADOR = 'https://geocoding-api.open-meteo.com/v1/search';

export default class ClimaAjustes extends ExtensionPreferences {
    fillPreferencesWindow(ventana) {
        const ajustes = this.getSettings();
        const sesion = new Soup.Session({timeout: 20});
        ventana.connect('close-request', () => sesion.abort());

        const pagina = new Adw.PreferencesPage({title: 'Clima', icon_name: 'weather-clear-symbolic'});
        ventana.add(pagina);

        const actual = new Adw.PreferencesGroup({title: 'Ciudad'});
        const fila = new Adw.ActionRow({title: ajustes.get_string('ciudad'), subtitle: ajustes.get_string('region')});
        fila.add_prefix(new Gtk.Image({icon_name: 'mark-location-symbolic'}));
        actual.add(fila);
        pagina.add(actual);
        ajustes.connect('changed', () => {
            fila.title = ajustes.get_string('ciudad');
            fila.subtitle = ajustes.get_string('region');
        });

        const grupo = new Adw.PreferencesGroup({title: 'Cambiar de ciudad',
            description: 'Escribe el nombre y pulsa Enter. Datos de Open-Meteo.'});
        const busqueda = new Adw.EntryRow({title: 'Buscar ciudad', show_apply_button: true});
        grupo.add(busqueda);
        pagina.add(grupo);

        let filas = [];
        const limpiar = () => {
            filas.forEach(f => grupo.remove(f));
            filas = [];
        };
        const aviso = texto => {
            const f = new Adw.ActionRow({title: texto});
            grupo.add(f);
            filas.push(f);
        };

        const buscar = async () => {
            const nombre = busqueda.text.trim();
            limpiar();
            if (!nombre)
                return;
            aviso('Buscando…');
            try {
                const url = `${BUSCADOR}?count=8&language=es&name=${GLib.uri_escape_string(nombre, null, true)}`;
                const mensaje = Soup.Message.new('GET', url);
                const bytes = await sesion.send_and_read_async(mensaje, GLib.PRIORITY_DEFAULT, null);
                if (mensaje.get_status() !== Soup.Status.OK)
                    throw new Error(`error ${mensaje.get_status()}`);
                const resultados = JSON.parse(new TextDecoder().decode(bytes.get_data())).results ?? [];
                limpiar();
                if (!resultados.length)
                    aviso(`No encontré "${nombre}". Prueba con otro nombre o sin acentos.`);
                for (const r of resultados) {
                    const region = [r.admin1, r.country].filter(Boolean).join(', ');
                    const f = new Adw.ActionRow({title: r.name, subtitle: region, activatable: true});
                    const usar = new Gtk.Button({label: 'Usar', valign: Gtk.Align.CENTER});
                    const elegir = () => {
                        ajustes.set_string('ciudad', r.name);
                        ajustes.set_string('region', region);
                        ajustes.set_double('latitud', r.latitude);
                        ajustes.set_double('longitud', r.longitude);
                        busqueda.text = '';
                        limpiar();
                    };
                    usar.connect('clicked', elegir);
                    f.connect('activated', elegir);
                    f.add_suffix(usar);
                    grupo.add(f);
                    filas.push(f);
                }
            } catch (e) {
                limpiar();
                aviso(`No pude buscar: revisa tu conexión a internet (${e.message}).`);
            }
        };
        busqueda.connect('apply', buscar);
        busqueda.connect('entry-activated', buscar);
    }
}
