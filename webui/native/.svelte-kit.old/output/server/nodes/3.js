

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/demo/_page.svelte.js')).default;
export const imports = [];
export const stylesheets = [];
export const fonts = [];
