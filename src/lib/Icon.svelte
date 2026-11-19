<script lang="ts">
  // One small stroke-icon set (Lucide-style, 24px grid) instead of mixed
  // unicode glyphs, which rendered at inconsistent sizes and weights.
  type Name = 'chevron-down' | 'x' | 'rotate-cw' | 'lightbulb' | 'circle-check' | 'book-open'

  interface Props {
    name: Name
    size?: number
  }

  let { name, size = 16 }: Props = $props()
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'chevron-down'}
    <path d="m6 9 6 6 6-6" />
  {:else if name === 'x'}
    <path d="M18 6 6 18M6 6l12 12" />
  {:else if name === 'rotate-cw'}
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  {:else if name === 'lightbulb'}
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  {:else if name === 'circle-check'}
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  {:else if name === 'book-open'}
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  {/if}
</svg>
