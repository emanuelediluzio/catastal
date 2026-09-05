// Catastal WebGIS Application Logic

// Define EPSG:6706 (RDN2008 / geographic 2D) used by Agenzia delle Entrate WMS
// EPSG:6706 uses lat/lon order in WMS 1.3.0
proj4.defs('EPSG:6706', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs');

// Target initial center: Chieti (P.lla 8, Foglio 21) from user screenshots
const CHIETI_COORDS = [42.3739, 14.1978];
const INITIAL_ZOOM = 17;

// Initialize Leaflet Map
const map = L.map('map', {
  center: CHIETI_COORDS,
  zoom: INITIAL_ZOOM,
  maxZoom: 21,
  zoomControl: false
});

// Move zoom controls to bottom right
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Base Tile Layers
const baseLayers = {
  googleSat: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
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

// Add default basemap
baseLayers.googleSat.addTo(map);

// Agenzia delle Entrate WMS Catasto Layer via local backend proxy
let currentLayers = ['province', 'CP.CadastralZoning', 'CP.CadastralParcel', 'fabbricati', 'codice_plla'];

// Custom WMS Layer handling CRS EPSG:6706 bbox coordinate order
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

    // WMS 1.3.0 with EPSG:6706 expects BBOX=minLat,minLon,maxLat,maxLon
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
  opacity: 0.85,
  zIndex: 100
}).addTo(map);

// Leaflet-Geoman Toolbar setup for Polygon and Freehand / Lasso
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

// Configure Geoman global style
map.pm.setGlobalOptions({
  pathOptions: {
    color: '#fbbf24',
    fillColor: '#f59e0b',
    fillOpacity: 0.35,
    weight: 3
  }
});

// Variables to track active measurements and layers
let drawnLayers = [];
let activePolygon = null;

// UI Elements
const areaM2El = document.getElementById('areaM2');
const areaHaEl = document.getElementById('areaHa');
const areaAreCentiareEl = document.getElementById('areaAreCentiare');
const perimetroMEl = document.getElementById('perimetroM');
const vertexCountEl = document.getElementById('vertexCount');
const centroidCoordsEl = document.getElementById('centroidCoords');
const zoomAlertText = document.getElementById('zoomAlertText');

