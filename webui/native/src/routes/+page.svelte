<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import Demo from './demo/+page.svelte';
  import Studio from './Studio.svelte';

  // Demo: HTTP 8081 / HTTPS 8082. Full interface: HTTP 8083 / HTTPS 8084.
  const isStudio = () => browser && (location.port === '8083' || (location.protocol === 'https:' && location.port !== '8082') || new URLSearchParams(location.hash.split('?')[1] || '').has('studio'));
  let studio = isStudio();
  onMount(() => {
    const update = () => { studio = isStudio(); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  });
</script>

{#if studio}
  <Studio />
{:else}
  <Demo />
{/if}
