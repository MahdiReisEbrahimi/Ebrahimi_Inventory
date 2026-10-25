<template>
  <div class="price-history-chart">
    <EmptyState
      v-if="!data.length"
      title="هنوز تغییری در قیمت ثبت نشده"
      description="پس از اولین تغییر قیمت، روند خرید و فروش کالا اینجا نمایش داده می‌شود."
    />
    <VChart
      v-else
      class="chart"
      :option="chartOption"
      autoresize
      aria-label="نمودار تاریخچه قیمت خرید و فروش"
    />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTheme } from '@/composables/useTheme'
import { date, number } from '@/lib/format'
use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])
const props = defineProps<{
  data: { createdAt: string; newBuyPrice: number | null; newSellPrice: number | null }[]
}>()
const { isDark } = useTheme()
const sorted = computed(() =>
  [...props.data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
)
const chartOption = computed(() => {
  const dark = isDark.value
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    color: [dark ? '#e7bf7c' : '#93611b', token('--primary')],
    textStyle: { fontFamily: 'Vazirmatn', color: token('--muted-foreground') },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: token('--popover'),
      borderColor: token('--border'),
      textStyle: { color: token('--foreground'), fontFamily: 'Vazirmatn' },
      valueFormatter: (value: number | null) => (value == null ? '—' : number(value) + ' تومان'),
    },
    legend: {
      top: 16,
      textStyle: { color: token('--foreground'), fontFamily: 'Vazirmatn', fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 5,
    },
    grid: { top: 64, left: 16, right: 16, bottom: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.value.map((item) => date(item.createdAt)),
      axisLine: { lineStyle: { color: token('--border') } },
      axisLabel: { color: token('--muted-foreground'), fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: token('--muted-foreground'),
        fontSize: 10,
        formatter: (value: number) => number(value),
      },
      splitLine: { lineStyle: { color: token('--border'), type: 'dashed' } },
    },
    series: [
      {
        name: 'قیمت خرید',
        type: 'line',
        smooth: false,
        symbolSize: 7,
        connectNulls: true,
        data: sorted.value.map((item) => item.newBuyPrice),
      },
      {
        name: 'قیمت فروش',
        type: 'line',
        smooth: false,
        symbolSize: 7,
        connectNulls: true,
        data: sorted.value.map((item) => item.newSellPrice),
      },
    ],
  }
})
</script>
<style scoped>
.price-history-chart {
  width: 100%;
  min-width: 0;
  margin-top: 12px;
}
.chart {
  width: 100%;
  height: 300px;
}
</style>
