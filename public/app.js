// Catastal WebGIS Application Logic

// EPSG:6706 (RDN2008 / geographic 2D) used by Agenzia delle Entrate WMS
proj4.defs('EPSG:6706', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs');

// Target initial center: Chieti (P.lla 8, Foglio 21)
const CHIETI_COORDS = [42.3739, 14.1978];
const INITIAL_ZOOM = 18;

// Toast notification
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

// Initialize Leaflet Map
const map = L.map('map', {
  center: CHIETI_COORDS,
  zoom: INITIAL_ZOOM,
  maxZoom: 21,
  zoomControl: false
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Base Tile Layers
const baseLayers = {
  googleSat: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 21,
    attribution: '© Google Satellite'
  }),
  esriSat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  })
};

baseLayers.googleSat.addTo(map);

// Custom WMS Layer for Agenzia delle Entrate Catasto
let currentLayers = ['province', 'CP.CadastralZoning', 'CP.CadastralParcel', 'fabbricati', 'codice_plla'];

const CatastoWmsLayer = L.TileLayer.extend({
  defaultWmsParams: {
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: currentLayers.join(','),
    styles: '',
    format: 'image/png',
    transparent: true,
    crs: 'EPSG:6706'
  },

  initialize: function (url, options) {
    this._url = url;
    const wmsParams = L.extend({}, this.defaultWmsParams);
    for (let i in options) {
      if (!this.options.hasOwnProperty(i)) {
        wmsParams[i] = options[i];
      }
    }
    this.wmsParams = wmsParams;
    L.setOptions(this, options);
  },

  onAdd: function (map) {
    this._crs = map.options.crs;
    L.TileLayer.prototype.onAdd.call(this, map);
  },

  getTileUrl: function (coords) {
    const tileBounds = this._tileCoordsToBounds(coords);
    const sw = tileBounds.getSouthWest();
    const ne = tileBounds.getNorthEast();
    const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].join(',');
    const obj = {
      ...this.wmsParams,
      bbox: bbox,
      width: this.getTileSize().x,
      height: this.getTileSize().y
    };
    const params = new URLSearchParams(obj).toString();
    return `${this._url}?${params}`;
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    if (this._container) {
      this._container.style.opacity = opacity;
    }
    return this;
  },

  updateLayers: function (layersArray) {
    this.wmsParams.layers = layersArray.join(',');
    this.redraw();
  }
});

const catastoLayer = new CatastoWmsLayer('/api/wms', {
  opacity: 0.45,
  zIndex: 100
}).addTo(map);

// Vector layer for selected parcels
const parcelVectorLayer = L.geoJSON(null, {
  style: {
    color: '#3b82f6',
    weight: 3,
    fillColor: '#60a5fa',
    fillOpacity: 0.3
  }
}).addTo(map);

// Location marker layer
let locationMarker = null;
let locationCircle = null;

// Leaflet-Geoman Toolbar
map.pm.addControls({
  position: 'topright',
  drawCircle: false,
  drawCircleMarker: false,
  drawMarker: false,
  drawText: false,
  drawPolyline: true,
  drawRectangle: true,
  drawPolygon: true,
  editMode: true,
  dragMode: true,
  cutPolygon: false,
  removalMode: true
});

map.pm.setGlobalOptions({
  pathOptions: {
    color: '#fbbf24',
    fillColor: '#f59e0b',
    fillOpacity: 0.35,
    weight: 3
  }
});

// State
let drawnLayers = [];
let activePolygon = null;
let savedParcels = JSON.parse(localStorage.getItem('catastal_saved') || '[]');

// UI Elements
const areaM2El = document.getElementById('areaM2');
const areaHaEl = document.getElementById('areaHa');
const areaAreCentiareEl = document.getElementById('areaAreCentiare');
const perimetroMEl = document.getElementById('perimetroM');
const vertexCountEl = document.getElementById('vertexCount');
const centroidCoordsEl = document.getElementById('centroidCoords');
const zoomAlertText = document.getElementById('zoomAlertText');
const cadastralDetailsEl = document.getElementById('cadastralDetails');
const statusDot = document.getElementById('statusDot');
const mouseCoordsEl = document.getElementById('mouseCoords');
const zoomLevelEl = document.getElementById('zoomLevel');

