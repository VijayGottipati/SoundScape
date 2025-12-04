
const HIT_POPULARITY_THRESHOLD = 70;


function csvPath(relativePath) {
  return window.location.pathname.includes('/web/') ? relativePath : relativePath.replace('../', '');
}

function parseYearFromDate(str) {
  const match = String(str).match(/(\d{4})/);
  return match ? +match[1] : NaN;
}


const tooltip = d3.select("body").append("div")
  .attr("id", "tooltip")
  .style("position", "absolute")
  .style("z-index", "10000")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("transition", "opacity 0.1s")
  .style("background-color", "rgba(17, 24, 39, 0.98)")
  .style("border", "1px solid #4b5563")
  .style("padding", "0.75rem")
  .style("border-radius", "0.5rem")
  .style("font-size", "0.875rem")
  .style("color", "#f3f4f6")
  .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.5)");

function onMouseOver() {
  tooltip.style("opacity", 1);
}

function onMouseOut() {
  tooltip.style("opacity", 0);
}

function onMouseMove(event, html) {
  tooltip
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 10) + "px")
    .html(html);
}

let rawDataCache = null;
async function loadRawData() {
  if (rawDataCache) return rawDataCache;
  rawDataCache = await d3.csv(csvPath("../spotify_songs.csv"), d3.autoType).then(rows => {
    rows.forEach(r => {
      r.playlist_genre = (r.playlist_genre || '').toLowerCase();
      r._year = parseYearFromDate(r.track_album_release_date || r.album_release_date || r.release_date || r.year || '');
      r.track_popularity = r.track_popularity === undefined ? NaN : Number(r.track_popularity);
    });
    return rows;
  });
  return rawDataCache;
}

function applyFiltersToRaw(rows) {
  return rows.filter(r => {
    if (filters.genres && filters.genres.length) {
      const want = filters.genres.map(x => String(x).toLowerCase());
      if (!want.includes(String(r.playlist_genre || '').toLowerCase())) return false;
    }
    if (filters.subgenres && filters.subgenres.length) {
      const want = filters.subgenres.map(x => String(x).trim());
      if (!want.includes(String(r.playlist_subgenre || '').trim())) return false;
    }
    if (filters.yearRange && filters.yearRange.length === 2) {
      const yr = r._year;
      if (!Number.isFinite(yr) || yr < filters.yearRange[0] || yr > filters.yearRange[1]) return false;
    }
    if (filters.hit) {
      const isHit = (Number.isFinite(+r.track_popularity) && +r.track_popularity >= HIT_POPULARITY_THRESHOLD) ? 'Hit' : 'Non-Hit';
      if (isHit !== filters.hit) return false;
    }
    return true;
  });
}

function mean(values) { if (!values || !values.length) return NaN; return values.reduce((a, b) => a + b, 0) / values.length; }
function stddev(values) { if (!values || values.length === 0) return NaN; const m = mean(values); return Math.sqrt(values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length); }
function pearson(x, y) { if (!x.length || !y.length) return NaN; const n = Math.min(x.length, y.length); const ax = mean(x.slice(0, n)); const ay = mean(y.slice(0, n)); let num = 0, denx = 0, deny = 0; for (let i = 0; i < n; i++) { const dx = x[i] - ax, dy = y[i] - ay; num += dx * dy; denx += dx * dx; deny += dy * dy; } const denom = Math.sqrt(denx * deny); return denom === 0 ? 0 : num / denom; }


const filters = {
  genres: null,
  subgenres: null,
  yearRange: null,
  hit: null
};


function setFilter(key, value) {
  filters[key] = value;
  renderActiveFilters();

  drawAllCharts();
}

function clearFilters() {
  filters.genres = null;
  filters.subgenres = null;
  filters.yearRange = null;
  filters.hit = null;
  renderActiveFilters();
  drawAllCharts();
}


document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('reset-filters');
  if (btn) btn.addEventListener('click', clearFilters);
});


function genreMatchesFilter(g) {
  if (!filters.genres || !filters.genres.length) return true;
  const want = filters.genres.map(x => String(x).toLowerCase());
  return want.includes(String(g).toLowerCase());
}

function toggleGenreFilter(g) {
  const lower = String(g).toLowerCase();
  if (!filters.genres) {
    setFilter('genres', [lower]);
    return;
  }
  const cur = filters.genres.map(x => String(x).toLowerCase());
  if (cur.includes(lower)) {

    const next = cur.filter(x => x !== lower);
    setFilter('genres', next.length ? next : null);
  } else {
    setFilter('genres', Array.from(new Set([...cur, lower])));
  }
}

function toggleSubgenreFilter(subgenre) {
  const trimmed = String(subgenre).trim();
  if (!filters.subgenres) {
    setFilter('subgenres', [trimmed]);
    return;
  }
  const cur = filters.subgenres.map(x => String(x).trim());
  if (cur.includes(trimmed)) {

    const next = cur.filter(x => x !== trimmed);
    setFilter('subgenres', next.length ? next : null);
  } else {
    setFilter('subgenres', Array.from(new Set([...cur, trimmed])));
  }
}


function rowPassesFilters(r) {
  if (!r) return false;
  if (filters.genres && filters.genres.length) {
    const want = filters.genres.map(x => String(x).toLowerCase());
    if (!want.includes(String(r.playlist_genre || '').toLowerCase())) return false;
  }
  if (filters.yearRange && filters.yearRange.length === 2) {
    const yr = (() => {
      const s = r.track_album_release_date || r.album_release_date || r.release_date || r.year || '';
      const m = String(s).match(/(\d{4})/); return m ? +m[1] : NaN;
    })();
    if (!Number.isFinite(yr) || yr < filters.yearRange[0] || yr > filters.yearRange[1]) return false;
  }
  if (filters.hit) {
    const pop = Number(r.track_popularity);
    const isHit = (Number.isFinite(pop) && pop >= 70) ? 'Hit' : 'Non-Hit';
    if (isHit !== filters.hit) return false;
  }
  return true;
}


const modernKeywords = ['pop', 'edm', 'electronic', 'hip', 'hip-hop', 'hiphop', 'rap', 'r&b', 'dance', 'indie', 'synth', 'kpop', 'k-pop', 'latin', 'reggaeton', 'afrobeats'];
const traditionalKeywords = ['classical', 'folk', 'jazz', 'blues', 'country', 'opera', 'traditional', 'world', 'religious', 'gospel'];
function mapGenreToType(genre) {
  if (!genre) return 'Modern';
  const g = String(genre).toLowerCase();
  for (const kw of traditionalKeywords) if (g.includes(kw)) return 'Traditional';
  for (const kw of modernKeywords) if (g.includes(kw)) return 'Modern';
  return 'Modern';
}


