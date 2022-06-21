<template>
  <v-app>
    <NavBar/>

    <v-main>
      <router-view></router-view>
    </v-main>
    <Footer />
  </v-app>
</template>

<script>
  import NavBar from "@/components/NavBar";
  import Footer from "@/components/Footer";

  export default {
    name: "App",

    components: {
      NavBar,
      Footer
    },

    data: () => ({
      //
    })
  };
</script>
