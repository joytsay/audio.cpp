<script lang="ts">
  import { onMount } from 'svelte';
  import Sip from '../Sip.svelte';
  import logoCloud from '../../../static/logo_cloud.svg?raw';
  import { UI_THEME_STORAGE_KEY, resolvedTheme, resolveUiTheme } from '$lib/theme';
  import '../../app.css';

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = resolvedTheme(resolveUiTheme(localStorage.getItem(UI_THEME_STORAGE_KEY)), media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });
</script>

<svelte:head><title>SIP · GeoVision IVR</title></svelte:head>
<header class="topbar">
  <div class="brand"><div class="brand-logo">{@html logoCloud}</div><div><strong>GeoVision IVR</strong><span>Interactive Voice Response</span></div></div>
  <nav aria-label="Primary navigation">
    <a class="nav-link" href="#/">Studio</a>
    <a class="nav-link" href="#/pipeline">Pipeline</a>
    <a class="nav-link active" href="#/sip" aria-current="page">SIP</a>
  </nav>
</header>
<main><Sip /></main>
