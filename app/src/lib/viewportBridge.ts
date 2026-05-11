type ViewportState = { x: number; y: number; zoom: number };
type Setter = (vp: ViewportState, opts?: { duration?: number }) => void;
type Getter = () => ViewportState | null;
type FitViewFn = (opts?: { padding?: number; duration?: number }) => void;
type SetCenterFn = (x: number, y: number, opts?: { zoom?: number; duration?: number }) => void;

let _setter: Setter | null = null;
let _getter: Getter | null = null;
let _fitView: FitViewFn | null = null;
let _setCenter: SetCenterFn | null = null;

export function registerViewport(setter: Setter, getter: Getter, fitViewFn?: FitViewFn, setCenterFn?: SetCenterFn) {
  _setter = setter;
  _getter = getter;
  if (fitViewFn) _fitView = fitViewFn;
  if (setCenterFn) _setCenter = setCenterFn;
}

export function animateToViewport(vp: ViewportState, duration = 700) {
  _setter?.(vp, { duration });
}

export function captureViewport(): ViewportState | null {
  return _getter?.() ?? null;
}

export function fitViewFromBridge(opts?: { padding?: number; duration?: number }) {
  _fitView?.(opts);
}

export function centerOnPoint(x: number, y: number, zoom?: number, duration = 350) {
  const currentZoom = zoom ?? (_getter?.()?.zoom ?? 1);
  _setCenter?.(x, y, { zoom: currentZoom, duration });
}