// Live mouse coordinate display
map.on('mousemove', e => {
  mouseCoordsEl.textContent = `Lat: ${e.latlng.lat.toFixed(6)}, Lon: ${e.latlng.lng.toFixed(6)}`;
});

map.on('zoomend', () => {
  const z = map.getZoom();
  zoomLevelEl.textContent = `Zoom: ${z}`;
  if (z >= 15) {
    zoomAlertText.innerHTML = `Zoom: <b>${z}</b> — Dettaglio catastale attivo`;
  } else {
    zoomAlertText.innerHTML = `Zoom: <b>${z}</b> — Ingrandisci a ≥15 per i numeri particella`;
  }
});

// ---- MEASUREMENT FUNCTIONS ----
function updateMeasurements(layer, customLabel = null) {
  if (!layer) return;
  activePolygon = layer;
  statusDot.classList.add('active');
  const geojson = layer.toGeoJSON ? layer.toGeoJSON() : layer;

  try {
    let area = 0;
    let perimeter = 0;
    let vertices = 0;

    if (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon') {
      area = turf.area(geojson);
      perimeter = turf.length(geojson, { units: 'meters' });
      vertices = geojson.geometry.coordinates[0].length - 1;
    } else if (geojson.geometry.type === 'LineString') {
      perimeter = turf.length(geojson, { units: 'meters' });
      vertices = geojson.geometry.coordinates.length;
    }

    areaM2El.innerHTML = `${area.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="unit">m²</span>`;

    const hectares = area / 10000;
    areaHaEl.textContent = `${hectares.toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;

    const totalCentiare = Math.round(area);
    const are = Math.floor(totalCentiare / 100);
    const centiare = totalCentiare % 100;
    areaAreCentiareEl.textContent = `${are} a ${centiare} ca`;

    perimetroMEl.textContent = `${perimeter.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
    vertexCountEl.textContent = vertices;

    const centroid = turf.centroid(geojson);
    const [cLng, cLat] = centroid.geometry.coordinates;
    centroidCoordsEl.textContent = `Lat: ${cLat.toFixed(6)}, Lon: ${cLng.toFixed(6)}`;

    if (layer.bindTooltip) {
      const title = customLabel ? `<b>P.lla ${customLabel}</b><br>` : '';
      layer.unbindTooltip();
      layer.bindTooltip(
        `${title}<b>${Math.round(area).toLocaleString('it-IT')} m²</b> | ${Math.round(perimeter)} m`,
        { permanent: false, direction: 'center', className: 'measure-tooltip' }
      );
    }
  } catch (err) {
    console.error('Error calculating metrics:', err);
  }
}

function clearAllDrawings() {
  drawnLayers.forEach(l => map.removeLayer(l));
  drawnLayers = [];
  parcelVectorLayer.clearLayers();
  activePolygon = null;
  statusDot.classList.remove('active');
  areaM2El.innerHTML = `0.00 <span class="unit">m²</span>`;
  areaHaEl.textContent = '0.0000 ha';
  areaAreCentiareEl.textContent = '0 a 0 ca';
  perimetroMEl.textContent = '0.00 m';
  vertexCountEl.textContent = '0';
  centroidCoordsEl.textContent = 'Clicca sulla mappa o traccia un poligono';
  cadastralDetailsEl.innerHTML = 'Fai clic su qualsiasi particella per misurare automaticamente l\'area in m² e ottenere i dati catastali.';
  showToast('🗑️ Misurazioni cancellate');
}

// Handle Geoman Creation Events
map.on('pm:create', e => {
  const layer = e.layer;
  drawnLayers.push(layer);
  updateMeasurements(layer);
  layer.on('pm:edit', () => updateMeasurements(layer));
  layer.on('pm:drag', () => updateMeasurements(layer));
  layer.on('pm:vertexadded', () => updateMeasurements(layer));
  layer.on('pm:vertexremoved', () => updateMeasurements(layer));
  layer.on('click', () => updateMeasurements(layer));
});

map.on('pm:remove', e => {
  drawnLayers = drawnLayers.filter(l => l !== e.layer);
  if (activePolygon === e.layer) {
    if (drawnLayers.length > 0) {
      updateMeasurements(drawnLayers[drawnLayers.length - 1]);
    } else {
      clearAllDrawings();
    }
  }
});

// ---- DRAWING TOOLS ----
document.getElementById('drawPolygonBtn').addEventListener('click', () => {
  map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 20, finishOn: 'dblclick' });
  showToast('📐 Clicca per aggiungere vertici, doppio clic per chiudere');
});

