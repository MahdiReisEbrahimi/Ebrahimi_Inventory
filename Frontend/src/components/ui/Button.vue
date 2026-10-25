<template>
  <component
    :is="props.as"
    v-bind="attrs"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
    :type="props.as === 'button' ? props.type : undefined"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

defineOptions({ name: 'AppButton', inheritAttrs: false })

const buttonVariants = cva('button', {
  variants: {
    variant: {
      default: 'button--primary',
      primary: 'button--primary',
      outline: 'button--outline',
      destructive: 'button--destructive',
      ghost: 'button--ghost',
    },
    size: {
      default: '',
      sm: 'button--small',
      lg: 'button--large',
      icon: 'button--icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ButtonVariants = VariantProps<typeof buttonVariants>
const props = withDefaults(
  defineProps<{
    as?: string
    type?: 'button' | 'submit' | 'reset'
    class?: string
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
  }>(),
  {
    as: 'button',
    type: 'button',
    variant: 'default',
    size: 'default',
  },
)
const attrs = useAttrs()
</script>
