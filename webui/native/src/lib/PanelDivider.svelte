<script lang="ts">
  export let label: string;
  export let value: number;
  export let min: number;
  export let max: number;
  export let orientation: "vertical" | "horizontal" = "vertical";
  export let reverse = false;
  export let percent = false;
  export let oncommit = () => {};
  let dragging = false;
  let origin = 0,
    initial = 0,
    span = 1;
  const coordinate = (event: PointerEvent) =>
    orientation === "vertical" ? event.clientX : event.clientY;
  function update(next: number) {
    value = Math.round(Math.max(min, Math.min(max, next)) * 10) / 10;
  }
  function start(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    element.focus();
    dragging = true;
    origin = coordinate(event);
    initial = value;
    span = percent
      ? (element.closest("[data-resize-container]")?.getBoundingClientRect()
          .width || 100) / 100
      : 1;
    element.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (dragging)
      update(
        initial + ((coordinate(event) - origin) * (reverse ? -1 : 1)) / span,
      );
  }
  function finish() {
    if (!dragging) return;
    dragging = false;
    oncommit();
  }
  function key(event: KeyboardEvent) {
    const decrement = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    const increment = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    if (![decrement, increment, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    update(
      event.key === "Home"
        ? min
        : event.key === "End"
          ? max
          : value +
            (event.key === increment ? 1 : -1) *
              (reverse ? -1 : 1) *
              (percent ? 2 : 16),
    );
    oncommit();
  }
</script>

<!-- A focusable ARIA separator is an interactive window splitter. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
  class="divider"
  class:horizontal={orientation === "horizontal"}
  class:dragging
  role="separator"
  aria-label={label}
  aria-orientation={orientation}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  tabindex="0"
  on:pointerdown={start}
  on:pointermove={move}
  on:pointerup={finish}
  on:pointercancel={finish}
  on:lostpointercapture={finish}
  on:keydown={key}
></div>

<style>
  .divider {
    width: 100%;
    height: 100%;
    min-width: 6px;
    min-height: 6px;
    touch-action: none;
    cursor: col-resize;
    border-radius: 3px;
    position: relative;
    z-index: 4;
  }
  .horizontal {
    cursor: row-resize;
  }
  .divider::after {
    content: "";
    position: absolute;
    left: 2px;
    right: 2px;
    top: 30%;
    bottom: 30%;
    border-radius: 3px;
    background: var(--line, #263d56);
  }
  .horizontal::after {
    left: 45%;
    right: 45%;
    top: 2px;
    bottom: 2px;
  }
  .divider:hover,
  .divider:focus-visible,
  .dragging {
    background: #38d9d333;
    outline: none;
  }
  .divider:hover::after,
  .divider:focus-visible::after,
  .dragging::after {
    background: var(--cyan, #38d9d3);
  }
</style>