// Lasso / Freehand
let lassoDrawing = false;
let lassoPoints = [];
let lassoPolyline = null;
const drawLassoBtn = document.getElementById('drawLassoBtn');

drawLassoBtn.addEventListener('click', () => {
  if (drawLassoBtn.classList.contains('active')) {
    drawLassoBtn.classList.remove('active');
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    map.off('mousedown', startLasso);
    map.off('mousemove', trackLasso);
    map.off('mouseup', finishLasso);
  } else {
    drawLassoBtn.classList.add('active');
    map.dragging.disable();
    map.getContainer().style.cursor = 'crosshair';
    map.on('mousedown', startLasso);
    map.on('mousemove', trackLasso);
    map.on('mouseup', finishLasso);
    showToast('✏️ Tieni premuto e disegna il contorno del terreno');
  }
});

function startLasso(e) {
  lassoDrawing = true;
  lassoPoints = [e.latlng];
  if (lassoPolyline) map.removeLayer(lassoPolyline);
  lassoPolyline = L.polyline(lassoPoints, { color: '#fbbf24', weight: 3, dashArray: '4, 4' }).addTo(map);
}

function trackLasso(e) {
  if (!lassoDrawing) return;
  lassoPoints.push(e.latlng);
  lassoPolyline.setLatLngs(lassoPoints);
}

function finishLasso() {
  if (!lassoDrawing || lassoPoints.length < 3) {
    lassoDrawing = false;
    if (lassoPolyline) map.removeLayer(lassoPolyline);
    return;
  }
  lassoDrawing = false;
  if (lassoPolyline) map.removeLayer(lassoPolyline);

  const polygon = L.polygon(lassoPoints, {
    color: '#fbbf24', fillColor: '#f59e0b', fillOpacity: 0.35, weight: 3
  }).addTo(map);

  polygon.pm.enable();
  drawnLayers.push(polygon);
  updateMeasurements(polygon);

  polygon.on('pm:edit', () => updateMeasurements(polygon));
  polygon.on('pm:drag', () => updateMeasurements(polygon));
  polygon.on('click', () => updateMeasurements(polygon));

  drawLassoBtn.classList.remove('active');
  map.dragging.enable();
  map.getContainer().style.cursor = '';
  map.off('mousedown', startLasso);
  map.off('mousemove', trackLasso);
  map.off('mouseup', finishLasso);
}

// Distance measurement tool
document.getElementById('measureDistanceBtn').addEventListener('click', () => {
  map.pm.enableDraw('Line', { snappable: true, snapDistance: 20 });
  showToast('📏 Clicca per punti di misura, doppio clic per finire');
});

document.getElementById('clearMeasurementsBtn').addEventListener('click', clearAllDrawings);

// ---- BASE MAP SWITCHER ----
document.querySelectorAll('input[name="basemap"]').forEach(input => {
  input.addEventListener('change', e => {
    Object.values(baseLayers).forEach(l => map.removeLayer(l));
    baseLayers[e.target.value].addTo(map);
    if (document.getElementById('catastoToggle').checked) {
      catastoLayer.bringToFront();
    }
  });
});

// ---- CATASTO CONTROLS ----
const catastoToggle = document.getElementById('catastoToggle');
const opacitySlider = document.getElementById('opacitySlider');
const opacityVal = document.getElementById('opacityVal');

catastoToggle.addEventListener('change', e => {
  if (e.target.checked) {
    catastoLayer.addTo(map);
    showToast('🏛️ Layer catastale attivato');
  } else {
    map.removeLayer(catastoLayer);
    showToast('Layer catastale disattivato');
  }
});

opacitySlider.addEventListener('input', e => {
  const val = e.target.value;
  opacityVal.textContent = `${val}%`;
  catastoLayer.setOpacity(val / 100);
});

function updateWmsLayers() {
  const layers = ['province', 'CP.CadastralZoning'];
  if (document.getElementById('layerParticelle').checked) layers.push('CP.CadastralParcel');
  if (document.getElementById('layerFabbricati').checked) layers.push('fabbricati');
  if (document.getElementById('layerCodici').checked) layers.push('codice_plla');
  catastoLayer.updateLayers(layers);
}

