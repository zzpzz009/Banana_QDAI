import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadModules() {
  const baseDir = path.join(__dirname, '..', 'tmp', 'touch-tests', 'src', 'touch');
  const stateUrl = pathToFileURL(path.join(baseDir, 'touchState.js')).href;
  const engineUrl = pathToFileURL(path.join(baseDir, 'touchGestureEngine.js')).href;
  const stateModule = await import(stateUrl);
  const engineModule = await import(engineUrl);
  return { stateModule, engineModule };
}

function makePoint(x, y) {
  return { x, y };
}

function buildContext(initialZoom, panOffset, initialCenter, initialDistance, minZoom, maxZoom) {
  return {
    state: null,
    config: { minZoom, maxZoom },
    context: {
      initialTransform: {
        zoom: initialZoom,
        panOffset
      },
      initialCenter,
      initialDistance
    }
  };
}

async function testScaleAndClamp() {
  const { stateModule, engineModule } = await loadModules();
  const { createInitialTouchState, applyPointerDown } = stateModule;
  const { computePinchPan } = engineModule;

  let state = createInitialTouchState();
  ({ nextState: state } = applyPointerDown(state, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 }, makePoint(0, 0)));
  ({ nextState: state } = applyPointerDown(state, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 0 }, makePoint(10, 0)));

  const input = buildContext(
    1,
    makePoint(0, 0),
    makePoint(5, 0),
    10,
    0.5,
    2
  );
  input.state = state;

  const result = computePinchPan(input);
  assert(result);
  assert(result.transform.zoom >= 0.5 && result.transform.zoom <= 2);
}

async function testPanAnchorsCenter() {
  const { stateModule, engineModule } = await loadModules();
  const { createInitialTouchState, applyPointerDown } = stateModule;
  const { computePinchPan } = engineModule;

  let state = createInitialTouchState();
  ({ nextState: state } = applyPointerDown(state, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 }, makePoint(0, 0)));
  ({ nextState: state } = applyPointerDown(state, { pointerId: 2, pointerType: 'touch', clientX: 30, clientY: 10 }, makePoint(2, 0)));

  const input = buildContext(
    1,
    makePoint(0, 0),
    makePoint(1, 0),
    2,
    0.1,
    10
  );
  input.state = state;

  const result = computePinchPan(input);
  assert(result);
  const { zoom, panOffset } = result.transform;

  const canvasCenterX = 1;
  const screenCenterX = panOffset.x + canvasCenterX * zoom;
  assert(Math.abs(screenCenterX - 20) < 1e-6);
}

async function testInsufficientPointers() {
  const { stateModule, engineModule } = await loadModules();
  const { createInitialTouchState, applyPointerDown, applyPointerUp } = stateModule;
  const { computePinchPan } = engineModule;

  let state = createInitialTouchState();
  ({ nextState: state } = applyPointerDown(state, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 }, makePoint(0, 0)));

  const input = buildContext(
    1,
    makePoint(0, 0),
    makePoint(0, 0),
    10,
    0.1,
    10
  );
  input.state = state;

  const resultSingle = computePinchPan(input);
  assert.equal(resultSingle, null);

  ({ nextState: state } = applyPointerUp(state, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 }));
  input.state = state;
  const resultNone = computePinchPan(input);
  assert.equal(resultNone, null);
}

async function run() {
  await testScaleAndClamp();
  await testPanAnchorsCenter();
  await testInsufficientPointers();
  console.log('touchGestureEngine tests passed');
}

run();

