<script lang="ts">
  import { onMount } from 'svelte';
  import Pipeline from '../Pipeline.svelte';
  import logoCloud from '../../../static/logo_cloud.svg?raw';
  import '../../app.css';
  import { UI_THEME_STORAGE_KEY, resolvedTheme, resolveUiTheme } from '$lib/theme';
  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = resolvedTheme(resolveUiTheme(localStorage.getItem(UI_THEME_STORAGE_KEY)), media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });
</script>

<svelte:head><title>GeoVision IVR · Voice conversation</title></svelte:head>
<header class="topbar">
  <div class="brand"><div class="brand-logo">{@html logoCloud}</div><div><strong>GeoVision IVR</strong><span>Voice conversation</span></div></div>
  <nav aria-label="Primary navigation"><a class="nav-link active" href="#/pipeline">Pipeline</a></nav>
</header>
<main><Pipeline /></main>