function renderActiveFilters() {
  const el = document.getElementById('filters-list');
  if (!el) return;
  el.innerHTML = '';
  if (filters.genres && filters.genres.length) {
    filters.genres.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'bg-indigo-600 text-white text-xs px-2 py-1 rounded mr-2';
      btn.textContent = g;
      btn.onclick = () => {
        const cur = filters.genres.map(x => String(x).toLowerCase());
        const next = cur.filter(x => x !== String(g).toLowerCase());
        setFilter('genres', next.length ? next : null);
      };
      el.appendChild(btn);
    });
  }
  if (filters.subgenres && filters.subgenres.length) {
    filters.subgenres.forEach(sg => {
      const btn = document.createElement('button');
      btn.className = 'bg-purple-600 text-white text-xs px-2 py-1 rounded mr-2';
      btn.textContent = `📀 ${sg}`;
      btn.onclick = () => {
        const cur = filters.subgenres.map(x => String(x).trim());
        const next = cur.filter(x => x !== String(sg).trim());
        setFilter('subgenres', next.length ? next : null);
      };
      el.appendChild(btn);
    });
  }
  if (filters.yearRange) {
    const yr = document.createElement('button');
    yr.className = 'bg-yellow-500 text-black text-xs px-2 py-1 rounded mr-2';
    yr.textContent = `${filters.yearRange[0]}–${filters.yearRange[1]}`;
    yr.onclick = () => setFilter('yearRange', null);
    el.appendChild(yr);
  }
  if (filters.hit) {
    const h = document.createElement('button');
    h.className = 'bg-green-600 text-white text-xs px-2 py-1 rounded mr-2';
    h.textContent = filters.hit;
    h.onclick = () => setFilter('hit', null);
    el.appendChild(h);
  }
  if (!filters.genres && !filters.subgenres && !filters.yearRange && !filters.hit) el.innerHTML = '<span class="text-gray-400">(none)</span>';
}


async function updateChartCounts() {
  const el = document.getElementById('chart-counts');
  if (!el) return;
  try {
    const raw = await d3.csv(csvPath("../spotify_songs.csv"), d3.autoType);
    const filtered = raw.filter(rowPassesFilters);
    const total = raw.length;
    const q2focus = ['edm', 'latin', 'pop', 'r&b', 'rap', 'rock'];
    const q2pts = filtered.filter(d => q2focus.includes((d.playlist_genre || '').toLowerCase())).length;
    const q4Modern = filtered.filter(d => mapGenreToType(d.playlist_genre) === 'Modern').length;
    const q4Trad = filtered.filter(d => mapGenreToType(d.playlist_genre) === 'Traditional').length;
    const q6rows = filtered.filter(d => ['energy', 'danceability', 'valence', 'tempo', 'acousticness'].every(f => Number.isFinite(+d[f]))).length;
    el.textContent = `Tracks: ${filtered.length}/${total} · Q2 pts: ${q2pts} · Q4 M/T: ${q4Modern}/${q4Trad} · Q6 rows: ${q6rows}`;
  } catch (e) {
    el.textContent = 'Counts: —';
  }
}


