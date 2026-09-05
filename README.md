# Catastal GIS 🗺️📐

Piattaforma WebGIS interattiva che unisce la **vista satellitare reale ad alta definizione** (Google Satellite ed Esri World Imagery) con la **Cartografia Catastale Ufficiale dell'Agenzia delle Entrate** (servizio WMS INSPIRE nazionale gratuito).

Include gli strumenti di **misurazione poligonale geodetica**, **lazo a mano libera**, calcolo automatico in **metri quadri ($m^2$)**, **ettari (ha)**, **are e centiare**, **perimetro (m)**, ispezione del punto ed esportazione in **GeoJSON** e **KML (Google Earth)**.

---

## 🚀 Funzionalità Principali

- 🛰️ **Mappe Satellitari HD**: Google Satellite, Esri World Imagery e OpenStreetMap alternabili istantaneamente.
- 🏛️ **Sovrapposizione Catasto Agenzia Entrate**: layer ufficiale WMS nazionale con confini di particelle, fogli, fabbricati e codici particella.
- 🎚️ **Trasparenza Regolabile**: cursore per sfumare il catasto sulla foto satellitare reale e individuare recinzioni, alberi e strade.
- 📐 **Misurazione Poligonale Interattiva**: traccia i vertici con vertici agganciabili (snap) e modificabili in tempo reale.
- ✏️ **Strumento Lazo / Disegno a Mano Libera**: premi e trascina il mouse per tracciare una sagoma irregolare a mano libera, con chiusura automatica del poligono.
- 📊 **Calcolo Metrico Immediato**:
  - Metri quadri ($m^2$) precisi al millimetro tramite calcolo geodetico su ellissoide WGS84 (`Turf.js`).
  - Ettari (`ha`).
  - Unità catastali storiche: **Are (`a`)** e **Centiare (`ca`)** (es. `116 a 13 ca`).
  - Perimetro lineare in metri ($m$).
  - Coordinate geografiche del baricentro (Latitudine, Longitudine).
- 🔍 **Ricerca Indirizzi e Località**: barra di ricerca collegata al geocoder nazionale.
- 💾 **Esportazione Dati**: esporta il poligono in formato **KML** (apribile in Google Earth Pro / Earth Web) o **GeoJSON**.

---

## 💻 Avvio e Installazione

Assicurati di avere [Node.js](https://nodejs.org/) installato.

```bash
# 1. Entra nella cartella del repository
cd /Users/emanuelediluzio/repos/catastal

# 2. Installa le dipendenze
npm install

# 3. Avvia il server
npm start
```

Apri il browser su:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📋 Note sui Dati Catastali
I dati cartografici catastali provengono dal servizio ufficiale WMS INSPIRE dell'Agenzia delle Entrate rilasciato con licenza **CC-BY 4.0** (Agenzia delle Entrate). Le particelle e i numeri catastali diventano visibili automaticamente a livelli di zoom ravvicinati ($\ge 15$).