document.getElementById('layerParticelle').addEventListener('change', updateWmsLayers);
document.getElementById('layerFabbricati').addEventListener('change', updateWmsLayers);
document.getElementById('layerCodici').addEventListener('change', updateWmsLayers);

// ---- PANEL COLLAPSE ----
document.getElementById('collapseLeftBtn').addEventListener('click', () => {
  document.getElementById('leftPanel').classList.toggle('collapsed');
});

document.getElementById('collapseRightBtn').addEventListener('click', () => {
  document.getElementById('rightPanel').classList.toggle('collapsed');
});

// ---- GEOLOCATION ----
document.getElementById('locateMeBtn').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    showToast('❌ Geolocalizzazione non supportata');
    return;
  }
  showToast('📡 Rilevamento posizione GPS...');

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    map.flyTo([latitude, longitude], 18, { duration: 1.5 });

    // Remove previous location markers
    if (locationMarker) map.removeLayer(locationMarker);
    if (locationCircle) map.removeLayer(locationCircle);

    // Blue pulsing circle for accuracy
    locationCircle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#60a5fa',
      fillOpacity: 0.15,
      weight: 1
    }).addTo(map);

    // Marker
    locationMarker = L.circleMarker([latitude, longitude], {
      radius: 8,
      color: '#fff',
      fillColor: '#3b82f6',
      fillOpacity: 1,
      weight: 3
    }).addTo(map);
    locationMarker.bindPopup(`<b>La tua posizione</b><br>Precisione: ${Math.round(accuracy)} m`).openPopup();

    showToast(`📍 Posizione rilevata (±${Math.round(accuracy)}m)`);

    setTimeout(() => queryAndSelectParcel(latitude, longitude), 1500);
  }, err => {
    showToast('❌ Impossibile ottenere la posizione: ' + err.message);
  }, { enableHighAccuracy: true, timeout: 10000 });
});

// ---- PRESETS ----
document.getElementById('presetChietiBtn').addEventListener('click', () => {
  map.flyTo(CHIETI_COORDS, 18, { duration: 1.2 });
  setTimeout(() => queryAndSelectParcel(CHIETI_COORDS[0], CHIETI_COORDS[1]), 1300);
});

// ---- SEARCH ----
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');

async function performSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    searchResults.innerHTML = '';
    if (data.length === 0) {
      searchResults.innerHTML = '<div class="search-item">Nessun risultato trovato</div>';
    } else {
      data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerHTML = `<i class="fa-solid fa-location-dot" style="margin-right: 6px; color: var(--accent-gold);"></i> ${item.display_name}`;
        div.addEventListener('click', () => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          map.flyTo([lat, lon], 18);
          searchResults.classList.add('hidden');
          searchInput.value = item.display_name.split(',')[0];
          setTimeout(() => queryAndSelectParcel(lat, lon), 1200);
        });
        searchResults.appendChild(div);
      });
    }
    searchResults.classList.remove('hidden');
  } catch (e) {
    console.error(e);
  } finally {
    searchBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
  }
}

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) searchResults.classList.add('hidden');
});

