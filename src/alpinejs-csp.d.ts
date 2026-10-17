// @alpinejs/csp ships without types; it exposes the same API as alpinejs.
declare module '@alpinejs/csp' {
  import type { Alpine } from 'alpinejs';
  const alpine: Alpine;
  export default alpine;
}
