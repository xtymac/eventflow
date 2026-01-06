/**
 * Custom styles for maplibre-gl-draw.
 * Uses cyan theme to match the existing preview-geometry layer.
 */
export const drawStyles = [
  // Polygon fill - active (being drawn)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#06B6D4', // cyan
      'fill-opacity': 0.2,
    },
  },
  // Polygon fill - inactive (completed) - visible but lower opacity than active
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#06B6D4', // cyan
      'fill-opacity': 0.15,  // Visible but lower than active (0.2)
    },
  },
  // Polygon stroke - active
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'line-color': '#0891B2', // cyan-600
      'line-width': 3,
      'line-dasharray': [2, 2],
    },
  },
  // Polygon stroke - inactive
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    paint: {
      'line-color': '#06B6D4', // cyan
      'line-width': 3,
    },
  },
  // Line - active (being drawn)
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
    paint: {
      'line-color': '#0891B2', // cyan-600
      'line-width': 4,
      'line-dasharray': [2, 2],
    },
  },
  // Line - inactive (completed)
  {
    id: 'gl-draw-line-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString']],
    paint: {
      'line-color': '#06B6D4', // cyan
      'line-width': 4,
    },
  },
  // Vertices - active (being edited)
  {
    id: 'gl-draw-vertex-active',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 7,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#06B6D4',
      'circle-stroke-width': 2,
    },
  },
  // Vertices - selected
  {
    id: 'gl-draw-vertex-selected',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']],
    paint: {
      'circle-radius': 8,
      'circle-color': '#06B6D4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
  // Midpoints - for adding vertices
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#06B6D4',
      'circle-opacity': 0.7,
    },
  },
  // Point - active
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', 'meta', 'feature'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 8,
      'circle-color': '#06B6D4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
  // Point - inactive
  {
    id: 'gl-draw-point-inactive',
    type: 'circle',
    filter: ['all', ['==', 'active', 'false'], ['==', 'meta', 'feature'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 6,
      'circle-color': '#06B6D4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
];
