<template>
  <div class="price-history-chart">
    <div v-if="!data.length" class="empty">تاریخچه‌ای برای نمایش وجود ندارد.</div>

    <VChart v-else class="chart" :option="chartOption" autoresize />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'

import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
])

interface PriceHistory {
  id: number
  productId: number

  oldBuyPrice: number
  newBuyPrice: number

  oldSellPrice: number
  newSellPrice: number

  changePercent: number | null

  type: string

  changedById: number | null
  changedByName: string | null

  createdAt: string

  oldPrice: number
  newPrice: number

  changedBy: unknown | null
}

interface Props {
  data: PriceHistory[]
}

const props = defineProps<Props>()

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('fa-IR').format(price)
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

const sortedData = computed(() => {
  return [...props.data].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
})

const chartOption = computed(() => {
  return {
    tooltip: {
      trigger: 'axis',

      formatter: (params: any[]) => {
        if (!params?.length) return ''

        const index = params[0].dataIndex
        const item = sortedData.value[index]

        return `
          <div style=" direction: rtl; text-align: right; min-width: 190px; padding: 4px 2px; font-family: inherit; " > <!-- Date --> <div style=" display: flex; align-items: center; gap: 6px; padding-bottom: 10px; margin-bottom: 9px; border-bottom: 1px solid rgba(128,128,128,.2); color: #909399; font-size: 12px; " > <span style="font-size: 14px;">🕐</span>
            <span> ${formatDate(item.createdAt)} </span> </div> <!-- Buy --> <div style=" display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 8px; " > <div style=" display: flex; align-items: center; gap: 7px; color: #606266; font-size: 12px; " >
            <span style=" width: 7px; height: 7px; border-radius: 50%; background: #e6a23c; display: inline-block; " ></span> <span>قیمت خرید</span> </div> <strong style=" color: #303133; font-size: 13px; white-space: nowrap; " >
           ${formatPrice(item.newBuyPrice)} <small style=" font-size: 10px; font-weight: normal; color: #909399; " >
            تومان </small> </strong> </div>
             <!-- Sell --> <div style=" display: flex; align-items: center; justify-content: space-between; gap: 20px; " >
             <div style=" display: flex; align-items: center; gap: 7px; color: #606266; font-size: 12px; " > <span style=" width: 7px; height: 7px; border-radius: 50%; background: #67c23a; display: inline-block; " ></span> <span>قیمت فروش</span> </div> <strong style=" color: #303133; font-size: 13px; white-space: nowrap; " > ${formatPrice(item.newSellPrice)} <small style=" font-size: 10px; font-weight: normal; color: #909399; " > تومان </small> </strong> </div>
          </div>
        `
      },
    },

    legend: {
      data: ['قیمت خرید', 'قیمت فروش'],
      top: 0,
    },

    grid: {
      top: 50,
      left: 20,
      right: 20,
      bottom: 60,
      containLabel: true,
    },

    xAxis: {
      type: 'category',
      boundaryGap: false,

      data: sortedData.value.map((item) => formatDate(item.createdAt)),

      axisLabel: {
        rotate: 30,
      },
    },

    yAxis: {
      type: 'value',

      axisLabel: {
        formatter: (value: number) => {
          return formatPrice(value)
        },
      },
    },

    dataZoom: [
      {
        type: 'inside',
      },
      {
        type: 'slider',
        height: 20,
        bottom: 10,
      },
    ],

    series: [
      {
        name: 'قیمت خرید',
        type: 'line',
        smooth: true,

        data: sortedData.value.map((item) => item.newBuyPrice),

        symbol: 'circle',
        symbolSize: 8,
      },

      {
        name: 'قیمت فروش',
        type: 'line',
        smooth: true,

        data: sortedData.value.map((item) => item.newSellPrice),

        symbol: 'circle',
        symbolSize: 8,
      },
    ],
  }
})
</script>
<style scoped>
.price-history-chart {
  width: 100%;
}

.chart {
  width: 100%;
  height: 350px;
}

.empty {
  height: 300px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #909399;
}
</style>
