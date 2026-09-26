interface PointerSample {
  x: number;
  y: number;
  time: number;
}
export function isTap(start: PointerSample, end: PointerSample) {
  return (
    end.time >= start.time &&
    end.time - start.time <= 450 &&
    Math.hypot(end.x - start.x, end.y - start.y) <= 6
  );
}
/** 多指、拖动、长按和取消都不能触发盒盖点击。 */
export function connectPicking(
  canvas: HTMLElement,
  onTap: (x: number, y: number) => void,
  onManipulate: () => void = () => {},
) {
  const abort = new AbortController(),
    options = { signal: abort.signal };
  let active: { id: number; start: PointerSample; moved: boolean } | null = null;
  const pointers = new Set<number>();
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pointers.add(event.pointerId);
      if (pointers.size !== 1 || !event.isPrimary || event.button !== 0) {
        active = null;
        if (pointers.size > 1 || event.button !== 0) onManipulate();
        return;
      }
      active = {
        id: event.pointerId,
        start: { x: event.clientX, y: event.clientY, time: event.timeStamp },
        moved: false,
      };
    },
    options,
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (
        active?.id === event.pointerId &&
        Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) > 6
      ) {
        if (!active.moved) onManipulate();
        active.moved = true;
      }
    },
    options,
  );
  const cancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    active = null;
  };
  canvas.addEventListener('pointercancel', cancel, options);
  canvas.addEventListener('lostpointercapture', cancel, options);
  canvas.addEventListener('wheel', onManipulate, { ...options, passive: true });
  canvas.addEventListener(
    'pointerup',
    (event) => {
      const current = active;
      pointers.delete(event.pointerId);
      active = null;
      if (
        current?.id === event.pointerId &&
        !current.moved &&
        isTap(current.start, { x: event.clientX, y: event.clientY, time: event.timeStamp })
      )
        onTap(event.clientX, event.clientY);
    },
    options,
  );
  return () => {
    abort.abort();
    pointers.clear();
    active = null;
  };
}