// ---- WFS PARCEL QUERY ----
async function queryAndSelectParcel(lat, lng) {
  cadastralDetailsEl.innerHTML = `
    <div style="text-align: center; padding: 10px;">
      <span class="loading-spinner"></span>
      <div style="margin-top: 6px; font-size: 0.78rem;"><b>Interrogazione Catasto WFS...</b></div>
    </div>
  `;

  try {
    const res = await fetch(`/api/parcels?lat=${lat}&lon=${lng}&delta=0.0015`);
    const data = await res.json();
    let matchedFeature = null;

    if (data && data.features && data.features.length > 0) {
      const pt = turf.point([lng, lat]);
      for (const feat of data.features) {
        if (turf.booleanPointInPolygon(pt, feat)) {
          matchedFeature = feat;
          break;
        }
      }
      if (!matchedFeature) {
        let minDist = Infinity;
        for (const feat of data.features) {
          const c = turf.centroid(feat);
          const dist = turf.distance(pt, c);
          if (dist < minDist) { minDist = dist; matchedFeature = feat; }
        }
      }
    }

    if (matchedFeature) {
      parcelVectorLayer.clearLayers();
      const leafletGeo = L.geoJSON(matchedFeature, {
        style: {
          color: '#fbbf24', weight: 3.5, fillColor: '#f59e0b', fillOpacity: 0.4, dashArray: null
        }
      });
      parcelVectorLayer.addLayer(leafletGeo);

      leafletGeo.eachLayer(l => {
        l.pm.enable();
        l.on('pm:edit', () => updateMeasurements(l, matchedFeature.properties.label));
        l.on('pm:drag', () => updateMeasurements(l, matchedFeature.properties.label));
      });

      updateMeasurements(matchedFeature, matchedFeature.properties.label);

      // Decode adminUnit to friendly name
      const adminCode = matchedFeature.properties.adminUnit || '';
      const natRef = matchedFeature.properties.nationalRef || '';
      // Parse foglio from nationalRef: C632_002200.8 => Foglio 22
      let foglio = '';
      const refParts = natRef.match(/_([0-9]{6})/);
      if (refParts) {
        foglio = parseInt(refParts[1].substring(0, 4), 10).toString();
      }

      cadastralDetailsEl.innerHTML = `
        <table class="cadastral-data-table">
          <tr><td>Particella:</td><td><b style="color:var(--accent-gold); font-size:1.05rem;">${matchedFeature.properties.label || 'N/D'}</b></td></tr>
          <tr><td>Foglio:</td><td>${foglio || 'N/D'}</td></tr>
          <tr><td>Codice Comune:</td><td>${adminCode}</td></tr>
          <tr><td>Rif. Nazionale:</td><td style="font-size:0.72rem;">${natRef}</td></tr>
          <tr><td>ID INSPIRE:</td><td style="font-size:0.68rem;">${matchedFeature.properties.inspireId || 'N/D'}</td></tr>
          <tr><td>Coordinate:</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
        </table>
        <div style="margin-top: 8px; font-size: 0.75rem; color: var(--accent-green); font-weight: 600;">
          ✓ Poligono catastale ufficiale agganciato
        </div>
      `;

      showToast(`📐 P.lla ${matchedFeature.properties.label} — ${Math.round(turf.area(matchedFeature)).toLocaleString('it-IT')} m²`);
    } else {
      cadastralDetailsEl.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--accent-gold); line-height:1.4;">
          ⚠ Nessuna particella trovata. Usa <b>Poligono</b> o <b>Lazo</b> per disegnare manualmente.
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching parcel:', err);
    cadastralDetailsEl.innerHTML = `<div style="color: #ef4444; font-size:0.78rem;">Errore di connessione con il catasto WFS.</div>`;
  }
}

// ---- MAP CLICK ----
map.on('click', async e => {
  if (map.pm.globalDrawModeEnabled() || lassoDrawing) return;
  queryAndSelectParcel(e.latlng.lat, e.latlng.lng);
});

// ---- EXPORT FUNCTIONS ----
document.getElementById('exportGeoJsonBtn').addEventListener('click', () => {
  if (!activePolygon) { showToast('⚠ Nessun poligono da esportare'); return; }
  const data = activePolygon.toGeoJSON ? activePolygon.toGeoJSON() : activePolygon;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'particella_catasto.geojson');
  showToast('📁 GeoJSON scaricato');
});

document.getElementById('exportKmlBtn').addEventListener('click', () => {
  if (!activePolygon) { showToast('⚠ Nessun poligono da esportare'); return; }
  const geojson = activePolygon.toGeoJSON ? activePolygon.toGeoJSON() : activePolygon;
  const coords = geojson.geometry.coordinates[0];
  const coordString = coords.map(c => `${c[0]},${c[1]},0`).join(' ');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Particella Catastale</name>
    <Style id="parcelStyle">
      <PolyStyle><color>7700ff00</color></PolyStyle>
      <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
    </Style>
    <Placemark>
      <name>Particella</name>
      <description>Misurata con Catastal GIS - Area: ${areaM2El.textContent}</description>
      <styleUrl>#parcelStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>${coordString}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  downloadBlob(blob, 'particella_google_earth.kml');
  showToast('🌍 KML scaricato — aprilo in Google Earth');
});

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  if (!activePolygon) { showToast('⚠ Nessun poligono da esportare'); return; }
  const csv = `Parametro,Valore
Area (m²),"${areaM2El.textContent.replace(/<[^>]*>/g,'')}"
Ettari (ha),"${areaHaEl.textContent}"
Are / Centiare,"${areaAreCentiareEl.textContent}"
Perimetro (m),"${perimetroMEl.textContent}"
Vertici,"${vertexCountEl.textContent}"
Baricentro,"${centroidCoordsEl.textContent}"
`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, 'particella_dati.csv');
  showToast('📊 CSV scaricato');
});

