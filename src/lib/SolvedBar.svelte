<script lang="ts">
  interface Props {
    onnext: () => void
  }

  let { onnext }: Props = $props()

  // keyboard users can press Enter straight away; preventScroll keeps the
  // page from jumping on mobile
  const focusQuietly = (node: HTMLElement) => {
    node.focus({ preventScroll: true })
  }
</script>

<div class="solved-bar" role="status">
  <span class="solved-label"><span aria-hidden="true">✓</span> Solved</span>
  <button class="solved-next" onclick={onnext} use:focusQuietly>Next puzzle →</button>
</div>