// Update measurements from layer geometry
function updateMeasurements(layer) {
  if (!layer) return;
  activePolygon = layer;
  const geojson = layer.toGeoJSON();

  try {
    let area = 0;
    let perimeter = 0;
    let vertices = 0;

    if (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon') {
      area = turf.area(geojson); // square meters
      perimeter = turf.length(geojson, { units: 'meters' });
      vertices = geojson.geometry.coordinates[0].length - 1;
    } else if (geojson.geometry.type === 'LineString') {
      perimeter = turf.length(geojson, { units: 'meters' });
      vertices = geojson.geometry.coordinates.length;
    }

    // Format Area (m²)
    areaM2El.innerHTML = `${area.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="unit">m²</span>`;

    // Format Hectares (ha)
    const hectares = area / 10000;
    areaHaEl.textContent = `${hectares.toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;

    // Format Are e Centiare (1 ara = 100 m², 1 centiara = 1 m²)
    const totalCentiare = Math.round(area);
    const are = Math.floor(totalCentiare / 100);
    const centiare = totalCentiare % 100;
    areaAreCentiareEl.textContent = `${are} a ${centiare} ca`;

    // Format Perimeter
    perimetroMEl.textContent = `${perimeter.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

    // Vertex count
    vertexCountEl.textContent = vertices;

    // Centroid
    const centroid = turf.centroid(geojson);
    const [cLng, cLat] = centroid.geometry.coordinates;
    centroidCoordsEl.textContent = `Lat: ${cLat.toFixed(6)}, Lon: ${cLng.toFixed(6)}`;

    // Update Tooltip on polygon
    layer.bindTooltip(
      `<b>Area:</b> ${Math.round(area).toLocaleString('it-IT')} m²<br><b>Perimetro:</b> ${Math.round(perimeter)} m`,
      { permanent: false, direction: 'center', className: 'measure-tooltip' }
    );
  } catch (err) {
    console.error('Error calculating metrics:', err);
  }
}

// Clear all measurements
function clearAllDrawings() {
  drawnLayers.forEach(l => map.removeLayer(l));
  drawnLayers = [];
  activePolygon = null;
  areaM2El.innerHTML = `0.00 <span class="unit">m²</span>`;
  areaHaEl.textContent = '0.0000 ha';
  areaAreCentiareEl.textContent = '0 a 0 ca';
  perimetroMEl.textContent = '0.00 m';
  vertexCountEl.textContent = '0';
  centroidCoordsEl.textContent = 'Clicca sulla mappa o traccia un poligono';
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

// Button triggers for drawing
document.getElementById('drawPolygonBtn').addEventListener('click', () => {
  map.pm.enableDraw('Polygon', {
    snappable: true,
    snapDistance: 20,
    finishOn: 'dblclick'
  });
});

// Freehand / Lasso tool implementation
let lassoDrawing = false;
let lassoPoints = [];
let lassoPolyline = null;

const drawLassoBtn = document.getElementById('drawLassoBtn');

drawLassoBtn.addEventListener('click', () => {
  if (drawLassoBtn.classList.contains('active')) {
    drawLassoBtn.classList.remove('active');
    map.dragging.enable();
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

  // Close polygon
  const polygon = L.polygon(lassoPoints, {
    color: '#fbbf24',
    fillColor: '#f59e0b',
    fillOpacity: 0.35,
    weight: 3
  }).addTo(map);

  polygon.pm.enable();
  drawnLayers.push(polygon);
  updateMeasurements(polygon);

  polygon.on('pm:edit', () => updateMeasurements(polygon));
  polygon.on('pm:drag', () => updateMeasurements(polygon));
  polygon.on('click', () => updateMeasurements(polygon));

  // Reset tool
  drawLassoBtn.classList.remove('active');
  map.dragging.enable();
  map.getContainer().style.cursor = '';
  map.off('mousedown', startLasso);
  map.off('mousemove', trackLasso);
  map.off('mouseup', finishLasso);
}

document.getElementById('clearMeasurementsBtn').addEventListener('click', clearAllDrawings);

// Base Map Switcher
document.querySelectorAll('input[name="basemap"]').forEach(input => {
  input.addEventListener('change', e => {
    Object.values(baseLayers).forEach(l => map.removeLayer(l));
    baseLayers[e.target.value].addTo(map);
    // Ensure catasto stays on top
    if (document.getElementById('catastoToggle').checked) {
      catastoLayer.bringToFront();
    }
  });
});

// Catasto Toggle & Opacity
const catastoToggle = document.getElementById('catastoToggle');
const opacitySlider = document.getElementById('opacitySlider');
const opacityVal = document.getElementById('opacityVal');

catastoToggle.addEventListener('change', e => {
  if (e.target.checked) {
    catastoLayer.addTo(map);
  } else {
    map.removeLayer(catastoLayer);
  }
});

opacitySlider.addEventListener('input', e => {
  const val = e.target.value;
  opacityVal.textContent = `${val}%`;
  catastoLayer.setOpacity(val / 100);
});

// Layer filter checkboxes
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

// Zoom Level Monitor
map.on('zoomend', () => {
  const z = map.getZoom();
  if (z >= 15) {
    zoomAlertText.innerHTML = `Zoom: <b>${z}</b> (Dettaglio catastale e particelle visibili)`;
  } else {
    zoomAlertText.innerHTML = `Zoom: <b>${z}</b> (Ingrandisci a zoom ≥ 15 per i codici particella)`;
  }
});

// Quick Presets
document.getElementById('presetChietiBtn').addEventListener('click', () => {
  map.flyTo(CHIETI_COORDS, 17, { duration: 1.2 });
});

document.getElementById('locateMeBtn').addEventListener('click', () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      map.flyTo([latitude, longitude], 17);
      L.marker([latitude, longitude]).addTo(map).bindPopup('La tua posizione').openPopup();
    }, () => {
      alert('Impossibile ottenere la posizione GPS.');
    });
  } else {
    alert('Geolocalizzazione non supportata dal browser.');
  }
});