document.getElementById('copyStatsBtn').addEventListener('click', () => {
  if (!activePolygon) { showToast('⚠ Nessun dato da copiare'); return; }
  const text = `Riepilogo Particella Catastale\nArea: ${areaM2El.textContent.replace(/<[^>]*>/g,'')}\nEttari: ${areaHaEl.textContent}\nAre/Centiare: ${areaAreCentiareEl.textContent}\nPerimetro: ${perimetroMEl.textContent}\nPosizione: ${centroidCoordsEl.textContent}`;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Dati copiati negli appunti'));
});

// ---- SAVE PARCEL ----
document.getElementById('saveParcelBtn').addEventListener('click', () => {
  if (!activePolygon) { showToast('⚠ Seleziona prima una particella'); return; }
  const geojson = activePolygon.toGeoJSON ? activePolygon.toGeoJSON() : activePolygon;
  const area = turf.area(geojson);
  const centroid = turf.centroid(geojson);
  const parcel = {
    id: Date.now(),
    label: geojson.properties?.label || `Custom ${savedParcels.length + 1}`,
    area: Math.round(area),
    lat: centroid.geometry.coordinates[1].toFixed(5),
    lon: centroid.geometry.coordinates[0].toFixed(5),
    geojson: geojson
  };
  savedParcels.push(parcel);
  localStorage.setItem('catastal_saved', JSON.stringify(savedParcels));
  renderSavedParcels();
  showToast(`💾 Particella ${parcel.label} salvata`);
});

function renderSavedParcels() {
  const list = document.getElementById('savedParcelsList');
  if (savedParcels.length === 0) {
    list.innerHTML = '<div class="saved-empty">Nessuna particella salvata. Clicca <i class="fa-solid fa-floppy-disk"></i> per salvarne una.</div>';
    return;
  }
  list.innerHTML = savedParcels.map(p => `
    <div class="saved-item" data-id="${p.id}">
      <div>
        <span class="saved-item-label">P.lla ${p.label}</span>
        <span class="saved-item-area">${p.area.toLocaleString('it-IT')} m²</span>
      </div>
      <button class="saved-item-delete" data-id="${p.id}" title="Rimuovi"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');

  list.querySelectorAll('.saved-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.saved-item-delete')) return;
      const id = parseInt(el.dataset.id);
      const p = savedParcels.find(s => s.id === id);
      if (p) {
        parcelVectorLayer.clearLayers();
        const leafletGeo = L.geoJSON(p.geojson, {
          style: { color: '#fbbf24', weight: 3.5, fillColor: '#f59e0b', fillOpacity: 0.4 }
        });
        parcelVectorLayer.addLayer(leafletGeo);
        map.fitBounds(leafletGeo.getBounds(), { padding: [60, 60] });
        updateMeasurements(p.geojson, p.label);
        showToast(`📌 P.lla ${p.label} caricata`);
      }
    });
  });

  list.querySelectorAll('.saved-item-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      savedParcels = savedParcels.filter(s => s.id !== id);
      localStorage.setItem('catastal_saved', JSON.stringify(savedParcels));
      renderSavedParcels();
      showToast('🗑️ Particella rimossa');
    });
  });
}

// Init saved parcels on load
renderSavedParcels();

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Modal Guida ---
const guideBtn = document.getElementById('guideBtn');
const guideModal = document.getElementById('guideModal');
const closeGuideBtn = document.getElementById('closeGuideBtn');

if (guideBtn && guideModal && closeGuideBtn) {
  guideBtn.addEventListener('click', () => {
    guideModal.classList.remove('hidden');
  });

  closeGuideBtn.addEventListener('click', () => {
    guideModal.classList.add('hidden');
  });

  // Chiudi cliccando fuori dal modale
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) {
      guideModal.classList.add('hidden');
    }
  });
}
