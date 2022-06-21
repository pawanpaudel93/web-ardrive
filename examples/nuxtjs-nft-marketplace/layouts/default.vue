<template>
  <div>
    <Header />
    <div class="p-6">
      <Nuxt />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api'
import Header from '@/components/Header.vue'

export default defineComponent({
  name: 'DefaultLayout',
  components: {
    Header,
  },
  setup() {},
})
</script>

