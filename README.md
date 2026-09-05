# Catastal GIS 🗺️

Un'applicazione WebGIS gratuita e open-source per la consultazione e misurazione delle particelle catastali in Italia, costruita con Leaflet e le API (WMS/WFS) dell'Agenzia delle Entrate.

🌍 **Live Demo:** [https://catastal.vercel.app/](https://catastal.vercel.app/)

## Funzionalità
- 🛰️ **Mappe ibride ad alta risoluzione** (Google Satellite / Esri HD)
- 🏛️ **Sovrapposizione ufficiale in tempo reale** del catasto (WMS Agenzia Entrate)
- 🖱️ **Click-to-measure**: Clicca su qualsiasi terreno per ottenere istantaneamente i metri quadri esatti (WFS) interrogando direttamente l'Agenzia delle Entrate
- 📐 Strumenti avanzati di disegno per poligoni, lazo a mano libera e linee di distanza
- 📡 Geolocalizzazione ad alta precisione
- 💾 Salvataggio delle particelle in locale
- 📊 Esportazione in GeoJSON, KML e CSV per Google Earth e CAD
- 🔗 Collegamento rapido al portale SPID dell'Agenzia delle Entrate per visure

## Note Tecniche
L'app sfrutta un server proxy (Express.js) per aggirare i problemi di CORS e formattare le risposte dai server ministeriali.
Il calcolo delle aree geodetiche e le manipolazioni geometriche avvengono via Turf.js.
Le proiezioni catastali originali (EPSG:6706) sono gestite tramite proj4leaflet.

Per il deployment su Vercel, il proxy utilizza un parser XML Node.js nativo (xml2js) per interrogare le particelle in millisecondi.

## Avvio in Locale

```bash
npm install
npm start
```
Il server sarà attivo su `http://localhost:3000`.

## Limitazioni API
L'Agenzia delle Entrate fornisce i dati liberamente (CC-BY 4.0), tuttavia l'endpoint pubblico non supporta la ricerca testuale filtrata per Foglio e Particella. È necessario navigare visivamente sul proprio Comune (usando la barra di ricerca in alto) e selezionare la particella per averne i dati e la misurazione. Per l'identificazione personale è presente il pulsante "Visura Ufficiale (SPID)".
