<script setup lang="ts">
import { DataTooltip } from '@/components/ui/data-tooltip'

const buildVersion = __BUILD_VERSION__
const buildGitHash = __BUILD_GIT_HASH__
</script>

<template>
  <footer class="w-full max-w-[1280px] mx-auto p-4">
    <div class="flex w-full flex-row flex-nowrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <div data-footer-credit="powered" class="flex shrink-0 items-center gap-1 whitespace-nowrap">
        Powered by
        <a
          href="https://github.com/monitor-probe/monitor" target="_blank" rel="noopener noreferrer"
          class="transition-opacity hover:opacity-80"
        >
          <span class="font-medium text-foreground">Monitor</span>
        </a>
      </div>
      <div data-footer-credit="theme" class="flex shrink-0 items-center justify-end gap-1 whitespace-nowrap text-right">
        Theme by
        <DataTooltip
          as="span"
          placement="top"
          :content="`v${buildVersion}\n${buildGitHash}`"
        >
          <a
            href="https://github.com/TonyStarkJr2021/komari-theme-Gloria-Universe" target="_blank" rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            <span class="font-medium text-foreground">TonyStarkJr2021</span>
          </a>
        </DataTooltip>
      </div>
    </div>
  </footer>
</template>
