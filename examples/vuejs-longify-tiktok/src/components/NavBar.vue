<template>
  <v-app-bar app color="primary" dark>
    <div class="d-flex align-center">
      <v-img
        alt="LongifyTikTok Logo"
        class="shrink mr-2"
        contain
        src="@/assets/logo.png"
        transition="scale-transition"
        width="70"
      />
    </div>
    <v-toolbar-title class="headline font-weight-bold">LongifyTikTok</v-toolbar-title>
  </v-app-bar>
</template>

<script>
  export default {
    name: "NavBar",
    methods: {
      darkMode() {
        this.$vuetify.theme.dark = !this.$vuetify.theme.dark;
      }
    }
  };
</script>