// Search functionality via Backend Proxy
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
          map.flyTo([parseFloat(item.lat), parseFloat(item.lon)], 17);
          searchResults.classList.add('hidden');
          searchInput.value = item.display_name.split(',')[0];
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
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') performSearch();
});

// Close search popup on click outside
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) {
    searchResults.classList.add('hidden');
  }
});

// Reverse geocoding & point inspector on map click
const cadastralDetailsEl = document.getElementById('cadastralDetails');

map.on('click', async e => {
  if (map.pm.globalDrawModeEnabled() || lassoDrawing) return;

  const { lat, lng } = e.latlng;
  cadastralDetailsEl.innerHTML = `
    <div style="text-align: center; padding: 10px;">
      <i class="fa-solid fa-spinner fa-spin"></i> Rilevamento dati catastali e comune...
    </div>
  `;

  try {
    // Reverse geocode point
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
    const data = await res.json();
    const addr = data.address || {};
    const comune = addr.city || addr.town || addr.village || addr.municipality || 'Non identificato';
    const provincia = addr.county || addr.province || '';
    const via = addr.road || addr.suburb || 'Terreno / Area Rurale';

    cadastralDetailsEl.innerHTML = `
      <table class="cadastral-data-table">
        <tr><td>Comune:</td><td>${comune} (${provincia})</td></tr>
        <tr><td>Indirizzo:</td><td>${via}</td></tr>
        <tr><td>Coordinate:</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
        <tr><td>Quota:</td><td>${data.extratags?.ele ? data.extratags.ele + ' m s.l.m.' : 'Disponibile su terreno'}</td></tr>
        <tr><td>Visuale:</td><td>WMS Agenzia Entrate (Banca Dati Nazionale)</td></tr>
      </table>
      <div style="font-size: 0.72rem; color: var(--accent-gold); margin-top: 8px;">
        💡 Ingrandisci a zoom 16+ per leggere il codice particella sulla mappa sopra il cursore.
      </div>
    `;
  } catch (err) {
    cadastralDetailsEl.innerHTML = `
      <table class="cadastral-data-table">
        <tr><td>Coordinate:</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
        <tr><td>Stato Catasto:</td><td>Consultazione WMS attiva</td></tr>
      </table>
    `;
  }
});

// Export KML & GeoJSON
document.getElementById('exportGeoJsonBtn').addEventListener('click', () => {
  if (!activePolygon) {
    alert('Nessun poligono selezionato. Disegna prima una particella!');
    return;
  }
  const data = activePolygon.toGeoJSON();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'particella_catasto.geojson');
});

document.getElementById('exportKmlBtn').addEventListener('click', () => {
  if (!activePolygon) {
    alert('Nessun poligono selezionato. Disegna prima una particella!');
    return;
  }
  const geojson = activePolygon.toGeoJSON();
  const coords = geojson.geometry.coordinates[0];
  const coordString = coords.map(c => `${c[0]},${c[1]},0`).join(' ');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Particella Catastale Misurata</name>
    <Placemark>
      <name>Particella</name>
      <description>Misurata con Catastal GIS</description>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordString}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  downloadBlob(blob, 'particella_google_earth.kml');
});

// Copy summary to clipboard
document.getElementById('copyStatsBtn').addEventListener('click', () => {
  if (!activePolygon) {
    alert('Disegna o seleziona un poligono prima di copiare i dati!');
    return;
  }
  const text = `Riepilogo Particella Catastale:
Area: ${areaM2El.textContent}
Ettari: ${areaHaEl.textContent}
Are/Centiare: ${areaAreCentiareEl.textContent}
Perimetro: ${perimetroMEl.textContent}
Posizione: ${centroidCoordsEl.textContent}`;

  navigator.clipboard.writeText(text).then(() => {
    alert('Riepilogo copiato negli appunti!');
  });
});

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
