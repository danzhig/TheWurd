/**
 * The zoom library, loaded by the Vault just after first paint (PLAN §12 budget: initial
 * JavaScript on `/` under 150 KB). The map is placed without it, then it takes over the camera.
 */
import 'd3-transition';
export { select } from 'd3-selection';
export { zoom, zoomIdentity } from 'd3-zoom';