async function drawChart1() {
  const selector = "#chart1";
  try {

    const raw = await loadRawData();




    const filtered = raw.filter(r => {
      if (filters.yearRange && filters.yearRange.length === 2) {
        const yr = r._year;
        if (!Number.isFinite(yr) || yr < filters.yearRange[0] || yr > filters.yearRange[1]) return false;
      }
      if (filters.hit) {
        const isHit = (Number.isFinite(+r.track_popularity) && +r.track_popularity >= HIT_POPULARITY_THRESHOLD) ? 'Hit' : 'Non-Hit';
        if (isHit !== filters.hit) return false;
      }
      return true;
    });


    const rolled = d3.rollups(filtered, v => ({ track_count: v.length, avg_popularity: mean(v.map(d => Number.isFinite(+d.track_popularity) ? +d.track_popularity : 0)) }), d => d.playlist_genre);
    let data = rolled.map(([playlist_genre, vals]) => ({ playlist_genre, track_count: vals.track_count, avg_popularity: vals.avg_popularity || 0 }));
    data.sort((a, b) => b.track_count - a.track_count);


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 30, right: 60, bottom: 60, left: 70 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleBand()
      .domain(data.map(d => d.playlist_genre))
      .range([0, width])
      .padding(0.2);

    const y0 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.track_count)])
      .range([height, 0]);

    const y1 = d3.scaleLinear()
      .domain([d3.min(data, d => d.avg_popularity) - 5, d3.max(data, d => d.avg_popularity) + 5])
      .range([height, 0]);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr("class", "axis");

    svg.append("g")
      .call(d3.axisLeft(y0))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Track Count");

    svg.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(y1))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", margin.right - 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Avg. Popularity");


    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.playlist_genre))
      .attr("y", d => y0(d.track_count))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y0(d.track_count))
      .attr("fill", "#2dd4bf")
      .attr("opacity", d => genreMatchesFilter(d.playlist_genre) ? 0.95 : 0.18)
      .style("cursor", "pointer")
      .on("click", (event, d) => {

        toggleGenreFilter(d.playlist_genre);
      })
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);
        onMouseOver();
      })
      .on("mousemove", (event, d) => {
        const totalTracks = data.reduce((sum, item) => sum + item.track_count, 0);
        const percentage = ((d.track_count / totalTracks) * 100).toFixed(1);

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.playlist_genre.toUpperCase()}
          </div>
          <strong>Track Count:</strong> ${d.track_count.toLocaleString()} 
          <span style="color: #d1d5db;">(${percentage}%)</span><br>
          <strong>Avg. Popularity:</strong> ${d.avg_popularity.toFixed(1)} / 100<br>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #4b5563; font-size: 11px; color: #9ca3af;">
            Click to filter all charts by this genre
          </div>
        `);
      })
      .on("mouseout", function (event, d) {
        d3.select(this).attr("opacity", genreMatchesFilter(d.playlist_genre) ? 0.95 : 0.18);
        onMouseOut();
      });


    const line = d3.line()
      .x(d => x(d.playlist_genre) + x.bandwidth() / 2)
      .y(d => y1(d.avg_popularity));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#f472b6")
      .attr("stroke-width", 3)
      .attr("d", line);


    svg.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.playlist_genre) + x.bandwidth() / 2)
      .attr("cy", d => y1(d.avg_popularity))
      .attr("r", 5)
      .attr("fill", "#f472b6")
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("r", 7).attr("stroke-width", 3);
        onMouseOver();
      })
      .on("mousemove", (event, d) => {
        const totalTracks = data.reduce((sum, item) => sum + item.track_count, 0);
        const percentage = ((d.track_count / totalTracks) * 100).toFixed(1);
        const maxPop = d3.max(data, item => item.avg_popularity);
        const minPop = d3.min(data, item => item.avg_popularity);
        const popRank = data.filter(item => item.avg_popularity >= d.avg_popularity).length;

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.playlist_genre.toUpperCase()}
          </div>
          <strong>Avg. Popularity:</strong> ${d.avg_popularity.toFixed(1)} / 100<br>
          <strong>Popularity Rank:</strong> #${popRank} of ${data.length}<br>
          <strong>Track Count:</strong> ${d.track_count.toLocaleString()} 
          <span style="color: #d1d5db;">(${percentage}%)</span><br>
          <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
            ${d.avg_popularity === maxPop ? 'Highest popularity!' :
            d.avg_popularity === minPop ? 'Lowest popularity' :
              d.avg_popularity > 60 ? 'High popularity' :
                d.avg_popularity > 45 ? 'Moderate popularity' : 'Lower popularity'}
          </div>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 5).attr("stroke-width", 2);
        onMouseOut();
      });

  } catch (error) {
    console.error("Error drawing Chart 1:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}



async function drawChart2() {
  const selector = "#chart2";
  try {

    const raw = await d3.csv(csvPath("../spotify_songs.csv"), d3.autoType);

    const data = raw.map(d => ({
      playlist_genre: (d.playlist_genre || '').toLowerCase(),
      danceability: +d.danceability,
      energy: +d.energy,
      track_name: d.track_name,
      track_artist: d.track_artist,
      track_popularity: +d.track_popularity
    })).filter(d => d.playlist_genre && Number.isFinite(d.danceability) && Number.isFinite(d.energy));


    const focusGenres = ['edm', 'latin', 'pop', 'r&b', 'rap', 'rock'];
    const filtered = data.filter(d => focusGenres.includes(d.playlist_genre));


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 30, right: 140, bottom: 60, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleLinear().domain([0, 1]).range([0, width]).nice();
    const y = d3.scaleLinear().domain([0, 1]).range([height, 0]).nice();


    const color = d3.scaleOrdinal()
      .domain(focusGenres)
      .range(['#60a5fa', '#f472b6', '#34d399', '#f59e0b', '#f97316', '#c084fc']);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("y", 40)
      .attr("x", width / 2)
      .attr("text-anchor", "middle")
      .text("Danceability");

    svg.append("g")
      .call(d3.axisLeft(y))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Energy");


    const pointsG = svg.append("g").attr('class', 'points');

    pointsG.selectAll("circle")
      .data(filtered)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.danceability))
      .attr("cy", d => y(d.energy))
      .attr("r", 3)
      .attr("fill", d => color(d.playlist_genre))
      .attr("opacity", d => (filters.genres && filters.genres.length) ? (filters.genres.map(x => x.toLowerCase()).includes(d.playlist_genre.toLowerCase()) ? 0.9 : 0.06) : 0.45)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("r", 5).attr("opacity", 1);
        onMouseOver();
        onMouseMove(event, `
          <div style="font-size: 13px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.track_name || 'Unknown'}
          </div>
          <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
            by ${d.track_artist || 'Unknown Artist'}
          </div>
          <strong>Genre:</strong> ${d.playlist_genre.toUpperCase()}<br>
          <strong>Energy:</strong> ${(d.energy * 100).toFixed(1)}%<br>
          <strong>Danceability:</strong> ${(d.danceability * 100).toFixed(1)}%<br>
          <strong>Popularity:</strong> ${d.track_popularity || 0} / 100
        `);
      })
      .on("mouseout", function (event, d) {
        d3.select(this).attr("r", 3).attr("opacity", (filters.genres && filters.genres.length) ? (filters.genres.map(x => x.toLowerCase()).includes(d.playlist_genre.toLowerCase()) ? 0.9 : 0.06) : 0.45);
        onMouseOut();
      });


    const legend = svg.append("g")
      .attr("transform", `translate(${width + 20}, 10)`);

    focusGenres.forEach((g, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
      row.append("rect").attr("width", 14).attr("height", 14).attr("fill", color(g));
      row.append("text").attr("x", 20).attr("y", 12).attr("fill", "#d1d5db").text(g.toUpperCase());
    });


    svg.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat("")).selectAll("line").attr("class", "grid-line");

  } catch (error) {
    console.error("Error drawing Chart 2:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawChart3() {
  const selector = "#chart3";
  try {

    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw).filter(d => Number.isFinite(+d.track_popularity));


    const features = ['valence', 'tempo', 'energy', 'danceability', 'acousticness', 'instrumentalness'];
    const rows = features.map(f => {
      const xs = filtered.map(r => +r[f]).filter(v => Number.isFinite(v));
      const ys = filtered.map(r => +r.track_popularity).slice(0, xs.length).filter(v => Number.isFinite(v));

      const alignedX = [];
      const alignedY = [];
      for (let i = 0; i < filtered.length; i++) {
        const xv = Number(filtered[i][f]); const yv = Number(filtered[i].track_popularity);
        if (Number.isFinite(xv) && Number.isFinite(yv)) { alignedX.push(xv); alignedY.push(yv); }
      }
      return { feature: f, correlation_with_popularity: pearson(alignedX, alignedY) };
    });

    const data = rows;


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 30, right: 30, bottom: 40, left: 120 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const y = d3.scaleBand()
      .domain(data.map(d => d.feature))
      .range([0, height])
      .padding(0.3);

    const x = d3.scaleLinear()
      .domain([d3.min(data, d => d.correlation_with_popularity) - 0.01, d3.max(data, d => d.correlation_with_popularity) + 0.01]).nice()
      .range([0, width]);


    svg.append("g")
      .call(d3.axisLeft(y))
      .attr("class", "axis")
      .selectAll("text")
      .style("text-transform", "capitalize");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => d.toFixed(3)))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("y", margin.bottom - 10)
      .attr("x", width / 2)
      .attr("text-anchor", "middle")
      .text("Correlation with Popularity");


    svg.append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#f3f4f6")
      .attr("stroke-width", 1.5);


    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.feature))
      .attr("x", d => x(Math.min(0, d.correlation_with_popularity)))
      .attr("height", y.bandwidth())
      .attr("width", d => Math.abs(x(d.correlation_with_popularity) - x(0)))
      .attr("fill", d => d.correlation_with_popularity > 0 ? "#60a5fa" : "#fb923c")
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 0.8);
        onMouseOver();
      })
      .on("mousemove", (event, d) => {
        const strength = Math.abs(d.correlation_with_popularity);
        const direction = d.correlation_with_popularity > 0 ? "Positive" : "Negative";
        const interpretation = strength > 0.3 ? "Strong" : strength > 0.15 ? "Moderate" : "Weak";

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.feature.charAt(0).toUpperCase() + d.feature.slice(1)}
          </div>
          <strong>Correlation:</strong> ${d.correlation_with_popularity.toFixed(4)}<br>
          <strong>Direction:</strong> ${direction}<br>
          <strong>Strength:</strong> ${interpretation}<br>
          <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
            ${d.correlation_with_popularity > 0 ? "Higher values → Higher popularity" : "Higher values → Lower popularity"}
          </div>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 1);
        onMouseOut();
      });

  } catch (error) {
    console.error("Error drawing Chart 3:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawChart4() {
  const selector = "#chart4";
  try {

    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);

    const byType = d3.rollups(filtered, v => ({
      acousticness_mean: mean(v.map(d => Number.isFinite(+d.acousticness) ? +d.acousticness : NaN)),
      instrumentalness_mean: mean(v.map(d => Number.isFinite(+d.instrumentalness) ? +d.instrumentalness : NaN))
    }), d => mapGenreToType(d.playlist_genre));
    const data = byType.map(([genre_type, vals]) => ({ genre_type, acousticness_mean: vals.acousticness_mean || 0, instrumentalness_mean: vals.instrumentalness_mean || 0 }));
    const subgroups = ["acousticness_mean", "instrumentalness_mean"];
    const groups = data.map(d => d.genre_type);


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 40, right: 30, bottom: 40, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x0 = d3.scaleBand()
      .domain(groups)
      .range([0, width])
      .padding(0.2);

    const x1 = d3.scaleBand()
      .domain(subgroups)
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(d.acousticness_mean, d.instrumentalness_mean))]).nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(subgroups)
      .range(["#34d399", "#a78bfa"]);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .attr("class", "axis");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2f")))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Mean Value");


    svg.append("g")
      .selectAll("g")
      .data(data)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${x0(d.genre_type)},0)`)
      .selectAll("rect")
      .data(d => subgroups.map(key => ({ key: key, value: d[key], type: d.genre_type })))
      .enter()
      .append("rect")
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", d => height - y(d.value))
      .attr("fill", d => color(d.key))
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 0.8);
        onMouseOver();
      })
      .on("mousemove", (event, d) => {
        const featureName = d.key.split('_')[0];
        const percentage = (d.value * 100).toFixed(1);

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.type}
          </div>
          <strong>${featureName.charAt(0).toUpperCase() + featureName.slice(1)}:</strong> ${percentage}%<br>
          <strong>Raw Value:</strong> ${d.value.toFixed(3)}<br>
          <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
            ${d.type === 'Modern' ? 'Electronic/Pop production' : 'Traditional instrumentation'}
          </div>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 1);
        onMouseOut();
      });


    const legend = svg.append("g")
      .attr("transform", `translate(${width / 2 - 120}, ${-margin.top + 10})`);

    legend.selectAll("rect")
      .data(subgroups)
      .enter()
      .append("rect")
      .attr("x", (d, i) => i * 130)
      .attr("y", 0)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => color(d));

    legend.selectAll("text")
      .data(subgroups)
      .enter()
      .append("text")
      .attr("x", (d, i) => i * 130 + 20)
      .attr("y", 12)
      .attr("fill", "#d1d5db")
      .attr("font-size", "12px")
      .text(d => d.split('_')[0] === 'acousticness' ? 'Acousticness' : 'Instrumentalness');

  } catch (error) {
    console.error("Error drawing Chart 4:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawChart5() {
  const selector = "#chart5";
  try {

    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw).map(r => ({
      year: (() => { const m = String(r.track_album_release_date || r.album_release_date || r.release_date || r.year || '').match(/(\d{4})/); return m ? +m[1] : NaN; })(),
      tempo: Number(r.tempo),
      energy: Number(r.energy)
    })).filter(d => Number.isFinite(d.year) && d.year >= 1960 && Number.isFinite(d.tempo) && Number.isFinite(d.energy));


    const agg = Array.from(d3.rollups(filtered, v => ({ avg_tempo: mean(v.map(x => x.tempo)), avg_energy: mean(v.map(x => x.energy)) }), d => d.year)).map(([year, vals]) => ({ year: +year, avg_tempo: vals.avg_tempo, avg_energy: vals.avg_energy }));
    const data = agg.sort((a, b) => a.year - b.year);


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 40, right: 60, bottom: 40, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    const yTempo = d3.scaleLinear()
      .domain([d3.min(data, d => d.avg_tempo) - 5, d3.max(data, d => d.avg_tempo) + 5])
      .range([height, 0]);

    const yEnergy = d3.scaleLinear()
      .domain([d3.min(data, d => d.avg_energy) - 0.1, d3.max(data, d => d.avg_energy) + 0.1])
      .range([height, 0]);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("y", margin.bottom - 10)
      .attr("x", width / 2)
      .attr("text-anchor", "middle")
      .text("Year");

    svg.append("g")
      .call(d3.axisLeft(yTempo))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Avg. Tempo (BPM)")
      .style("fill", "#60a5fa");

    svg.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(yEnergy))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", margin.right - 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Avg. Energy")
      .style("fill", "#f472b6");


    const lineTempo = d3.line()
      .x(d => x(d.year))
      .y(d => yTempo(d.avg_tempo));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2.5)
      .attr("d", lineTempo);

    const lineEnergy = d3.line()
      .x(d => x(d.year))
      .y(d => yEnergy(d.avg_energy));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#f472b6")
      .attr("stroke-width", 2.5)
      .attr("d", lineEnergy);


    const focus = svg.append("g")
      .attr("class", "focus")
      .style("display", "none");

    focus.append("line")
      .attr("class", "x-hover-line hover-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    const bisectDate = d3.bisector(d => d.year).left;

    svg.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); onMouseOver(); })
      .on("mouseout", () => { focus.style("display", "none"); onMouseOut(); })
      .on("mousemove", (event) => {
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        if (!d0 || !d1) return;
        const d = (x0 - d0.year) > (d1.year - x0) ? d1 : d0;
        focus.attr("transform", `translate(${x(d.year)},0)`);

        const tempoChange = i > 1 ? ((d.avg_tempo - data[i - 2].avg_tempo) / data[i - 2].avg_tempo * 100).toFixed(1) : 0;
        const energyChange = i > 1 ? ((d.avg_energy - data[i - 2].avg_energy) / data[i - 2].avg_energy * 100).toFixed(1) : 0;

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            Year ${d.year}
          </div>
          <div style="color:#d1d5db;">
            <strong>Tempo:</strong> ${d.avg_tempo.toFixed(1)} BPM
          </div>
          <div style="color:#d1d5db;">
            <strong>Energy:</strong> ${(d.avg_energy * 100).toFixed(1)}%
          </div>
        `);
      });

  } catch (error) {
    console.error("Error drawing Chart 5:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawChart6() {
  const selector = "#chart6";
  try {

    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);


    const counts = { 'Hit': 0, 'Non-Hit': 0 };
    filtered.forEach(r => {
      const pop = Number(r.track_popularity);
      const isHit = (Number.isFinite(pop) && pop >= HIT_POPULARITY_THRESHOLD) ? 'Hit' : 'Non-Hit';
      counts[isHit]++;
    });

    const data = [{ key: 'Hit', count: counts['Hit'] }, { key: 'Non-Hit', count: counts['Non-Hit'] }];


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.key))
      .range([0, width])
      .padding(0.4);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 1])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(['Hit', 'Non-Hit'])
      .range(['#10b981', '#6b7280']);


    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('class', 'axis');


    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('class', 'axis');


    const bars = svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'bar-group');

    bars.append('rect')
      .attr('x', d => x(d.key))
      .attr('y', d => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.count))
      .attr('fill', d => color(d.key))
      .attr('opacity', d => (filters.hit == null ? 0.95 : (filters.hit === d.key ? 0.98 : 0.28)))
      .on('mouseover', function () {
        d3.select(this).attr('opacity', 1);
        onMouseOver();
      })
      .on('mousemove', (event, d) => {
        const total = data.reduce((sum, item) => sum + item.count, 0);
        const percentage = ((d.count / total) * 100).toFixed(1);

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.key === 'Hit' ? 'Hit Songs' : 'Non-Hit Songs'}
          </div>
          <strong>Count:</strong> ${d.count.toLocaleString()}<br>
          <strong>Percentage:</strong> ${percentage}% of total<br>
          <strong>Threshold:</strong> ${d.key === 'Hit' ? '≥' : '<'} ${HIT_POPULARITY_THRESHOLD}<br>
        `);
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('opacity', filters.hit == null ? 0.95 : (filters.hit === d.key ? 0.98 : 0.28));
        onMouseOut();
      });


    bars.append('text')
      .attr('x', d => x(d.key) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#d1d5db')
      .text(d => d.count.toLocaleString());


    svg.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('fill', '#9ca3af')
      .attr('font-size', '12px')
      .text('Distribution of Hits vs Non-Hits');

  } catch (error) {
    console.error("Error drawing Chart 6:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawChart7() {
  const selector = "#chart7";
  try {

    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);
    const features = ['energy', 'danceability', 'valence', 'tempo', 'acousticness'];

    const byGenre = d3.rollups(filtered, v => {

      const stds = features.map(f => stddev(v.map(d => Number.isFinite(+d[f]) ? +d[f] : NaN).filter(x => Number.isFinite(x))));
      const valid = stds.filter(x => Number.isFinite(x));
      return { feature_diversity: valid.length ? mean(valid) : 0 };
    }, d => d.playlist_genre || 'Unknown');
    const data = byGenre.map(([playlist_genre, vals]) => ({ playlist_genre, feature_diversity: vals.feature_diversity || 0 }));
    data.sort((a, b) => b.feature_diversity - a.feature_diversity);


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 30, right: 30, bottom: 60, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleBand()
      .domain(data.map(d => d.playlist_genre))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.feature_diversity)]).nice()
      .range([height, 0]);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr("class", "axis");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".3f")))
      .attr("class", "axis")
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text("Feature Diversity (Avg. Std. Dev)");


    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.playlist_genre))
      .attr("y", d => y(d.feature_diversity))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.feature_diversity))
      .attr("fill", "#c084fc")
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 0.8);
        onMouseOver();
      })
      .on("mousemove", (event, d) => {
        const rank = data.findIndex(item => item.playlist_genre === d.playlist_genre) + 1;
        const interpretation = d.feature_diversity > 0.15 ? "Highly diverse" : d.feature_diversity > 0.10 ? "Moderately diverse" : "Homogeneous";

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            ${d.playlist_genre.toUpperCase()}
          </div>
          <strong>Diversity Score:</strong> ${d.feature_diversity.toFixed(4)}<br>
          <strong>Rank:</strong> #${rank} of ${data.length}<br>
          <strong>Style:</strong> ${interpretation}<br>
          <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
            ${interpretation === "Highly diverse" ? "Wide range of musical styles" :
            interpretation === "Moderately diverse" ? "Balanced variation" :
              "Consistent sound profile"}
          </div>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 1);
        onMouseOut();
      });

  } catch (error) {
    console.error("Error drawing Chart 7:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawGenrePopularityTimeline() {
  const selector = "#chart-popularity-time";
  try {
    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);


    const topGenres = ['edm', 'latin', 'pop', 'r&b', 'rap', 'rock'];

    const yearData = d3.rollups(
      filtered.filter(d => d.playlist_genre && topGenres.includes(d.playlist_genre)),
      v => ({
        popularity: mean(v.map(d => +d.track_popularity))
      }),
      d => d._year,
      d => d.playlist_genre
    );

    const timelineData = [];
    yearData.forEach(([year, genres]) => {
      genres.forEach(([genre, values]) => {
        if (Number.isFinite(year) && year >= 1960) {
          timelineData.push({
            year: +year,
            genre,
            popularity: values.popularity
          });
        }
      });
    });



    const nestedByGenre = d3.groups(timelineData, d => d.genre);
    const smoothedData = [];

    nestedByGenre.forEach(([genre, points]) => {

      points.sort((a, b) => a.year - b.year);

      points.forEach((p, i) => {

        let sum = 0;
        let count = 0;
        for (let k = -2; k <= 2; k++) {
          const neighbor = points[i + k];
          if (neighbor) {
            sum += neighbor.popularity;
            count++;
          }
        }

        smoothedData.push({
          year: p.year,
          genre: p.genre,
          popularity: sum / count,
          raw_popularity: p.popularity
        });
      });
    });



    const plotData = smoothedData;


    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 40, right: 120, bottom: 40, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleLinear()
      .domain(d3.extent(plotData, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(topGenres)
      .range(d3.schemeTableau10);


    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));


    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.popularity))
      .curve(d3.curveMonotoneX);


    const focus = svg.append("g")
      .style("display", "none");

    focus.append("line")
      .attr("class", "x-hover-line hover-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");


    const updateTooltip = (event) => {
      const [mx] = d3.pointer(event, svg.node());
      const x0 = x.invert(mx);
      const year = Math.round(x0);


      const yearData = plotData.filter(d => d.year === year);
      if (!yearData.length) return;

      focus.attr("transform", `translate(${x(year)},0)`);


      yearData.sort((a, b) => b.popularity - a.popularity);

      let tooltipHtml = `<div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 8px;">Year ${year}</div>`;


      yearData.forEach((d, i) => {
        tooltipHtml += `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span><span style="color: #f3f4f6; font-weight: bold; text-transform: uppercase;">${d.genre}</span></span>
            <span style="color: #d1d5db; margin-left: 15px;">${d.popularity.toFixed(0)}</span>
          </div>
        `;
      });

      onMouseMove(event, tooltipHtml);
    };


    svg.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); onMouseOver(); })
      .on("mouseout", () => { focus.style("display", "none"); onMouseOut(); })
      .on("mousemove", updateTooltip);


    const lines = [];
    topGenres.forEach(genre => {
      const genreData = plotData.filter(d => d.genre === genre);

      const path = svg.append("path")
        .datum(genreData)
        .attr("class", "genre-line")
        .attr("data-genre", genre)
        .attr("fill", "none")
        .attr("stroke", color(genre))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("mouseover", function (event) {

          svg.selectAll(".genre-line").attr("opacity", 0.2).attr("stroke-width", 1.5);

          d3.select(this).attr("opacity", 1).attr("stroke-width", 3.5);


          focus.style("display", null);
          onMouseOver();
          updateTooltip(event);
        })
        .on("mousemove", updateTooltip)
        .on("mouseout", function () {

          svg.selectAll(".genre-line").attr("opacity", 0.7).attr("stroke-width", 1.5);


          focus.style("display", "none");
          onMouseOut();
        });

      lines.push(path);
    });


    const legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "start")
      .selectAll("g")
      .data(topGenres)
      .enter().append("g")
      .attr("transform", (d, i) => `translate(${width + 10},${i * 20})`)
      .style("cursor", "pointer")
      .on("mouseover", function (event, genre) {

        svg.selectAll(".genre-line").attr("opacity", 0.2).attr("stroke-width", 1.5);

        svg.select(`.genre-line[data-genre="${genre}"]`).attr("opacity", 1).attr("stroke-width", 3.5);

        d3.select(this).select("text").attr("font-weight", "bold");
      })
      .on("mouseout", function () {

        svg.selectAll(".genre-line").attr("opacity", 0.7).attr("stroke-width", 1.5);

        d3.select(this).select("text").attr("font-weight", "normal");
      });

    legend.append("rect")
      .attr("x", 0)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", color);

    legend.append("text")
      .attr("x", 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(d => d.toUpperCase())
      .attr("fill", "#f3f4f6");

  } catch (error) {
    console.error("Error drawing genre popularity timeline:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}

async function drawGenreCorrelationMatrix() {
  const selector = "#chart-correlation-matrix";
  try {
    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);

    const features = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness'];


    const matrix = [];
    features.forEach(f1 => {
      const row = [];
      features.forEach(f2 => {
        const values1 = filtered.map(d => +d[f1]).filter(v => Number.isFinite(v));
        const values2 = filtered.map(d => +d[f2]).filter(v => Number.isFinite(v));
        row.push(pearson(values1, values2));
      });
      matrix.push(row);
    });

    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();


    const legendWidth = 200;
    const legendHeight = 20;
    const legendTitleHeight = 20;
    const legendAxisHeight = 25;
    const legendTotalHeight = legendTitleHeight + legendHeight + legendAxisHeight + 10;


    const margin = { top: legendTotalHeight, right: 40, bottom: 80, left: 100 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);


    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
      .attr("id", "correlation-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");


    const stops = [
      { offset: "0%", color: d3.interpolateRdBu(0) },
      { offset: "50%", color: d3.interpolateRdBu(0.5) },
      { offset: "100%", color: d3.interpolateRdBu(1) }
    ];

    stops.forEach(stop => {
      linearGradient.append("stop")
        .attr("offset", stop.offset)
        .attr("stop-color", stop.color);
    });


    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(features)
      .padding(0.01);

    const y = d3.scaleBand()
      .range([height, 0])
      .domain(features)
      .padding(0.01);

    const colorScale = d3.scaleSequential()
      .interpolator(d3.interpolateRdBu)
      .domain([-1, 1]);


    chart.selectAll()
      .data(matrix.flatMap((row, i) => row.map((value, j) => ({ i, j, value }))))
      .enter()
      .append("rect")
      .attr("x", d => x(features[d.j]))
      .attr("y", d => y(features[d.i]))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", d => colorScale(d.value))
      .on("mouseover", function () {
        d3.select(this).style("stroke", "white").style("stroke-width", 2);
        onMouseOver();
      })
      .on("mousemove", function (event, d) {
        const strength = Math.abs(d.value);
        const direction = d.value > 0 ? "Positive" : "Negative";
        const interpretation = strength > 0.7 ? "Very Strong" : strength > 0.5 ? "Strong" : strength > 0.3 ? "Moderate" : "Weak";

        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            Correlation
          </div>
          <div style="margin-bottom: 4px;">
            <strong>${features[d.i]}</strong> vs <strong>${features[d.j]}</strong>
          </div>
          <strong>Coefficient:</strong> ${d.value.toFixed(3)}<br>
          <strong>Strength:</strong> ${interpretation} ${direction}<br>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).style("stroke", "none");
        onMouseOut();
      });


    chart.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("text-anchor", "end");

    chart.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");



    const legendX = margin.left + width / 2 - legendWidth / 2;
    const legendY = 10;


    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);


    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .style("fill", "#f3f4f6")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text("Correlation");


    legend.append("rect")
      .attr("x", 0)
      .attr("y", legendTitleHeight)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#correlation-gradient)")
      .style("stroke", "#4b5563")
      .style("stroke-width", 1);


    const scale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(scale)
      .ticks(5)
      .tickFormat(d3.format(".1f"));

    const axisGroup = legend.append("g")
      .attr("transform", `translate(0, ${legendTitleHeight + legendHeight})`)
      .call(legendAxis)
      .attr("class", "axis");

    axisGroup.selectAll("text")
      .style("fill", "#d1d5db")
      .style("font-size", "10px");

    axisGroup.selectAll("line")
      .style("stroke", "#4b5563");

    axisGroup.selectAll("path")
      .style("stroke", "#4b5563");

  } catch (error) {
    console.error("Error drawing correlation matrix:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}

async function drawFeatureImportance() {
  const selector = "#chart-feature-importance";
  try {
    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);

    const features = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'loudness', 'speechiness'];
    const importance = features.map(feature => {
      const values = filtered.map(d => +d[feature]).filter(v => Number.isFinite(v));
      const popularity = filtered.map(d => +d.track_popularity).filter(v => Number.isFinite(v));
      return {
        feature,
        importance: Math.abs(pearson(values, popularity))
      };
    });

    importance.sort((a, b) => b.importance - a.importance);

    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 40, right: 40, bottom: 40, left: 160 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
      .range([0, height])
      .domain(importance.map(d => d.feature))
      .padding(0.1);

    const x = d3.scaleLinear()
      .domain([0, d3.max(importance, d => d.importance)])
      .nice()
      .range([0, width]);


    svg.selectAll("rect")
      .data(importance)
      .enter()
      .append("rect")
      .attr("y", d => y(d.feature))
      .attr("x", 0)
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.importance))
      .attr("fill", "#60a5fa")
      .on("mouseover", function () {
        d3.select(this).attr("fill", "#93c5fd");
        onMouseOver();
      })
      .on("mousemove", function (event, d) {
        onMouseMove(event, `
          <div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">
            Feature Importance
          </div>
          <div style="font-size: 16px; font-weight: bold; color: #f3f4f6; margin-bottom: 4px;">
            ${d.feature.charAt(0).toUpperCase() + d.feature.slice(1)}
          </div>
          <strong>Importance Score:</strong> ${d.importance.toFixed(3)}<br>
          <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
            Based on correlation with popularity
          </div>
        `);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#60a5fa");
        onMouseOut();
      });


    svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("text-anchor", "end");

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

  } catch (error) {
    console.error("Error drawing feature importance:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}

async function drawGenreEvolution() {
  const selector = "#chart-genre-evolution";
  try {
    const raw = await loadRawData();
    const filtered = applyFiltersToRaw(raw);

    const features = ['energy', 'danceability', 'valence'];
    const yearlyAverages = d3.rollups(
      filtered,
      v => ({
        energy: mean(v.map(d => +d.energy)),
        danceability: mean(v.map(d => +d.danceability)),
        valence: mean(v.map(d => +d.valence))
      }),
      d => d._year
    ).map(([year, values]) => ({
      year: +year,
      ...values
    })).filter(d => d.year >= 1960 && d.year <= 2023)
      .sort((a, b) => a.year - b.year);

    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 40, right: 120, bottom: 40, left: 60 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const x = d3.scaleLinear()
      .domain(d3.extent(yearlyAverages, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(features)
      .range(['#60a5fa', '#34d399', '#f472b6']);


    features.forEach(feature => {
      const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d[feature]))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(yearlyAverages)
        .attr("fill", "none")
        .attr("stroke", color(feature))
        .attr("stroke-width", 2)
        .attr("d", line);
    });


    const focus = svg.append("g")
      .style("display", "none");

    focus.append("line")
      .attr("class", "x-hover-line hover-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    const bisectYear = d3.bisector(d => d.year).left;

    svg.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); onMouseOver(); })
      .on("mouseout", () => { focus.style("display", "none"); onMouseOut(); })
      .on("mousemove", (event) => {
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectYear(yearlyAverages, x0, 1);
        const d0 = yearlyAverages[i - 1];
        const d1 = yearlyAverages[i];
        if (!d0 || !d1) return;
        const d = (x0 - d0.year) > (d1.year - x0) ? d1 : d0;

        focus.attr("transform", `translate(${x(d.year)},0)`);

        let tooltipHtml = `<div style="font-size: 14px; font-weight: bold; color: #f3f4f6; margin-bottom: 8px; border-bottom: 1px solid #4b5563; padding-bottom: 4px;">Year ${d.year}</div>`;

        features.forEach(f => {
          tooltipHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="color: #f3f4f6; font-weight: bold; margin-right: 10px;">${f.charAt(0).toUpperCase() + f.slice(1)}</span>
              <span style="color: #d1d5db;">${d[f].toFixed(3)}</span>
            </div>
          `;
        });

        onMouseMove(event, tooltipHtml);
      });


    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));


    const legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "start")
      .selectAll("g")
      .data(features)
      .enter().append("g")
      .attr("transform", (d, i) => `translate(${width + 10},${i * 20})`);

    legend.append("rect")
      .attr("x", 0)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", color);

    legend.append("text")
      .attr("x", 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(d => d)
      .attr("fill", "#f3f4f6");

  } catch (error) {
    console.error("Error drawing genre evolution:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}

async function drawSubgenreTree() {
  const selector = "#chart-subgenre-tree";
  try {
    const raw = await loadRawData();



    const filtered = raw.filter(r => {
      if (filters.genres && filters.genres.length) {
        const want = filters.genres.map(x => String(x).toLowerCase());
        if (!want.includes(String(r.playlist_genre || '').toLowerCase())) return false;
      }

      if (filters.yearRange && filters.yearRange.length === 2) {
        const yr = r._year;
        if (!Number.isFinite(yr) || yr < filters.yearRange[0] || yr > filters.yearRange[1]) return false;
      }
      if (filters.hit) {
        const isHit = (Number.isFinite(+r.track_popularity) && +r.track_popularity >= HIT_POPULARITY_THRESHOLD) ? 'Hit' : 'Non-Hit';
        if (isHit !== filters.hit) return false;
      }
      return true;
    });


    const totalTracks = filtered.length;



    const genreSubgenreData = d3.rollups(
      filtered,
      v => {
        const count = v.length;
        const popularities = v.map(d => {
          const pop = Number(d.track_popularity);
          return Number.isFinite(pop) ? pop : 0;
        }).filter(p => p > 0);
        const avgPopularity = popularities.length > 0 ? mean(popularities) : 0;

        return {
          count: count,
          avgPopularity: avgPopularity
        };
      },
      d => (d.playlist_genre || 'Unknown').toLowerCase(),
      d => {
        const sub = (d.playlist_subgenre || '').trim();
        return sub ? sub : 'Unknown';
      }
    );


    const hierarchyData = {
      name: "Genres",
      children: genreSubgenreData.map(([genre, subgenres]) => {
        const subgenreChildren = Array.from(subgenres, ([subgenreName, stats]) => ({
          name: subgenreName,
          value: stats.count,
          avgPopularity: stats.avgPopularity
        })).filter(d => d.value > 0);

        return {
          name: genre,
          children: subgenreChildren,
          value: subgenreChildren.reduce((sum, d) => sum + d.value, 0)
        };
      }).filter(d => d.children.length > 0)
    };

    const container = d3.select(selector);
    container.html("");
    const bounds = container.node().getBoundingClientRect();
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;
    const size = Math.min(width, height);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left + (width - size) / 2},${margin.top + (height - size) / 2})`);

    const root = d3.hierarchy(hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    const pack = d3.pack()
      .size([size, size])
      .padding(3);

    const nodes = pack(root).descendants();

    const color = d3.scaleOrdinal(d3.schemeTableau10);


    const node = svg.selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x},${d.y})`);


    node.append("circle")
      .attr("r", d => d.r)
      .style("fill", d => {
        if (d.depth === 0) return 'none';
        if (d.children) {

          return color(d.data.name);
        } else {

          try {
            const parentColor = color(d.parent.data.name);
            const baseColor = d3.color(parentColor);
            if (baseColor) {
              return baseColor.brighter(0.8).toString();
            }
          } catch (e) {

          }
          return '#a78bfa';
        }
      })
      .style("fill-opacity", d => {
        if (d.depth === 0) return 0;


        const isSubgenre = d.depth === 2;
        const isGenre = d.depth === 1;

        if (filters.subgenres && filters.subgenres.length && isSubgenre) {
          const subgenreName = d.data.name;
          const isActive = filters.subgenres.some(s => String(s).trim() === String(subgenreName).trim());
          return isActive ? 0.95 : 0.25;
        }

        if (filters.genres && filters.genres.length) {
          const genreName = isGenre ? d.data.name : (isSubgenre ? d.parent.data.name : null);
          if (genreName) {
            const isActive = filters.genres.some(g => String(g).toLowerCase() === String(genreName).toLowerCase());
            return isActive ? 0.95 : 0.25;
          }
        }

        return 0.7;
      })
      .attr("stroke", d => {
        if (d.depth === 1) return "#6b7280";
        if (d.depth === 2) return "#9ca3af";
        return "none";
      })
      .attr("stroke-width", d => d.depth === 1 ? 1.5 : d.depth === 2 ? 1 : 0)
      .style("opacity", 0.8)
      .style("cursor", "default")
      .on("mouseover", function (event, d) {
        if (d.depth === 0) return;
        d3.select(this)
          .style("opacity", 1)
          .style("stroke-width", d => d.depth === 1 ? 2.5 : 2)
          .style("stroke", "#fbbf24");


        const isSubgenre = d.depth === 2;
        const genreName = isSubgenre ? d.parent.data.name : d.data.name;
        const subgenreName = isSubgenre ? d.data.name : null;
        const trackCount = d.value || 0;
        const percentage = totalTracks > 0 ? ((trackCount / totalTracks) * 100).toFixed(2) : 0;
        const avgPopularity = d.data.avgPopularity !== undefined && Number.isFinite(d.data.avgPopularity)
          ? d.data.avgPopularity
          : 0;

        let tooltipHtml = '';

        if (isSubgenre && subgenreName && subgenreName !== 'Unknown') {
          tooltipHtml += `<div style="font-size: 16px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">${subgenreName}</div>`;
          tooltipHtml += `<strong>Genre:</strong> ${String(genreName).toUpperCase()}`;
          tooltipHtml += `<br><em style="color: #9ca3af; font-size: 11px;">${subgenreName}</em>`;
        } else {
          tooltipHtml += `<div style="font-size: 16px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">${String(genreName).toUpperCase()}</div>`;
        }

        tooltipHtml += `<br><strong>Tracks:</strong> ${trackCount.toLocaleString()}`;

        if (totalTracks > 0) {
          tooltipHtml += ` <span style="color: #9ca3af;">(${percentage}%)</span>`;
        }

        if (avgPopularity > 0) {
          tooltipHtml += `<br><strong>Avg. Popularity:</strong> ${avgPopularity.toFixed(1)}`;
        }

        onMouseOver();
        onMouseMove(event, tooltipHtml);
      })
      .on("mousemove", function (event, d) {
        if (d.depth === 0) return;
        const isSubgenre = d.depth === 2;
        const genreName = isSubgenre ? d.parent.data.name : d.data.name;
        const subgenreName = isSubgenre ? d.data.name : null;
        const trackCount = d.value || 0;
        const percentage = totalTracks > 0 ? ((trackCount / totalTracks) * 100).toFixed(2) : 0;
        const avgPopularity = d.data.avgPopularity !== undefined && Number.isFinite(d.data.avgPopularity)
          ? d.data.avgPopularity
          : 0;

        let tooltipHtml = '';

        if (isSubgenre && subgenreName && subgenreName !== 'Unknown') {
          tooltipHtml += `<div style="font-size: 16px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">${subgenreName}</div>`;
          tooltipHtml += `<strong>Genre:</strong> ${String(genreName).toUpperCase()}`;
          tooltipHtml += `<br><em style="color: #9ca3af; font-size: 11px;">Click to filter by subgenre</em>`;
        } else {
          tooltipHtml += `<div style="font-size: 16px; font-weight: bold; color: #f3f4f6; margin-bottom: 6px;">${String(genreName).toUpperCase()}</div>`;
          tooltipHtml += `<em style="color: #9ca3af; font-size: 11px;">Click to filter by genre</em>`;
        }

        tooltipHtml += `<br><strong>Tracks:</strong> ${trackCount.toLocaleString()}`;

        if (totalTracks > 0) {
          tooltipHtml += ` <span style="color: #9ca3af;">(${percentage}%)</span>`;
        }

        if (avgPopularity > 0) {
          tooltipHtml += `<br><strong>Avg. Popularity:</strong> ${avgPopularity.toFixed(1)}`;
        }

        onMouseMove(event, tooltipHtml);
      })
      .on("mouseout", function (event, d) {
        if (d.depth === 0) return;
        d3.select(this)
          .style("opacity", 0.8)
          .style("stroke-width", d => d.depth === 1 ? 1.5 : 1)
          .style("stroke", d => d.depth === 1 ? "#6b7280" : "#9ca3af");
        onMouseOut();
      });


    node.filter(d => d.depth === 1 && d.r > 40)
      .append("text")
      .attr("dy", "-0.5em")
      .text(d => String(d.data.name).toUpperCase())
      .style("font-size", d => `${Math.max(10, Math.min(16, d.r / 6))}px`)
      .style("fill", "#ffffff")
      .style("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("font-weight", "700")
      .style("text-shadow", "0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)")
      .style("letter-spacing", "0.5px");


    node.filter(d => d.depth === 2 && d.r > 12)
      .each(function (d) {
        const group = d3.select(this);
        const name = d.data.name;
        const fontSize = Math.max(8, Math.min(12, d.r / 3));


        if (name.length > 13 && d.r > 25) {
          const words = name.split(' ');
          let lines = [];
          let currentLine = '';


          words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const charLimit = Math.floor(d.r / 2.5);

            if (testLine.length <= charLimit) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word.length > charLimit ? word.substring(0, charLimit - 2) + '..' : word;
            }
          });
          if (currentLine) lines.push(currentLine);


          if (lines.length > 2) {
            lines[1] = lines[1].substring(0, Math.min(lines[1].length, 8)) + '...';
            lines = lines.slice(0, 2);
          }


          const text = group.append("text")
            .style("font-size", `${fontSize}px`)
            .style("fill", "#ffffff")
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("font-weight", "600")
            .style("text-shadow", "0 0 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.7)");

          const lineHeight = fontSize * 1.2;
          const startY = -(lines.length - 1) * lineHeight / 2;

          lines.forEach((line, i) => {
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", i === 0 ? `${startY}px` : `${lineHeight}px`)
              .text(line);
          });
        } else {

          const charLimit = Math.max(8, Math.floor(d.r / 2));
          const displayName = name.length > charLimit ? name.substring(0, charLimit - 2) + '..' : name;

          group.append("text")
            .attr("dy", "0.35em")
            .text(displayName)
            .style("font-size", `${fontSize}px`)
            .style("fill", "#ffffff")
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("font-weight", "600")
            .style("text-shadow", "0 0 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.7)");
        }
      });

  } catch (error) {
    console.error("Error drawing subgenre tree:", error);
    d3.select(selector).html(`<p class="text-red-400">Error loading chart data: ${error.message}</p>`);
  }
}


async function drawAllCharts() {

  renderActiveFilters();

  await Promise.all([

    drawChart1(),
    drawChart2(),
    drawChart3(),
    drawChart4(),
    drawChart5(),
    drawChart6(),
    drawChart7(),

    drawGenrePopularityTimeline(),
    drawGenreCorrelationMatrix(),
    drawFeatureImportance(),
    drawGenreEvolution(),
    drawSubgenreTree()
  ]);

  await updateChartCounts();
}


document.addEventListener('DOMContentLoaded', () => { drawAllCharts(); renderActiveFilters(); });


let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    drawAllCharts();
  }, 300);
});
