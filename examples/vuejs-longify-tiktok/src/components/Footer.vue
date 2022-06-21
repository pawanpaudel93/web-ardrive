<template>
  <v-card height="100">
    <v-footer
      absolute
      class="font-weight-medium"
      color="primary"
      dark
    >
    <v-col
      class="py-4 text-center white--text"
      cols="12"
    >
      &copy;{{ new Date().getFullYear() }} — <strong>LongifyTikTok</strong> (Made by <a class="white--text" target="_blank" href="https://github.com/pawanpaudel93">Pawan Paudel</a>)
    </v-col>
    </v-footer>
  </v-card>
</template>

<script>
  export default {
    name: "Footer"
  }
</script>