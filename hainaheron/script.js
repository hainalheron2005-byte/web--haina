/**
 * BHARATHAPUZHA RIVER BASIN WEBGIS PORTAL
 * Master Script: Spatial Processing, Leaflet WebGIS Engine, Analytics & Interactivity
 * Author: HAINA L. HERON | MSc Geography & Disaster Management
 * Sree Sankaracharya University of Sanskrit, Kalady
 */

document.addEventListener("DOMContentLoaded", function () {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById("mobileToggle");
  const navMenu = document.getElementById("navMenu");
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener("click", () => {
      navMenu.classList.toggle("show");
    });
  }

  // 2. Initialize Leaflet Map
  // Center near Palakkad / Central Bharathapuzha Basin (10.78, 76.45)
  const map = L.map("map", {
    center: [10.78, 76.45],
    zoom: 10,
    minZoom: 8,
    maxZoom: 18,
    zoomControl: false // custom position
  });

  // Zoom control top-right
  L.control.zoom({ position: "topright" }).addTo(map);

  // Basemaps
  const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  const esriSatLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
  });

  const esriTopoLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, METI, NRCAN',
    maxZoom: 18
  });

  const cartoPositron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  });

  // Default basemap
  osmLayer.addTo(map);

  // Scale bar
  L.control.scale({ imperial: false, metric: true, position: "bottomleft" }).addTo(map);

  // Layer containers
  const layers = {
    basin: null,
    streams: null,
    waterbodies: null,
    checkdams: null,
    geology: null,
    roads: null
  };

  let basinBounds = null;
  let allSearchItems = [];

  // Coordinate display & live tracker
  const coordDisplay = document.getElementById("coordDisplay");
  map.on("mousemove", function (e) {
    if (coordDisplay) {
      const lat = e.latlng.lat.toFixed(5);
      const lng = e.latlng.lng.toFixed(5);
      // Rough UTM Zone 43N estimation
      const utmEast = Math.round(500000 + (e.latlng.lng - 75) * 111320 * Math.cos(e.latlng.lat * Math.PI / 180));
      const utmNorth = Math.round(e.latlng.lat * 110574);
      coordDisplay.innerHTML = `<i class="fa-solid fa-crosshairs"></i> Lat: <b>${lat}°N</b> | Lon: <b>${lng}°E</b> | UTM 43N: <b>E ${utmEast} m, N ${utmNorth} m</b> | Zoom: <b>${map.getZoom()}</b>`;
    }
  });

  // Symbology helpers
  function getGeologyColor(name, group) {
    if (name.includes("Charnockite")) return "#d4b483";
    if (name.includes("Migmatite")) return "#e2c499";
    if (name.includes("Gneissic")) return "#c29b62";
    if (name.includes("Khondalite")) return "#a98453";
    if (name.includes("Basic Rocks")) return "#c84b31";
    if (name.includes("Pegmatite")) return "#e53e3e";
    if (name.includes("Sand and Silt")) return "#ffd56b";
    if (name.includes("Sandstone")) return "#f6ad55";
    if (group && group.includes("Plutonic")) return "#c84b31";
    if (group && group.includes("Sediment")) return "#ffd56b";
    return "#cbd5e1";
  }

  function getStreamStyle(order) {
    switch (order) {
      case 5:
        return { color: "#023e8a", weight: 3.5, opacity: 1.0 };
      case 4:
        return { color: "#03045e", weight: 2.8, opacity: 0.95 };
      case 3:
        return { color: "#0077b6", weight: 2.0, opacity: 0.9 };
      case 2:
        return { color: "#00b4d8", weight: 1.4, opacity: 0.85 };
      case 1:
        return { color: "#90e0ef", weight: 0.9, opacity: 0.75 };
      default:
        return { color: "#0077b6", weight: 1.8, opacity: 0.85 };
    }
  }

  function getRoadStyle(name) {
    if (!name) return { color: "#94a3b8", weight: 1.0, opacity: 0.7 };
    const n = name.toUpperCase();
    if (n.includes("NATIONAL HIGHWAY")) return { color: "#ef4444", weight: 3.2, opacity: 1.0 };
    if (n.includes("STATE HIGHWAY")) return { color: "#f97316", weight: 2.4, opacity: 0.9 };
    if (n.includes("DISTRICT ROAD")) return { color: "#475569", weight: 1.6, opacity: 0.85 };
    if (n.includes("VILLAGE ROAD")) return { color: "#64748b", weight: 1.2, opacity: 0.75 };
    return { color: "#94a3b8", weight: 0.8, opacity: 0.6, dashArray: "3, 3" };
  }

  // Load GeoJSON data files
  console.log("Loading Bharathapuzha WebGIS layers...");

  // 1. Basin Boundary
  fetch("data/bharathapuzha_basin.geojson")
    .then(r => r.json())
    .then(data => {
      layers.basin = L.geoJSON(data, {
        style: {
          color: "#0f172a",
          weight: 2.5,
          opacity: 1,
          fillColor: "#0284c7",
          fillOpacity: 0.05
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-title">${p.WSNAME || "Bharathapuzha Basin"}</div>
                <div class="popup-subtitle">Watershed Code: ${p.WSCODE || "20B4w"}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">NRIS Code</td><td class="val">${p.NRIS || "20-02-04-23"}</td></tr>
                  <tr><td class="key">Sub-basin Area</td><td class="val">${p.AREA ? Number(p.AREA).toFixed(2) + " km²" : "N/A"}</td></tr>
                  <tr><td class="key">Perimeter</td><td class="val">${p.PERIMETER ? Number(p.PERIMETER).toFixed(2) + " km" : "N/A"}</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      }).addTo(map);

      basinBounds = layers.basin.getBounds();
      map.fitBounds(basinBounds, { padding: [20, 20] });
    })
    .catch(err => console.error("Basin load error:", err));

  // 2. Geology
  fetch("data/geology.geojson")
    .then(r => r.json())
    .then(data => {
      layers.geology = L.geoJSON(data, {
        style: function (feat) {
          const p = feat.properties;
          return {
            fillColor: getGeologyColor(p.NAME || "", p.ROCK_GROUP || ""),
            fillOpacity: 0.75,
            color: "#475569",
            weight: 0.6,
            opacity: 0.8
          };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-title">${p.NAME || "Geological Formation"}</div>
                <div class="popup-subtitle">${p.ROCK_GROUP || "Lithological Group"}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">Lithology</td><td class="val">${p.NAME || "N/A"}</td></tr>
                  <tr><td class="key">Rock Group</td><td class="val">${p.ROCK_GROUP || "N/A"}</td></tr>
                  <tr><td class="key">Terrain Zone</td><td class="val">Peninsular Shield / Palakkad Gap</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      });
      // Off by default to keep initial view fast and clear
      const geoCheck = document.getElementById("layerGeology");
      if (geoCheck && geoCheck.checked) {
        layers.geology.addTo(map);
      }
    })
    .catch(err => console.error("Geology load error:", err));

  // 3. Waterbodies
  fetch("data/waterbodies.geojson")
    .then(r => r.json())
    .then(data => {
      layers.waterbodies = L.geoJSON(data, {
        style: {
          fillColor: "#0284c7",
          fillOpacity: 0.85,
          color: "#0369a1",
          weight: 1.2
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-title">${p.name || "Reservoir / Waterbody"}</div>
                <div class="popup-subtitle">Inland Water Surface</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">Surface Area</td><td class="val">${p.area_sqkm || "N/A"} km²</td></tr>
                  <tr><td class="key">Area (Hectares)</td><td class="val">${p.area_ha || "N/A"} Ha</td></tr>
                  <tr><td class="key">Perimeter</td><td class="val">${p.Shape_Leng ? (p.Shape_Leng / 1000).toFixed(2) + " km" : "N/A"}</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      }).addTo(map);
    })
    .catch(err => console.error("Waterbodies load error:", err));

  // 4. Streams / Drainage Network
  fetch("data/streams.geojson")
    .then(r => r.json())
    .then(data => {
      layers.streams = L.geoJSON(data, {
        style: function (feat) {
          return getStreamStyle(feat.properties.ORDER1);
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          const orderText = p.ORDER1 > 0 ? `Order ${p.ORDER1} Stream` : "Mainstem Reach / Connector";
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-title">${orderText}</div>
                <div class="popup-subtitle">Strahler Stream Hierarchy</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">Stream Order</td><td class="val">${p.ORDER1}</td></tr>
                  <tr><td class="key">Reach Length</td><td class="val">${p.LENGTH ? Number(p.LENGTH).toFixed(3) + " km" : (p.Shape_Leng ? (p.Shape_Leng/1000).toFixed(3) + " km" : "N/A")}</td></tr>
                  <tr><td class="key">Drainage Basin</td><td class="val">Bharathapuzha (Nila)</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      }).addTo(map);
    })
    .catch(err => console.error("Streams load error:", err));

  // 5. Roads
  fetch("data/roads.geojson")
    .then(r => r.json())
    .then(data => {
      layers.roads = L.geoJSON(data, {
        style: function (feat) {
          return getRoadStyle(feat.properties.NAME);
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-title">${p.NAME || "Road Network"}</div>
                <div class="popup-subtitle">Transportation Infrastructure</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">Category</td><td class="val">${p.NAME || "Unclassified"}</td></tr>
                  <tr><td class="key">Segment Length</td><td class="val">${p.Length ? Number(p.Length).toFixed(3) + " km" : "N/A"}</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      });
      // Roads unchecked by default for initial map clarity
      const rdCheck = document.getElementById("layerRoads");
      if (rdCheck && rdCheck.checked) {
        layers.roads.addTo(map);
      }
    })
    .catch(err => console.error("Roads load error:", err));

  // 6. CheckDams & Major Reservoirs (with photos)
  fetch("data/checkdams.geojson")
    .then(r => r.json())
    .then(data => {
      layers.checkdams = L.geoJSON(data, {
        pointToLayer: function (feat, latlng) {
          const pinHtml = `
            <div class="dam-pulse-pin" title="${feat.properties.name1}">
              <i class="fa-solid fa-water"></i>
            </div>
          `;
          return L.marker(latlng, {
            icon: L.divIcon({
              html: pinHtml,
              className: "",
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              popupAnchor: [0, -14]
            })
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          const imgHtml = p.photo_url
            ? `<img src="${p.photo_url}" alt="${p.name1}" class="popup-img" onerror="this.style.display='none'">`
            : "";

          layer.bindPopup(`
            <div class="popup-card">
              ${imgHtml}
              <div class="popup-header">
                <div class="popup-title">${p.name1 || "Dam / Check Dam"}</div>
                <div class="popup-subtitle">${p.dam_type || "Water Resource Structure"}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="key">Tributary</td><td class="val">${p.tributary || "Bharathapuzha"}</td></tr>
                  <tr><td class="key">Gross Capacity</td><td class="val">${p.capacity || "N/A"}</td></tr>
                  <tr><td class="key">Commissioned</td><td class="val">${p.year || "N/A"}</td></tr>
                  <tr><td class="key">District</td><td class="val">${p.district || "Palakkad"}</td></tr>
                  <tr><td class="key">Main Purpose</td><td class="val">${p.purpose || "Irrigation & Water Supply"}</td></tr>
                </table>
              </div>
            </div>
          `);

          // Add to search index
          if (p.name1) {
            allSearchItems.push({
              name: p.name1,
              type: "Dam / Reservoir",
              latlng: layer.getLatLng(),
              layer: layer
            });
          }
        }
      }).addTo(map);

      // Populate database table for dams
      populateDamsTable(data.features);
    })
    .catch(err => console.error("CheckDams load error:", err));

  // 3. Layer Visibility Toggle Events
  function bindToggle(elemId, layerKey) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.addEventListener("change", function () {
      if (!layers[layerKey]) return;
      if (this.checked) {
        map.addLayer(layers[layerKey]);
      } else {
        map.removeLayer(layers[layerKey]);
      }
      updateLegend();
    });
  }

  bindToggle("layerBasin", "basin");
  bindToggle("layerStreams", "streams");
  bindToggle("layerWaterbodies", "waterbodies");
  bindToggle("layerDams", "checkdams");
  bindToggle("layerGeology", "geology");
  bindToggle("layerRoads", "roads");

  // Basemap Selector Switcher
  const basemapSelect = document.getElementById("basemapSelect");
  if (basemapSelect) {
    basemapSelect.addEventListener("change", function () {
      map.removeLayer(osmLayer);
      map.removeLayer(esriSatLayer);
      map.removeLayer(esriTopoLayer);
      map.removeLayer(cartoPositron);

      switch (this.value) {
        case "satellite":
          esriSatLayer.addTo(map);
          break;
        case "topo":
          esriTopoLayer.addTo(map);
          break;
        case "carto":
          cartoPositron.addTo(map);
          break;
        default:
          osmLayer.addTo(map);
      }
    });
  }

  // Opacity Slider (for Geology)
  const opacitySlider = document.getElementById("opacitySlider");
  const opacityVal = document.getElementById("opacityVal");
  if (opacitySlider && opacityVal) {
    opacitySlider.addEventListener("input", function () {
      const val = parseFloat(this.value);
      opacityVal.textContent = Math.round(val * 100) + "%";
      if (layers.geology) {
        layers.geology.setStyle({ fillOpacity: val });
      }
    });
  }

  // Fit Bounds Button
  const btnFitBounds = document.getElementById("btnFitBounds");
  if (btnFitBounds) {
    btnFitBounds.addEventListener("click", () => {
      if (basinBounds) {
        map.fitBounds(basinBounds, { padding: [20, 20] });
      }
    });
  }

  // Fullscreen Button
  const btnFullscreen = document.getElementById("btnFullscreen");
  const mapWrapper = document.querySelector(".map-wrapper");
  if (btnFullscreen && mapWrapper) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        mapWrapper.requestFullscreen().catch(err => alert("Fullscreen error: " + err.message));
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Sidebar Toggle Drawer
  const btnToggleSidebar = document.getElementById("btnToggleSidebar");
  const gisSidebar = document.getElementById("gisSidebar");
  if (btnToggleSidebar && gisSidebar) {
    btnToggleSidebar.addEventListener("click", () => {
      gisSidebar.classList.toggle("collapsed");
    });
  }

  // 4. Interactive Measurement Tools (Distance & Area)
  let measureMode = null;
  let measurePts = [];
  let measureMarkers = [];
  let measureLine = null;
  let measurePoly = null;
  let measureTooltip = null;

  const btnMeasureDist = document.getElementById("btnMeasureDist");
  const btnMeasureArea = document.getElementById("btnMeasureArea");
  const btnClearMeasure = document.getElementById("btnClearMeasure");

  function clearMeasurements() {
    measurePts = [];
    measureMarkers.forEach(m => map.removeLayer(m));
    measureMarkers = [];
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    if (measurePoly) { map.removeLayer(measurePoly); measurePoly = null; }
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    measureMode = null;
    if (btnMeasureDist) btnMeasureDist.classList.remove("active");
    if (btnMeasureArea) btnMeasureArea.classList.remove("active");
  }

  if (btnClearMeasure) {
    btnClearMeasure.addEventListener("click", clearMeasurements);
  }

  if (btnMeasureDist) {
    btnMeasureDist.addEventListener("click", function () {
      clearMeasurements();
      measureMode = "distance";
      this.classList.add("active");
      alert("Measurement Tool Active: Click on the map to measure distance. Double-click or click Clear to finish.");
    });
  }

  if (btnMeasureArea) {
    btnMeasureArea.addEventListener("click", function () {
      clearMeasurements();
      measureMode = "area";
      this.classList.add("active");
      alert("Measurement Tool Active: Click on 3 or more points on the map to measure area. Click Clear to reset.");
    });
  }

  map.on("click", function (e) {
    if (!measureMode) return;
    measurePts.push(e.latlng);

    const m = L.circleMarker(e.latlng, { radius: 5, color: "#ef4444", fillColor: "#fff", fillOpacity: 1 }).addTo(map);
    measureMarkers.push(m);

    if (measureMode === "distance") {
      if (measurePts.length > 1) {
        if (!measureLine) {
          measureLine = L.polyline(measurePts, { color: "#ef4444", weight: 3, dashArray: "5, 5" }).addTo(map);
        } else {
          measureLine.setLatLngs(measurePts);
        }
        // Calculate cumulative length
        let totalMeters = 0;
        for (let i = 0; i < measurePts.length - 1; i++) {
          totalMeters += measurePts[i].distanceTo(measurePts[i + 1]);
        }
        const text = totalMeters > 1000
          ? (totalMeters / 1000).toFixed(2) + " km"
          : Math.round(totalMeters) + " m";

        if (!measureTooltip) {
          measureTooltip = L.popup({ closeButton: false, autoClose: false, className: "measure-popup" })
            .setLatLng(e.latlng)
            .setContent(`<b>Distance: ${text}</b>`)
            .openOn(map);
        } else {
          measureTooltip.setLatLng(e.latlng).setContent(`<b>Distance: ${text}</b>`);
        }
      }
    } else if (measureMode === "area") {
      if (measurePts.length >= 3) {
        if (!measurePoly) {
          measurePoly = L.polygon(measurePts, { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.25 }).addTo(map);
        } else {
          measurePoly.setLatLngs(measurePts);
        }
        // Simple planar approximation of polygon area
        let areaSqm = 0;
        const n = measurePts.length;
        const R = 6378137;
        for (let i = 0; i < n; i++) {
          const p1 = measurePts[i];
          const p2 = measurePts[(i + 1) % n];
          areaSqm += (p2.lng * Math.PI / 180 - p1.lng * Math.PI / 180) *
                     (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
        }
        areaSqm = Math.abs(areaSqm * R * R / 2.0);

        const ha = (areaSqm / 10000).toFixed(2);
        const sqkm = (areaSqm / 1000000).toFixed(2);

        if (!measureTooltip) {
          measureTooltip = L.popup({ closeButton: false, autoClose: false })
            .setLatLng(e.latlng)
            .setContent(`<b>Area: ${sqkm} km² (${ha} Ha)</b>`)
            .openOn(map);
        } else {
          measureTooltip.setLatLng(e.latlng).setContent(`<b>Area: ${sqkm} km² (${ha} Ha)</b>`);
        }
      }
    }
  });

  // 5. Search Bar Auto-complete & Fly-to
  const mapSearchInput = document.getElementById("mapSearchInput");
  const searchResults = document.getElementById("searchResults");

  if (mapSearchInput && searchResults) {
    mapSearchInput.addEventListener("input", function () {
      const q = this.value.trim().toLowerCase();
      if (q.length < 2) {
        searchResults.style.display = "none";
        return;
      }
      const matches = allSearchItems.filter(item => item.name.toLowerCase().includes(q));
      if (matches.length === 0) {
        searchResults.innerHTML = `<div class="search-item" style="color:#94a3b8">No matching dams or features found</div>`;
        searchResults.style.display = "block";
        return;
      }
      searchResults.innerHTML = matches.map(item => `
        <div class="search-item" data-name="${item.name}">
          <i class="fa-solid fa-location-dot" style="color:#38bdf8; margin-right:6px"></i>
          <b>${item.name}</b> <span style="font-size:0.75rem; color:#94a3b8">(${item.type})</span>
        </div>
      `).join("");
      searchResults.style.display = "block";

      searchResults.querySelectorAll(".search-item").forEach(el => {
        el.addEventListener("click", function () {
          const targetName = this.getAttribute("data-name");
          const target = allSearchItems.find(t => t.name === targetName);
          if (target) {
            map.flyTo(target.latlng, 13, { duration: 1.5 });
            target.layer.openPopup();
            searchResults.style.display = "none";
            mapSearchInput.value = target.name;
          }
        });
      });
    });

    document.addEventListener("click", function (e) {
      if (!mapSearchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = "none";
      }
    });
  }

  // 6. Dynamic Legend
  function updateLegend() {
    const legendEl = document.getElementById("mapLegend");
    if (!legendEl) return;
    let html = `<div class="legend-title"><i class="fa-solid fa-map-signs"></i> Active Map Legend</div>`;

    const basinCheck = document.getElementById("layerBasin");
    if (basinCheck && basinCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-symbol" style="background:#0284c7; border:1px solid #0f172a"></span> Basin Boundary</div>
      `;
    }
    const strCheck = document.getElementById("layerStreams");
    if (strCheck && strCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-line" style="background:#023e8a; height:4px"></span> Order 5 (Major Mainstem)</div>
        <div class="legend-item"><span class="legend-line" style="background:#03045e; height:3px"></span> Order 4 (Primary Tributaries)</div>
        <div class="legend-item"><span class="legend-line" style="background:#0077b6; height:2px"></span> Order 3 (Secondary Streams)</div>
        <div class="legend-item"><span class="legend-line" style="background:#00b4d8; height:1.5px"></span> Order 2 (Rills & Feeders)</div>
        <div class="legend-item"><span class="legend-line" style="background:#90e0ef; height:1px"></span> Order 1 (Headwater Channels)</div>
      `;
    }
    const wbCheck = document.getElementById("layerWaterbodies");
    if (wbCheck && wbCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-symbol" style="background:#0284c7; border:1px solid #0369a1"></span> Reservoirs & Waterbodies</div>
      `;
    }
    const damCheck = document.getElementById("layerDams");
    if (damCheck && damCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-symbol" style="background:#ef4444; border-radius:50%; border:1px solid #fff"></span> Dam / Check Dam Structure</div>
      `;
    }
    const geoCheck = document.getElementById("layerGeology");
    if (geoCheck && geoCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-symbol" style="background:#e2c499"></span> Migmatite Complex</div>
        <div class="legend-item"><span class="legend-symbol" style="background:#d4b483"></span> Charnockite Group</div>
        <div class="legend-item"><span class="legend-symbol" style="background:#c29b62"></span> Peninsular Gneiss</div>
        <div class="legend-item"><span class="legend-symbol" style="background:#c84b31"></span> Plutonic Basic Dykes</div>
        <div class="legend-item"><span class="legend-symbol" style="background:#ffd56b"></span> Alluvial Sand & Silt</div>
      `;
    }
    const rdCheck = document.getElementById("layerRoads");
    if (rdCheck && rdCheck.checked) {
      html += `
        <div class="legend-item"><span class="legend-line" style="background:#ef4444; height:3px"></span> National Highway (NH 544)</div>
        <div class="legend-item"><span class="legend-line" style="background:#f97316; height:2px"></span> State Highways</div>
        <div class="legend-item"><span class="legend-line" style="background:#475569; height:1.5px"></span> District Roads</div>
        <div class="legend-item"><span class="legend-line" style="background:#94a3b8; height:1px"></span> Village Roads / Tracks</div>
      `;
    }

    legendEl.innerHTML = html;
  }
  updateLegend();

  // 7. Initialize Chart.js Dashboard
  fetch("data/basin_stats.json")
    .then(r => r.json())
    .then(stats => {
      initCharts(stats);
      populateDatabaseTables(stats);
    })
    .catch(err => console.error("Stats load error:", err));

  function initCharts(stats) {
    // Chart 1: Strahler Stream Orders (Count & Length)
    const ctxStreams = document.getElementById("chartStreamOrders");
    if (ctxStreams) {
      const orders = stats.streams.orders;
      const labels = ["Order 1", "Order 2", "Order 3", "Order 4", "Order 5"];
      const lengths = [
        orders["1"] ? orders["1"].length_km : 0,
        orders["2"] ? orders["2"].length_km : 0,
        orders["3"] ? orders["3"].length_km : 0,
        orders["4"] ? orders["4"].length_km : 0,
        orders["5"] ? orders["5"].length_km : 0
      ];
      const counts = [
        orders["1"] ? orders["1"].count : 0,
        orders["2"] ? orders["2"].count : 0,
        orders["3"] ? orders["3"].count : 0,
        orders["4"] ? orders["4"].count : 0,
        orders["5"] ? orders["5"].count : 0
      ];

      new Chart(ctxStreams, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Total Length (km)",
              data: lengths.map(v => Math.round(v)),
              backgroundColor: "#0284c7",
              borderRadius: 6,
              yAxisID: "y"
            },
            {
              label: "Number of Streams",
              data: counts,
              backgroundColor: "#38bdf8",
              borderRadius: 6,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { mode: "index", intersect: false }
          },
          scales: {
            y: {
              type: "linear",
              position: "left",
              title: { display: true, text: "Length (km)" },
              grid: { color: "rgba(0,0,0,0.05)" }
            },
            y1: {
              type: "linear",
              position: "right",
              title: { display: true, text: "Stream Count" },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    // Chart 2: Geological Formations Area Breakdown
    const ctxGeology = document.getElementById("chartGeology");
    if (ctxGeology) {
      const forms = stats.geology.formations;
      const sorted = Object.entries(forms).sort((a, b) => b[1].area_sqkm - a[1].area_sqkm);
      const topForms = sorted.slice(0, 6);
      const otherArea = sorted.slice(6).reduce((sum, item) => sum + item[1].area_sqkm, 0);

      const labels = topForms.map(i => i[0]);
      const dataVals = topForms.map(i => Math.round(i[1].area_sqkm));
      if (otherArea > 0) {
        labels.push("Other Formations");
        dataVals.push(Math.round(otherArea));
      }

      new Chart(ctxGeology, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [{
            data: dataVals,
            backgroundColor: [
              "#d4b483",
              "#c29b62",
              "#b28247",
              "#c84b31",
              "#ffd56b",
              "#e8a87c",
              "#94a3b8"
            ],
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw;
                  const pct = ((val / stats.geology.total_area_sqkm) * 100).toFixed(1);
                  return ` ${ctx.label}: ${val} km² (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Chart 3: Major Reservoirs Comparison
    const ctxReservoirs = document.getElementById("chartReservoirs");
    if (ctxReservoirs) {
      const damItems = [
        { name: "Malampuzha", cap: 226.0 },
        { name: "Parambikulam", cap: 504.0 },
        { name: "Kanjirapuzha", cap: 70.8 },
        { name: "Pothundi", cap: 50.9 },
        { name: "Mangalam", cap: 25.5 },
        { name: "Siruvani", cap: 20.6 },
        { name: "Walayar", cap: 18.4 },
        { name: "Chulliyar", cap: 13.7 },
        { name: "Meenkara", cap: 11.3 }
      ];

      new Chart(ctxReservoirs, {
        type: "bar",
        data: {
          labels: damItems.map(d => d.name),
          datasets: [{
            label: "Gross Reservoir Storage (Million Cubic Metres - MCM)",
            data: damItems.map(d => d.cap),
            backgroundColor: "#0d9488",
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              title: { display: true, text: "Storage Capacity (MCM)" },
              grid: { color: "rgba(0,0,0,0.05)" }
            }
          }
        }
      });
    }

    // Chart 4: Road Infrastructure Classification
    const ctxRoads = document.getElementById("chartRoads");
    if (ctxRoads) {
      const rClasses = stats.roads.classes;
      const rLabels = Object.keys(rClasses);
      const rLengths = Object.values(rClasses).map(v => Math.round(v.length_km));

      new Chart(ctxRoads, {
        type: "bar",
        indexAxis: "y",
        data: {
          labels: rLabels,
          datasets: [{
            label: "Total Road Length (km)",
            data: rLengths,
            backgroundColor: "#475569",
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              title: { display: true, text: "Length (km)" },
              grid: { color: "rgba(0,0,0,0.05)" }
            }
          }
        }
      });
    }
  }

  // 8. Spatial Database Tables Population
  function populateDamsTable(features) {
    const tbody = document.getElementById("damsTableBody");
    if (!tbody) return;
    tbody.innerHTML = features.map((f, i) => {
      const p = f.properties;
      const coords = f.geometry.coordinates;
      return `
        <tr>
          <td><b>${i + 1}</b></td>
          <td><b>${p.name1 || "N/A"}</b></td>
          <td>${p.tributary || "Bharathapuzha"}</td>
          <td>${p.dam_type || "Masonry / Earth"}</td>
          <td><span class="chart-badge">${p.capacity || "N/A"}</span></td>
          <td>${p.year || "N/A"}</td>
          <td>${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E</td>
          <td>
            ${p.photo_url ? `<a href="${p.photo_url}" target="_blank" class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem"><i class="fa-solid fa-image"></i> View</a>` : '<span style="color:#94a3b8">None</span>'}
          </td>
        </tr>
      `;
    }).join("");
  }

  function populateDatabaseTables(stats) {
    // Geology table
    const geoTbody = document.getElementById("geologyTableBody");
    if (geoTbody) {
      const forms = stats.geology.formations;
      geoTbody.innerHTML = Object.entries(forms).map(([name, val], i) => `
        <tr>
          <td><b>${i + 1}</b></td>
          <td><b>${name}</b></td>
          <td>${val.group}</td>
          <td>${val.count}</td>
          <td>${val.area_sqkm.toFixed(2)} km²</td>
          <td>${((val.area_sqkm / stats.geology.total_area_sqkm) * 100).toFixed(2)}%</td>
        </tr>
      `).join("");
    }

    // Streams table
    const streamTbody = document.getElementById("streamsTableBody");
    if (streamTbody) {
      const orders = stats.streams.orders;
      streamTbody.innerHTML = Object.entries(orders).map(([ord, val]) => `
        <tr>
          <td><b>${ord === "0" ? "Mainstem / 0" : "Order " + ord}</b></td>
          <td>${val.count.toLocaleString()}</td>
          <td>${val.length_km.toFixed(2)} km</td>
          <td>${((val.length_km / stats.streams.total_stream_length_km) * 100).toFixed(2)}%</td>
          <td>${(val.length_km / val.count).toFixed(2)} km</td>
        </tr>
      `).join("");
    }
  }

  // Database Tab Switching
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", function () {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.style.display = "none");
      this.classList.add("active");
      const target = document.getElementById(this.getAttribute("data-tab"));
      if (target) target.style.display = "block";
    });
  });

  // Table Search Filter
  const tableSearchInput = document.getElementById("tableSearchInput");
  if (tableSearchInput) {
    tableSearchInput.addEventListener("input", function () {
      const q = this.value.toLowerCase();
      document.querySelectorAll(".gis-table tbody tr").forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? "" : "none";
      });
    });
  }

  // 9. Map Gallery Lightbox
  const lightboxModal = document.getElementById("lightboxModal");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");

  document.querySelectorAll(".open-lightbox").forEach(btn => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const imgUrl = this.getAttribute("data-img");
      const caption = this.getAttribute("data-caption");
      if (lightboxModal && lightboxImg) {
        lightboxImg.src = imgUrl;
        if (lightboxCaption) lightboxCaption.textContent = caption;
        lightboxModal.classList.add("active");
      }
    });
  });

  if (lightboxClose && lightboxModal) {
    lightboxClose.addEventListener("click", () => {
      lightboxModal.classList.remove("active");
    });
    lightboxModal.addEventListener("click", (e) => {
      if (e.target === lightboxModal) lightboxModal.classList.remove("active");
    });
  }

  // 10. GeoJSON Download Buttons
  document.querySelectorAll(".btn-download-geojson").forEach(btn => {
    btn.addEventListener("click", function () {
      const file = this.getAttribute("data-file");
      if (!file) return;
      const link = document.createElement("a");
      link.href = "data/" + file;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
});
