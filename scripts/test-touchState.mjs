import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadModule() {
  const touchStateModulePath = path.join(__dirname, '..', 'tmp', 'touch-tests', 'src', 'touch', 'touchState.js');
  const url = pathToFileURL(touchStateModulePath).href;
  const module = await import(url);
  return module;
}

function makeEvent(id, type, x, y) {
  return {
    pointerId: id,
    pointerType: type,
    clientX: x,
    clientY: y
  };
}

function makePoint(x, y) {
  return { x, y };
}

function testPointerLifecycle(api) {
  const {
    createInitialTouchState,
    applyPointerDown,
    applyPointerMove,
    applyPointerUp
  } = api;

  let state = createInitialTouchState();
  assert.equal(state.activePointers.size, 0);
  assert.equal(state.gestureMode, 'none');

  const downEvent = makeEvent(1, 'touch', 10, 20);
  const downPoint = makePoint(1, 2);
  ({ nextState: state } = applyPointerDown(state, downEvent, downPoint));
  assert.equal(state.activePointers.size, 1);
  assert.equal(state.gestureMode, 'singlePointer');
  const snapshot = state.activePointers.get(1);
  assert(snapshot);
  assert.equal(snapshot.clientX, 10);
  assert.equal(snapshot.canvasPoint.x, 1);

  const moveEvent = makeEvent(1, 'touch', 30, 40);
  const movePoint = makePoint(3, 4);
  ({ nextState: state } = applyPointerMove(state, moveEvent, movePoint));
  assert.equal(state.activePointers.size, 1);
  const moved = state.activePointers.get(1);
  assert(moved);
  assert.equal(moved.clientY, 40);
  assert.equal(moved.canvasPoint.y, 4);

  const upEvent = makeEvent(1, 'touch', 30, 40);
  ({ nextState: state } = applyPointerUp(state, upEvent));
  assert.equal(state.activePointers.size, 0);
  assert.equal(state.gestureMode, 'none');
}

function testCancelClearsPointers(api) {
  const {
    createInitialTouchState,
    applyPointerDown,
    applyPointerCancel
  } = api;

  let state = createInitialTouchState();
  ({ nextState: state } = applyPointerDown(state, makeEvent(1, 'touch', 0, 0), makePoint(0, 0)));
  ({ nextState: state } = applyPointerDown(state, makeEvent(2, 'touch', 10, 10), makePoint(1, 1)));
  assert.equal(state.activePointers.size, 2);
  assert.equal(state.gestureMode, 'pinchPan');

  ({ nextState: state } = applyPointerCancel(state, makeEvent(1, 'touch', 0, 0)));
  assert.equal(state.activePointers.size, 1);
  assert.equal(state.gestureMode, 'singlePointer');

  ({ nextState: state } = applyPointerCancel(state, makeEvent(2, 'touch', 0, 0)));
  assert.equal(state.activePointers.size, 0);
  assert.equal(state.gestureMode, 'none');
}

function testMouseIgnored(api) {
  const {
    createInitialTouchState,
    applyPointerDown
  } = api;

  let state = createInitialTouchState();
  ({ nextState: state } = applyPointerDown(state, makeEvent(1, 'mouse', 0, 0), makePoint(0, 0)));
  assert.equal(state.activePointers.size, 0);
  assert.equal(state.gestureMode, 'none');
}

async function run() {
  const api = await loadModule();
  testPointerLifecycle(api);
  testCancelClearsPointers(api);
  testMouseIgnored(api);
  console.log('touchState tests passed');
}

run();
