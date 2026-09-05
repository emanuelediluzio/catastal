const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WMS proxy to bypass CORS and User-Agent blocking
app.get('/api/wms', async (req, res) => {
  try {
    const wmsUrl = 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php';
    const params = { ...req.query };
    
    // Ensure proper encoding and headers
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
