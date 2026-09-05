const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WMS proxy to Agenzia Entrate
app.get('/api/wms', async (req, res) => {
  try {
    const wmsUrl = 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php';
    const params = { ...req.query };
    
    const response = await axios.get(wmsUrl, {
      params,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/png,image/*,*/*'
      },
      timeout: 10000
    });

    const contentType = response.headers['content-type'] || 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy failed to contact Agenzia Entrate WMS' });
    }
  }
});

const xml2js = require('xml2js');

// WFS endpoint: fetches official Cadastral Parcels as GeoJSON using native Node.js (Vercel friendly)
app.get('/api/parcels', async (req, res) => {
  const { lat, lon, delta = 0.0015 } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const fLat = parseFloat(lat);
  const fLon = parseFloat(lon);
  const fDelta = parseFloat(delta);
  const bbox = `${fLat - fDelta},${fLon - fDelta},${fLat + fDelta},${fLon + fDelta},urn:ogc:def:crs:EPSG::6706`;
  const url = `https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP:CadastralParcel&BBOX=${bbox}`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 12000
    });

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    parser.parseString(response.data, (err, result) => {
      if (err) throw new Error('XML Parse Error');
      
      const features = [];
      const featureCollection = result['wfs:FeatureCollection'] || result['FeatureCollection'];
      if (!featureCollection) return res.json({ type: "FeatureCollection", features: [] });

      let members = featureCollection['wfs:member'] || featureCollection['member'] || [];
      if (!Array.isArray(members)) members = [members];

      members.forEach(member => {
        const parcel = member['CP:CadastralParcel'];
        if (!parcel) return;

        const label = parcel['CP:LABEL'] || "";
        const ref = parcel['CP:NATIONALCADASTRALREFERENCE'] || "";
        const admin = parcel['CP:ADMINISTRATIVEUNIT'] || "";
        const inspire = parcel['CP:INSPIREID_LOCALID'] || "";

        try {
          const msGeom = parcel['CP:msGeometry'];
          if (!msGeom) return;
          const polygon = msGeom['gml:Polygon'] || msGeom['Polygon'];
          if (!polygon) return;
          const exterior = polygon['gml:exterior'] || polygon['exterior'];
          const ring = exterior['gml:LinearRing'] || exterior['LinearRing'];
          const posList = ring['gml:posList'] || ring['posList'];

          if (!posList) return;

          const rawPts = posList.trim().split(/\s+/);
          const coords = [];
          for (let i = 0; i < rawPts.length; i += 2) {
            coords.push([parseFloat(rawPts[i+1]), parseFloat(rawPts[i])]); // GeoJSON is lon, lat
          }

          if (coords.length >= 3) {
            features.push({
              type: "Feature",
              properties: { label, nationalRef: ref, adminUnit: admin, inspireId: inspire },
              geometry: { type: "Polygon", coordinates: [coords] }
            });
          }
        } catch (e) {
          // Skip parcel if geometry parsing fails
        }
      });

      res.json({ type: "FeatureCollection", features });
    });
  } catch (error) {
    console.error('WFS Fetch/Parse error:', error.message);
    res.status(500).json({ error: 'Failed to fetch or parse cadastral features', features: [] });
  }
});

// Geocoding Proxy (using Nominatim OpenStreetMap)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        countrycodes: 'it',
        addressdetails: 1,
        limit: 5
      },
      headers: {
        'User-Agent': 'CatastalGeomMap/1.0 (emanuelediluzio)'
      },
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Catastal GIS running at http://localhost:${PORT}`);
});
